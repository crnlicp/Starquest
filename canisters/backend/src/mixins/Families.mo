import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Behaviors "../lib/Behaviors";
import Families "../lib/Families";
import Rewards "../lib/Rewards";
import Validation "../lib/Validation";
import Types "../types";

mixin (state : Types.State) {
  public shared ({ caller }) func createFamily(name : Text, tzOffsetMinutes : Int) : async Result.Result<Types.FamilyView, Types.Error> {
    switch (Families.requireAuthenticated(caller)) { case (#err e) return #err e; case (#ok) {} };
    if (Families.isKnown(state, caller)) return #err(#alreadyExists);
    let validName = switch (Validation.name(name)) { case (#ok n) n; case (#err e) return #err e };
    switch (Validation.settings({ Families.defaultSettings with tzOffsetMinutes })) {
      case (#err e) return #err e;
      case (#ok _) {};
    };
    let now = Time.now();
    let family = Families.create(state, caller, validName, tzOffsetMinutes, now);
    Behaviors.seedStarters(state, family.id, now);
    Rewards.seedSamples(state, family.id, now);
    #ok(Families.view(family))
  };

  public query ({ caller }) func getMyRole() : async Types.Role {
    if (caller.isAnonymous()) #none else Families.roleOf(state, caller)
  };

  public query ({ caller }) func getMyFamily() : async Result.Result<Types.FamilyView, Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    Families.family(state, access.familyId).mapOk(Families.view)
  };

  public shared ({ caller }) func renameFamily(name : Text) : async Result.Result<(), Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let validName = switch (Validation.name(name)) { case (#ok n) n; case (#err e) return #err e };
    let family = switch (Families.family(state, parent.familyId)) { case (#ok f) f; case (#err e) return #err e };
    state.families.add(family.id, { family with name = validName });
    #ok
  };

  public shared ({ caller }) func updateSettings(settings : Types.Settings) : async Result.Result<(), Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let valid = switch (Validation.settings(settings)) { case (#ok s) s; case (#err e) return #err e };
    let family = switch (Families.family(state, parent.familyId)) { case (#ok f) f; case (#err e) return #err e };
    state.families.add(family.id, { family with settings = valid });
    #ok
  };

  public query ({ caller }) func listParents() : async Result.Result<[Types.Parent], Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    #ok(Families.parentsOf(state, parent.familyId))
  };

  public shared ({ caller }) func removeParent(principal : Principal) : async Result.Result<(), Types.Error> {
    let owner = switch (Families.requireOwner(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    switch (state.parents.get(principal)) {
      case (?p) {
        if (p.familyId != owner.familyId) return #err(#notFound);
        if (p.kind == #owner) return #err(#invalid "the family owner cannot be removed");
        state.parents.remove(principal);
        #ok
      };
      case null #err(#notFound);
    }
  };
};
