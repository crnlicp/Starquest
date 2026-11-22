import Array "mo:core/Array";
import Blob "mo:core/Blob";
import Int "mo:core/Int";
import Text "mo:core/Text";
import Sha256 "mo:sha2/Sha256";
import Types "../types";

module {
  public let maxFailures = 5;
  public let lockNs : Nat = 60_000_000_000;

  public func hash(salt : Blob, pin : Text) : Blob {
    Sha256.fromBlob(salt.toArray().concat(pin.encodeUtf8().toArray()).toBlob())
  };

  public func make(salt : Blob, pin : Text) : Types.PinHash {
    { salt; hash = hash(salt, pin) }
  };

  public func matches(stored : Types.PinHash, pin : Text) : Bool {
    hash(stored.salt, pin) == stored.hash
  };

  // Nanoseconds the caller still has to wait, or null when not locked.
  public func lockedFor(attempts : ?Types.Attempts, now : Types.Time) : ?Nat {
    switch (attempts) {
      case (?a) { if (a.lockedUntil > now) ?Int.abs(a.lockedUntil - now) else null };
      case null null;
    }
  };

  // A 4-digit space is tiny, so the lockout is the real protection, not the hash.
  public func afterFailure(attempts : ?Types.Attempts, now : Types.Time) : Types.Attempts {
    let failures = (switch (attempts) { case (?a) a.failures; case null 0 }) + 1;
    if (failures >= maxFailures) {
      { failures = 0; lockedUntil = now + lockNs }
    } else {
      { failures; lockedUntil = 0 }
    }
  };
};
