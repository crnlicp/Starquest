import Int "mo:core/Int";
import Option "mo:core/Option";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Badges "Badges";
import Days "Days";
import Levels "Levels";
import Points "Points";
import Types "../types";

module {
  public type Input = {
    kind : Types.LogKind;
    behaviorId : ?Types.BehaviorId;
    title : Text;
    emoji : ?Text;
    note : ?Text;
    points : Int;
    // false for mission refunds, rewards and resets: they move the balance only.
    earnsXp : Bool;
  };

  func logsOf(state : Types.State, childId : Types.ChildId) : Map.Map<Types.LogId, Types.LogEntry> {
    switch (state.logs.get(childId)) {
      case (?m) m;
      case null {
        let m = Map.empty<Types.LogId, Types.LogEntry>();
        state.logs.add(childId, m);
        m
      };
    }
  };

  func totalsOf(state : Types.State, childId : Types.ChildId) : Map.Map<Int, Nat> {
    switch (state.dayXp.get(childId)) {
      case (?m) m;
      case null {
        let m = Map.empty<Int, Nat>();
        state.dayXp.add(childId, m);
        m
      };
    }
  };

  public func record(state : Types.State, child : Types.Child, tzOffsetMinutes : Int, input : Input, at : Types.Time, caller : Principal, now : Types.Time) : Types.LogResult {
    let raw = Points.apply(child.balance, input.points);
    let applied = if (input.earnsXp) raw else ({ raw with xpDelta = 0 });
    let newXp = child.xp + applied.xpDelta;
    let day = Days.dayOf(at, tzOffsetMinutes);
    let id = state.nextLogId;
    state.nextLogId += 1;
    let entry : Types.LogEntry = {
      id;
      familyId = child.familyId;
      childId = child.id;
      behaviorId = input.behaviorId;
      kind = input.kind;
      title = input.title;
      emoji = input.emoji;
      note = input.note;
      points = input.points;
      balanceDelta = applied.balanceDelta;
      xpDelta = applied.xpDelta;
      at;
      day;
      createdBy = caller;
      createdAt = now;
    };
    logsOf(state, child.id).add(id, entry);
    state.logOwner.add(id, child.id);
    let totals = totalsOf(state, child.id);
    let dayBefore = totals.get(day) ?? 0;
    let dayAfter = dayBefore + applied.xpDelta;
    if (applied.xpDelta > 0) totals.add(day, dayAfter);
    state.children.add(child.id, { child with balance = applied.balance; xp = newXp; updatedAt = now });
    let before = Levels.forXp(child.xp);
    let after = Levels.forXp(newXp);
    let goalReached = dayBefore < child.dailyGoal and dayAfter >= child.dailyGoal;
    let streak = Days.streak(totals, child.dailyGoal, Days.dayOf(now, tzOffsetMinutes));
    {
      entry;
      newBalance = applied.balance;
      newXp;
      leveledUp = if (after.number > before.number) ?after else null;
      newBadges = Badges.evaluate(state, entry, { xp = newXp; streak; goalReached }, now);
      goalReached;
      dayPoints = dayAfter;
      streak;
    }
  };

  public func find(state : Types.State, id : Types.LogId) : ?Types.LogEntry {
    switch (state.logOwner.get(id)) {
      case (?childId) { state.logs.get(childId).chain(func m = m.get(id)) };
      case null null;
    }
  };

  public func entriesOf(state : Types.State, childId : Types.ChildId) : Map.Map<Types.LogId, Types.LogEntry> {
    state.logs.get(childId) ?? Map.empty()
  };

  public func undo(state : Types.State, child : Types.Child, entry : Types.LogEntry, now : Types.Time) : Types.Child {
    logsOf(state, child.id).remove(entry.id);
    state.logOwner.remove(entry.id);
    if (entry.xpDelta > 0) {
      let totals = totalsOf(state, child.id);
      let left = Points.subFloor(totals.get(entry.day) ?? 0, entry.xpDelta);
      if (left == 0) totals.remove(entry.day) else totals.add(entry.day, left);
    };
    let r = Points.revert(child.balance, child.xp, entry.balanceDelta, entry.xpDelta);
    let updated = { child with balance = r.balance; xp = r.xp; updatedAt = now };
    state.children.add(child.id, updated);
    updated
  };
};
