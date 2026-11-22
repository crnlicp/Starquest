import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Behaviors "../lib/Behaviors";
import Children "../lib/Children";
import Families "../lib/Families";
import Levels "../lib/Levels";
import Logs "../lib/Logs";
import Missions "../lib/Missions";
import Sync "../lib/Sync";
import Validation "../lib/Validation";
import Types "../types";

mixin (state : Types.State) {
  public shared ({ caller }) func logBehavior(childId : Types.ChildId, behaviorId : Types.BehaviorId, note : ?Text, at : ?Types.Time) : async Result.Result<Types.LogResult, Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let family = switch (Families.family(state, parent.familyId)) { case (#ok f) f; case (#err e) return #err e };
    let child = switch (Children.inFamily(state, family.id, childId)) { case (#ok c) c; case (#err e) return #err e };
    let b = switch (Behaviors.inFamily(state, family.id, behaviorId)) { case (#ok b) b; case (#err e) return #err e };
    if (not b.enabled) return #err(#invalid "behavior is disabled");
    if (not Behaviors.appliesTo(b, childId)) return #err(#invalid "behavior is not assigned to this child");
    let validNote = switch (Validation.note(note)) { case (#ok n) n; case (#err e) return #err e };
    let now = Time.now();
    let validAt = switch (Validation.at(at, now)) { case (#ok t) t; case (#err e) return #err e };
    let points : Int = switch (b.kind) { case (#good) b.points; case (#oops) -(b.points : Int) };
    let input : Logs.Input = { kind = #behavior; behaviorId = ?b.id; title = b.name; emoji = ?b.emoji; note = validNote; points; earnsXp = true };
    #ok(Logs.record(state, child, family.settings.tzOffsetMinutes, input, validAt, caller, now))
  };

  public shared ({ caller }) func logCustom(childId : Types.ChildId, points : Int, reason : Text, at : ?Types.Time) : async Result.Result<Types.LogResult, Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let family = switch (Families.family(state, parent.familyId)) { case (#ok f) f; case (#err e) return #err e };
    let child = switch (Children.inFamily(state, family.id, childId)) { case (#ok c) c; case (#err e) return #err e };
    let validPoints = switch (Validation.customPoints(points)) { case (#ok p) p; case (#err e) return #err e };
    let validReason = switch (Validation.reason(reason)) { case (#ok r) r; case (#err e) return #err e };
    let now = Time.now();
    let validAt = switch (Validation.at(at, now)) { case (#ok t) t; case (#err e) return #err e };
    let input : Logs.Input = { kind = #custom; behaviorId = null; title = validReason; emoji = null; note = null; points = validPoints; earnsXp = true };
    #ok(Logs.record(state, child, family.settings.tzOffsetMinutes, input, validAt, caller, now))
  };

  // Undo: reverses the entry's applied balance and XP change.
  public shared ({ caller }) func deleteLogEntry(id : Types.LogId) : async Result.Result<Types.ChildView, Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let family = switch (Families.family(state, parent.familyId)) { case (#ok f) f; case (#err e) return #err e };
    let entry = Logs.find(state, id) ?? (return #err(#notFound));
    if (entry.familyId != family.id) return #err(#notFound);
    switch (entry.kind) {
      case (#behavior or #custom or #mission) {};
      case (#reward or #reset) return #err(#invalid "reward and reset entries cannot be undone");
    };
    let child = switch (Children.inFamily(state, family.id, entry.childId)) { case (#ok c) c; case (#err e) return #err e };
    let now = Time.now();
    // Keep missions consistent: undoing a refund reopens its mission; an oops with a done mission stays.
    switch (Missions.forLog(state, entry.id)) {
      case (?m) { ignore Missions.setStatus(state, m, #active, null, now) };
      case null {};
    };
    switch (Missions.forEntry(state, entry.id)) {
      case (?m) {
        if (m.status == #completed) return #err(#invalid "undo the mission first");
        ignore Missions.setStatus(state, m, #cancelled, null, now);
      };
      case null {};
    };
    let updated = Logs.undo(state, child, entry, now);
    Sync.recordDeletion(state, family.id, #entry, entry.id, now);
    #ok(Children.view(state, updated, family.settings.tzOffsetMinutes, now))
  };

  // Sets the balance to 0 with a #reset entry; history and XP stay.
  public shared ({ caller }) func resetPoints(childId : Types.ChildId) : async Result.Result<Types.ChildView, Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let family = switch (Families.family(state, parent.familyId)) { case (#ok f) f; case (#err e) return #err e };
    let child = switch (Children.inFamily(state, family.id, childId)) { case (#ok c) c; case (#err e) return #err e };
    let now = Time.now();
    if (child.balance > 0) {
      let input : Logs.Input = { kind = #reset; behaviorId = null; title = "Reset"; emoji = null; note = null; points = -(child.balance : Int); earnsXp = false };
      ignore Logs.record(state, child, family.settings.tzOffsetMinutes, input, now, caller, now);
    };
    let c = state.children.get(childId) ?? child;
    #ok(Children.view(state, c, family.settings.tzOffsetMinutes, now))
  };

  public query func getLevels() : async [Types.Level] {
    Levels.levels
  };
};
