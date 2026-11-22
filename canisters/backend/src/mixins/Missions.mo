import Result "mo:core/Result";
import Time "mo:core/Time";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Children "../lib/Children";
import Families "../lib/Families";
import Logs "../lib/Logs";
import Missions "../lib/Missions";
import Types "../types";

mixin (state : Types.State) {
  public shared ({ caller }) func startMission(oopsEntryId : Types.LogId) : async Result.Result<Types.MissionTask, Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let entry = Logs.find(state, oopsEntryId) ?? (return #err(#notFound));
    if (entry.familyId != parent.familyId) return #err(#notFound);
    Missions.start(state, entry, Time.now())
  };

  // Parent confirms the child made it right: refunds points (balance only, no XP).
  public shared ({ caller }) func confirmMission(id : Types.MissionId) : async Result.Result<Types.LogResult, Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let family = switch (Families.family(state, parent.familyId)) { case (#ok f) f; case (#err e) return #err e };
    let m = state.missions.get(id) ?? (return #err(#notFound));
    if (m.familyId != family.id) return #err(#notFound);
    if (m.status != #active) return #err(#invalid "mission is not active");
    let child = switch (Children.inFamily(state, family.id, m.childId)) { case (#ok c) c; case (#err e) return #err e };
    let now = Time.now();
    let input : Logs.Input = { kind = #mission; behaviorId = null; title = m.suggestion; emoji = ?"🤝"; note = null; points = m.refund; earnsXp = false };
    let result = Logs.record(state, child, family.settings.tzOffsetMinutes, input, now, caller, now);
    ignore Missions.setStatus(state, m, #completed, ?result.entry.id, now);
    #ok result
  };

  public shared ({ caller }) func cancelMission(id : Types.MissionId) : async Result.Result<(), Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let m = state.missions.get(id) ?? (return #err(#notFound));
    if (m.familyId != parent.familyId) return #err(#notFound);
    if (m.status != #active) return #err(#invalid "mission is not active");
    ignore Missions.setStatus(state, m, #cancelled, null, Time.now());
    #ok
  };

  public query ({ caller }) func listActiveMissions() : async Result.Result<[Types.MissionTask], Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    #ok(Missions.active(state, parent.familyId))
  };
};
