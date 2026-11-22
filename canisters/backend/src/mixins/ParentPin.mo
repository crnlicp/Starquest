import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Random "mo:core/Random";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Families "../lib/Families";
import Pin "../lib/Pin";
import Validation "../lib/Validation";
import Types "../types";

mixin (state : Types.State) {
  // Checks a PIN against the family's stored hash, counting failures toward the lockout.
  func checkPin(family : Types.Family, pin : Text) : Result.Result<Bool, Types.Error> {
    let now = Time.now();
    let attempts = state.pinAttempts.get(family.id);
    switch (Pin.lockedFor(attempts, now)) {
      case (?wait) return #err(#rateLimited { retryAfterNs = wait });
      case null {};
    };
    let stored = switch (family.pin) { case (?p) p; case null return #err(#notFound) };
    if (Pin.matches(stored, pin)) {
      state.pinAttempts.remove(family.id);
      #ok true
    } else {
      state.pinAttempts.add(family.id, Pin.afterFailure(attempts, now));
      #ok false
    }
  };

  // First call sets the PIN; later calls must pass the current PIN.
  public shared ({ caller }) func setParentPin(newPin : Text, currentPin : ?Text) : async Result.Result<(), Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let pin = switch (Validation.pin(newPin)) { case (#ok p) p; case (#err e) return #err e };
    let family = switch (Families.family(state, parent.familyId)) { case (#ok f) f; case (#err e) return #err e };
    switch (family.pin, currentPin) {
      case (null, _) {};
      case (?_, null) return #err(#notAuthorized);
      case (?_, ?current) {
        switch (checkPin(family, current)) {
          case (#ok true) {};
          case (#ok false) return #err(#notAuthorized);
          case (#err e) return #err e;
        };
      };
    };

    let salt = await Random.blob();

    // State may have changed during the await: re-check membership and that the PIN we verified is still current.
    let parentAfter = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    if (parentAfter.familyId != family.id) return #err(#notAuthorized);
    let latest = switch (Families.family(state, family.id)) { case (#ok f) f; case (#err e) return #err e };
    if (latest.pin != family.pin) return #err(#invalid "PIN changed concurrently, try again");
    state.families.add(latest.id, { latest with pin = ?Pin.make(salt, pin) });
    #ok
  };

  // Update call (not query) so failed attempts persist for the lockout.
  public shared ({ caller }) func verifyParentPin(pin : Text) : async Result.Result<Bool, Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let family = switch (Families.family(state, parent.familyId)) { case (#ok f) f; case (#err e) return #err e };
    checkPin(family, pin)
  };
};
