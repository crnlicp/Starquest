import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Random "mo:core/Random";
import Result "mo:core/Result";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Families "../lib/Families";
import Invites "../lib/Invites";
import Types "../types";

mixin (state : Types.State) {
  public shared ({ caller }) func createInvite() : async Result.Result<Types.InviteView, Types.Error> {
    switch (Families.requireParent(state, caller)) { case (#ok _) {}; case (#err e) return #err e };

    let token = Invites.hex(await Random.blob());

    // Re-check after the await: the caller may have been removed meanwhile.
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let now = Time.now();
    Invites.pruneExpired(state, now);
    if (Invites.activeCount(state, parent.familyId) >= Invites.maxActivePerFamily) {
      return #err(#invalid "too many open invites");
    };
    let expiresAt = now + Invites.ttlNs;
    state.invites.add(token, { token; familyId = parent.familyId; createdBy = caller; createdAt = now; expiresAt });
    #ok { token; expiresAt }
  };

  public shared ({ caller }) func acceptInvite(token : Text) : async Result.Result<Types.FamilyView, Types.Error> {
    switch (Families.requireAuthenticated(caller)) { case (#err e) return #err e; case (#ok) {} };
    if (Families.isKnown(state, caller)) return #err(#alreadyExists);
    let invite = switch (state.invites.get(token)) { case (?i) i; case null return #err(#notFound) };
    // Single use: consumed whether it is still valid or not.
    state.invites.remove(token);
    if (invite.expiresAt <= Time.now()) return #err(#notFound);
    let family = switch (Families.family(state, invite.familyId)) { case (#ok f) f; case (#err e) return #err e };
    state.parents.add(caller, { principal = caller; familyId = family.id; kind = #caregiver; joinedAt = Time.now() });
    #ok(Families.view(family))
  };

  public shared ({ caller }) func revokeInvite(token : Text) : async Result.Result<(), Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    switch (state.invites.get(token)) {
      case (?i) {
        if (i.familyId != parent.familyId) return #err(#notFound);
        state.invites.remove(token);
        #ok
      };
      case null #err(#notFound);
    }
  };
};
