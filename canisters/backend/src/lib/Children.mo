import Array "mo:core/Array";
import Iter "mo:core/Iter";
import Int "mo:core/Int";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Result "mo:core/Result";
import Days "Days";
import Levels "Levels";
import Types "../types";
import Devices "Devices";

module {
  public let maxPerFamily = 20;

  public func inFamily(state : Types.State, familyId : Types.FamilyId, id : Types.ChildId) : Result.Result<Types.Child, Types.Error> {
    switch (state.children.get(id)) {
      case (?c) { if (c.familyId == familyId) #ok c else #err(#notFound) };
      case null #err(#notFound);
    }
  };

  public func ofFamily(state : Types.State, familyId : Types.FamilyId) : [Types.Child] {
    state.children.values().filter(func c = c.familyId == familyId).toArray()
  };

  public func create(state : Types.State, familyId : Types.FamilyId, input : Types.ChildInput, goal : Nat, now : Types.Time) : Types.Child {
    let id = state.nextChildId;
    state.nextChildId += 1;
    let child : Types.Child = {
      id;
      familyId;
      name = input.name;
      age = input.age;
      avatar = input.avatar;
      favoriteColor = input.favoriteColor;
      dailyGoal = goal;
      balance = 0;
      xp = 0;
      savingForRewardId = null;
      picture = null;
      createdAt = now;
      updatedAt = now;
    };
    state.children.add(id, child);
    child
  };

  public func remove(state : Types.State, id : Types.ChildId) {
    switch (state.logs.get(id)) {
      case (?entries) { for (logId in entries.keys()) state.logOwner.remove(logId) };
      case null {};
    };
    state.logs.remove(id);
    state.dayXp.remove(id);
    state.badges.remove(id);
    // Collect first: removing while iterating a Map is unsafe.
    let requestIds = state.requests.values().filter(func q = q.childId == id).map(func q = q.id).toArray();
    for (q in requestIds.values()) state.requests.remove(q);
    let missionIds = state.missions.values().filter(func m = m.childId == id).map(func m = m.id).toArray();
    for (m in missionIds.values()) state.missions.remove(m);
    Devices.removeChild(state, id);
    state.children.remove(id);
    // Drop the child from behaviors assigned to specific children (collected first, see above).
    let assigned = state.behaviors.values().filter(func b = switch (b.assignedTo) { case (?ids) ids.contains(id); case null false }).toArray();
    for (b in assigned.values()) {
      let rest = (b.assignedTo ?? []).filter(func c = c != id);
      state.behaviors.add(b.id, { b with assignedTo = if (rest.size() == 0) null else ?rest });
    };
  };

  public func view(state : Types.State, c : Types.Child, tzOffsetMinutes : Int, now : Types.Time) : Types.ChildView {
    let today = Days.dayOf(now, tzOffsetMinutes);
    let (todayPoints, streak) = switch (state.dayXp.get(c.id)) {
      case (?t) { (t.get(today) ?? 0, Days.streak(t, c.dailyGoal, today)) };
      case null { (0, 0) };
    };
    {
      id = c.id;
      familyId = c.familyId;
      name = c.name;
      age = c.age;
      avatar = c.avatar;
      favoriteColor = c.favoriteColor;
      dailyGoal = c.dailyGoal;
      balance = c.balance;
      xp = c.xp;
      level = Levels.forXp(c.xp);
      nextLevelXp = Levels.nextThreshold(c.xp);
      todayPoints;
      streak;
      savingForRewardId = c.savingForRewardId;
      hasPicture = c.picture != null;
      createdAt = c.createdAt;
      updatedAt = c.updatedAt;
    }
  };
};
