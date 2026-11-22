import Iter "mo:core/Iter";
import Int "mo:core/Int";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Result "mo:core/Result";
import Types "../types";

module {
  // The live (not cancelled) mission for an oops entry, if any.
  public func forEntry(state : Types.State, entryId : Types.LogId) : ?Types.MissionTask {
    state.missions.values().find(func m = m.entryId == entryId and m.status != #cancelled)
  };

  public func forLog(state : Types.State, logId : Types.LogId) : ?Types.MissionTask {
    state.missions.values().find(func m = m.logId == ?logId)
  };

  public func active(state : Types.State, familyId : Types.FamilyId) : [Types.MissionTask] {
    state.missions.values().filter(func m = m.familyId == familyId and m.status == #active).toArray()
  };

  public func start(state : Types.State, entry : Types.LogEntry, now : Types.Time) : Result.Result<Types.MissionTask, Types.Error> {
    if (entry.kind != #behavior or entry.points >= 0) return #err(#invalid "missions are for oops entries");
    let b = switch (entry.behaviorId) {
      case (?id) { state.behaviors.get(id) ?? (return #err(#invalid "the behavior no longer exists")) };
      case null return #err(#invalid "missions are for oops entries");
    };
    let m = b.mission ?? (return #err(#invalid "this behavior has no mission"));
    if (forEntry(state, entry.id) != null) return #err(#alreadyExists);
    let id = state.nextMissionId;
    state.nextMissionId += 1;
    let task : Types.MissionTask = {
      id;
      familyId = entry.familyId;
      childId = entry.childId;
      entryId = entry.id;
      suggestion = m.suggestion;
      // Never refund more than the oops actually took (it may have hit the zero floor).
      refund = Nat.min(m.refund, Int.abs(entry.balanceDelta));
      status = #active;
      logId = null;
      createdAt = now;
      updatedAt = now;
    };
    state.missions.add(id, task);
    #ok task
  };

  public func setStatus(state : Types.State, m : Types.MissionTask, status : Types.MissionStatus, logId : ?Types.LogId, now : Types.Time) : Types.MissionTask {
    let updated = { m with status; logId; updatedAt = now };
    state.missions.add(m.id, updated);
    updated
  };
};
