import Array "mo:core/Array";
import Blob "mo:core/Blob";
import Int "mo:core/Int";
import Iter "mo:core/Iter";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Nat8 "mo:core/Nat8";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Text "mo:core/Text";
import Types "../types";
import Pin "Pin";

module {
  public let codeTtlNs : Nat = 600_000_000_000; // 10 minutes
  public let maxActiveCodesPerFamily = 10;
  public let maxPerFamily = 20;
  public let heartbeatEveryNs : Int = 300_000_000_000; // 5 minutes
  // Device keys are free to make, so the per-caller limit alone does not stop guessing:
  // this cap on wrong codes across all callers bounds guesses to ~300 per code lifetime.
  public let globalWindowNs : Int = 60_000_000_000;
  public let globalMaxFailures = 30;

  public func pairUrl(code : Text) : Text { "starquest://pair?code=" # code };

  public func view(c : Types.PairingCode) : Types.PairingView {
    { code = c.code; childId = c.childId; expiresAt = c.expiresAt; url = pairUrl(c.code) }
  };

  // Six-digit candidates from 4-byte chunks; 2^32 mod 10^6 bias is negligible.
  public func candidates(bytes : Blob) : [Text] {
    let b = bytes.toArray();
    Array.tabulate(b.size() / 4, func k {
      let i = k * 4;
      let n = ((b[i].toNat() * 256 + b[i + 1].toNat()) * 256 + b[i + 2].toNat()) * 256 + b[i + 3].toNat();
      var digits = (n % 1_000_000).toText();
      while (digits.size() < 6) digits := "0" # digits;
      digits
    })
  };

  public func pruneExpired(state : Types.State, now : Types.Time) {
    let expired = state.pairingCodes.entries().filter(func(_, c) = c.expiresAt <= now).map(func(k, _) = k).toArray();
    for (k in expired.values()) state.pairingCodes.remove(k);
  };

  public func pruneAttempts(state : Types.State, now : Types.Time) {
    // Partial counters are dropped too: a reset after the cleanup interval is harmless.
    let pairDone = state.pairAttempts.entries().filter(func(_, a) = a.lockedUntil <= now).map(func(k, _) = k).toArray();
    for (k in pairDone.values()) state.pairAttempts.remove(k);
    let picDone = state.pictureAttempts.entries().filter(func(_, a) = a.lockedUntil <= now).map(func(k, _) = k).toArray();
    for (k in picDone.values()) state.pictureAttempts.remove(k);
  };

  public func activeCodes(state : Types.State, familyId : Types.FamilyId) : Nat {
    state.pairingCodes.values().filter(func c = c.familyId == familyId).size()
  };

  // A new code replaces the child's earlier ones, so only one is live per child.
  public func addCode(state : Types.State, code : Types.PairingCode) {
    let old = state.pairingCodes.entries().filter(func(_, c) = c.childId == code.childId).map(func(k, _) = k).toArray();
    for (k in old.values()) state.pairingCodes.remove(k);
    state.pairingCodes.add(code.code, code);
  };

  public func ofFamily(state : Types.State, familyId : Types.FamilyId) : [Types.PairedDevice] {
    state.devices.values().filter(func d = d.familyId == familyId).toArray()
  };

  public func count(state : Types.State, familyId : Types.FamilyId) : Nat {
    state.devices.values().filter(func d = d.familyId == familyId).size()
  };

  public func removeChild(state : Types.State, childId : Types.ChildId) {
    let devs = state.devices.values().filter(func d = d.childId == childId).map(func d = d.principal).toArray();
    for (p in devs.values()) state.devices.remove(p);
    let codes = state.pairingCodes.values().filter(func c = c.childId == childId).map(func c = c.code).toArray();
    for (k in codes.values()) state.pairingCodes.remove(k);
    state.pictureAttempts.remove(childId);
  };

  // Nanoseconds until redeeming is allowed again, or null.
  public func lockedFor(state : Types.State, caller : Principal, now : Types.Time) : ?Nat {
    let w = state.pairWindow;
    if (now - w.start < globalWindowNs and w.failures >= globalMaxFailures) {
      return ?Int.abs(w.start + globalWindowNs - now);
    };
    Pin.lockedFor(state.pairAttempts.get(caller), now)
  };

  public func recordFailure(state : Types.State, caller : Principal, now : Types.Time) {
    let w = state.pairWindow;
    state.pairWindow := if (now - w.start >= globalWindowNs) { { start = now; failures = 1 } } else {
      { w with failures = w.failures + 1 }
    };
    state.pairAttempts.add(caller, Pin.afterFailure(state.pairAttempts.get(caller), now));
  };

  public func touch(state : Types.State, caller : Principal, now : Types.Time) {
    switch (state.devices.get(caller)) {
      case (?d) {
        if (now - d.lastActive >= heartbeatEveryNs) state.devices.add(caller, { d with lastActive = now });
      };
      case null {};
    };
  };

  public func redeem(state : Types.State, caller : Principal, code : Text, name : Text, now : Types.Time) : Result.Result<Types.PairedDevice, Types.Error> {
    switch (lockedFor(state, caller, now)) {
      case (?wait) return #err(#rateLimited { retryAfterNs = wait });
      case null {};
    };
    let entry = switch (state.pairingCodes.get(code)) {
      case (?c) { if (c.expiresAt > now) c else { recordFailure(state, caller, now); return #err(#notFound) } };
      case null { recordFailure(state, caller, now); return #err(#notFound) };
    };
    // Single use, and the child may have been removed since the code was made.
    state.pairingCodes.remove(code);
    switch (state.children.get(entry.childId)) {
      case (?c) { if (c.familyId != entry.familyId) return #err(#notFound) };
      case null return #err(#notFound);
    };
    if (count(state, entry.familyId) >= maxPerFamily) return #err(#invalid "too many devices");
    state.pairAttempts.remove(caller);
    let device : Types.PairedDevice = {
      principal = caller;
      familyId = entry.familyId;
      childId = entry.childId;
      name;
      pairedAt = now;
      lastActive = now;
    };
    state.devices.add(caller, device);
    #ok device
  };
};
