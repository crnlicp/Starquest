import Array "mo:core/Array";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Random "mo:core/Random";
import Result "mo:core/Result";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Children "../lib/Children";
import Devices "../lib/Devices";
import Families "../lib/Families";
import Picture "../lib/Picture";
import Pin "../lib/Pin";
import Validation "../lib/Validation";
import Types "../types";

mixin (state : Types.State) {
  public shared ({ caller }) func createPairingCode(childId : Types.ChildId) : async Result.Result<Types.PairingView, Types.Error> {
    switch (Families.requireParent(state, caller)) { case (#ok _) {}; case (#err e) return #err e };
    let bytes = await Random.blob();

    // Re-check after the await: the caller or the child may be gone.
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    switch (Children.inFamily(state, parent.familyId, childId)) { case (#err e) return #err e; case (#ok _) {} };
    let now = Time.now();
    Devices.pruneExpired(state, now);
    if (Devices.activeCodes(state, parent.familyId) >= Devices.maxActiveCodesPerFamily) {
      return #err(#invalid "too many open pairing codes");
    };
    let code = Devices.candidates(bytes).find(func c = not state.pairingCodes.containsKey(c))
      ?? (return #err(#invalid "try again"));
    let entry : Types.PairingCode = {
      code;
      familyId = parent.familyId;
      childId;
      createdBy = caller;
      createdAt = now;
      expiresAt = now + Devices.codeTtlNs;
    };
    Devices.addCode(state, entry);
    #ok(Devices.view(entry))
  };

  // Called with the kid device's own key; parents and already-paired devices are refused.
  public shared ({ caller }) func redeemPairingCode(code : Text, deviceName : Text) : async Result.Result<Types.PairedDevice, Types.Error> {
    switch (Families.requireAuthenticated(caller)) { case (#err e) return #err e; case (#ok) {} };
    if (Families.isKnown(state, caller)) return #err(#alreadyExists);
    let name = switch (Validation.name(deviceName)) { case (#ok n) n; case (#err e) return #err e };
    Devices.redeem(state, caller, code, name, Time.now())
  };

  public query ({ caller }) func listDevices() : async Result.Result<[Types.PairedDevice], Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    #ok(Devices.ofFamily(state, parent.familyId))
  };

  public shared ({ caller }) func revokeDevice(principal : Principal) : async Result.Result<(), Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let d = state.devices.get(principal) ?? (return #err(#notFound));
    if (d.familyId != parent.familyId) return #err(#notFound);
    state.devices.remove(principal);
    #ok
  };

  public shared ({ caller }) func heartbeat() : async Result.Result<(), Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    if (access.childId != null) Devices.touch(state, caller, Time.now());
    #ok
  };

  public shared ({ caller }) func setPicturePassword(childId : Types.ChildId, animals : [Types.Animal]) : async Result.Result<(), Types.Error> {
    switch (Families.requireParent(state, caller)) { case (#ok _) {}; case (#err e) return #err e };
    let secret = switch (Picture.secret(animals)) { case (#ok s) s; case (#err e) return #err e };
    let salt = await Random.blob();

    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let child = switch (Children.inFamily(state, parent.familyId, childId)) { case (#ok c) c; case (#err e) return #err e };
    state.children.add(childId, { child with picture = ?Pin.make(salt, secret); updatedAt = Time.now() });
    state.pictureAttempts.remove(childId);
    #ok
  };

  public shared ({ caller }) func clearPicturePassword(childId : Types.ChildId) : async Result.Result<(), Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let child = switch (Children.inFamily(state, parent.familyId, childId)) { case (#ok c) c; case (#err e) return #err e };
    state.children.add(childId, { child with picture = null; updatedAt = Time.now() });
    state.pictureAttempts.remove(childId);
    #ok
  };

  // Gentle check for Kid Mode: true when it matches or no picture password is set.
  public shared ({ caller }) func verifyPicturePassword(childId : Types.ChildId, animals : [Types.Animal]) : async Result.Result<Bool, Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    if (not Families.allows(access, childId)) return #err(#notAuthorized);
    let child = switch (Children.inFamily(state, access.familyId, childId)) { case (#ok c) c; case (#err e) return #err e };
    let stored = child.picture ?? (return #ok true);
    let now = Time.now();
    let attempts = state.pictureAttempts.get(childId);
    switch (Pin.lockedFor(attempts, now)) {
      case (?wait) return #err(#rateLimited { retryAfterNs = wait });
      case null {};
    };
    let ok = switch (Picture.secret(animals)) { case (#ok s) Pin.matches(stored, s); case (#err _) false };
    if (ok) state.pictureAttempts.remove(childId) else state.pictureAttempts.add(childId, Pin.afterFailure(attempts, now));
    #ok ok
  };
};
