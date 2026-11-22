import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Behaviors "../lib/Behaviors";
import Families "../lib/Families";
import Sync "../lib/Sync";
import Validation "../lib/Validation";
import Types "../types";

mixin (state : Types.State) {
  public shared ({ caller }) func addBehavior(input : Types.BehaviorInput) : async Result.Result<Types.Behavior, Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let valid = switch (Validation.behavior(input)) { case (#ok v) v; case (#err e) return #err e };
    switch (Behaviors.checkAssigned(state, parent.familyId, valid)) { case (#err e) return #err e; case (#ok) {} };
    if (Behaviors.ofFamily(state, parent.familyId).size() >= Behaviors.maxPerFamily) return #err(#invalid "too many behaviors");
    #ok(Behaviors.add(state, parent.familyId, valid, null, Time.now()))
  };

  public shared ({ caller }) func updateBehavior(id : Types.BehaviorId, input : Types.BehaviorInput) : async Result.Result<Types.Behavior, Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let b = switch (Behaviors.inFamily(state, parent.familyId, id)) { case (#ok b) b; case (#err e) return #err e };
    let valid = switch (Validation.behavior(input)) { case (#ok v) v; case (#err e) return #err e };
    switch (Behaviors.checkAssigned(state, parent.familyId, valid)) { case (#err e) return #err e; case (#ok) {} };
    let updated = {
      b with
      name = valid.name;
      emoji = valid.emoji;
      points = valid.points;
      kind = valid.kind;
      assignedTo = valid.assignedTo;
      mission = valid.mission;
      updatedAt = Time.now();
    };
    state.behaviors.add(id, updated);
    #ok updated
  };

  public shared ({ caller }) func setBehaviorEnabled(id : Types.BehaviorId, enabled : Bool) : async Result.Result<(), Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let b = switch (Behaviors.inFamily(state, parent.familyId, id)) { case (#ok b) b; case (#err e) return #err e };
    state.behaviors.add(id, { b with enabled; updatedAt = Time.now() });
    #ok
  };

  // Log entries keep the behavior's title and emoji, so history survives.
  public shared ({ caller }) func deleteBehavior(id : Types.BehaviorId) : async Result.Result<(), Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    switch (Behaviors.inFamily(state, parent.familyId, id)) { case (#err e) return #err e; case (#ok _) {} };
    state.behaviors.remove(id);
    Sync.recordDeletion(state, parent.familyId, #behavior, id, Time.now());
    #ok
  };

  public query ({ caller }) func listBehaviors() : async Result.Result<[Types.Behavior], Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    #ok(Behaviors.ofFamily(state, access.familyId))
  };

  public query func listStarterBehaviors() : async [Types.StarterBehavior] {
    Behaviors.starters
  };

  public shared ({ caller }) func enableStarterBehaviors(keys : [Text]) : async Result.Result<[Types.Behavior], Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    switch (Behaviors.enableStarters(state, parent.familyId, keys, Time.now())) { case (#err e) return #err e; case (#ok) {} };
    #ok(Behaviors.ofFamily(state, parent.familyId))
  };
};
