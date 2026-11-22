import Array "mo:core/Array";
import Iter "mo:core/Iter";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Types "../types";

module {
  public let all : [Types.Badge] = [
    { id = "first-star"; name = "First Star"; emoji = "⭐"; description = "Earned the first points" },
    { id = "streak-7"; name = "7-Day Streak"; emoji = "🔥"; description = "Reached the daily goal 7 days in a row" },
    { id = "points-100"; name = "100 Points Club"; emoji = "💯"; description = "Earned 100 points in total" },
    { id = "kindness-hero"; name = "Kindness Hero"; emoji = "💖"; description = "Was kind 10 times" },
    { id = "clean-room"; name = "Clean Room Champion"; emoji = "🧹"; description = "Tidied up or made the bed 10 times" },
    { id = "comeback-kid"; name = "Comeback Kid"; emoji = "🌈"; description = "Reached the daily goal the day after an oops" },
    { id = "make-it-right"; name = "Make It Right"; emoji = "🤝"; description = "Completed a Make It Right mission" },
    { id = "first-reward"; name = "Treasure Hunter"; emoji = "🎁"; description = "Got a first reward" },
  ];

  public let repeatTarget = 10;

  public func ofChild(state : Types.State, childId : Types.ChildId) : [Types.ChildBadge] {
    switch (state.badges.get(childId)) {
      case (?m) { m.entries().map(func(badgeId, unlockedAt) = { childId; badgeId; unlockedAt }).toArray() };
      case null [];
    }
  };

  func starterKeyOf(state : Types.State, behaviorId : ?Types.BehaviorId) : ?Text {
    switch (behaviorId) {
      case (?id) { switch (state.behaviors.get(id)) { case (?b) b.starterKey; case null null } };
      case null null;
    }
  };

  // Counts logged entries whose (still existing) behavior is one of the given starters.
  func countStarter(state : Types.State, entries : Map.Map<Types.LogId, Types.LogEntry>, keys : [Text]) : Nat {
    var n = 0;
    for (e in entries.values()) {
      switch (starterKeyOf(state, e.behaviorId)) {
        case (?k) { if (e.kind == #behavior and keys.contains(k)) n += 1 };
        case null {};
      };
    };
    n
  };

  public type Context = { xp : Nat; streak : Nat; goalReached : Bool };

  // Unlocks badges earned by `entry`; each badge unlocks once and is kept even if the entry is undone.
  public func evaluate(state : Types.State, entry : Types.LogEntry, ctx : Context, now : Types.Time) : [Types.BadgeId] {
    let owned = switch (state.badges.get(entry.childId)) {
      case (?m) m;
      case null {
        let m = Map.empty<Types.BadgeId, Types.Time>();
        state.badges.add(entry.childId, m);
        m
      };
    };
    let entries = switch (state.logs.get(entry.childId)) { case (?m) m; case null Map.empty<Types.LogId, Types.LogEntry>() };
    let fresh = List.empty<Types.BadgeId>();
    func unlock(id : Types.BadgeId, earned : () -> Bool) {
      if (owned.get(id) == null and earned()) {
        owned.add(id, now);
        fresh.add(id);
      };
    };
    let key = starterKeyOf(state, entry.behaviorId);
    unlock("first-star", func() = entry.xpDelta > 0);
    unlock("streak-7", func() = ctx.streak >= 7);
    unlock("points-100", func() = ctx.xp >= 100);
    unlock("kindness-hero", func() = key == ?"kind" and countStarter(state, entries, ["kind"]) >= repeatTarget);
    unlock("clean-room", func() = (key == ?"tidy-toys" or key == ?"make-bed") and countStarter(state, entries, ["tidy-toys", "make-bed"]) >= repeatTarget);
    unlock("comeback-kid", func() = ctx.goalReached and entries.values().any(func e = e.day == entry.day - 1 and e.kind == #behavior and e.points < 0));
    unlock("make-it-right", func() = entry.kind == #mission);
    unlock("first-reward", func() = entry.kind == #reward);
    fresh.toArray()
  };
};
