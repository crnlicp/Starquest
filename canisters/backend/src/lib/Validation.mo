import Char "mo:core/Char";
import Result "mo:core/Result";
import Text "mo:core/Text";
import Types "../types";

module {
  public let maxNameLength = 40;
  public let pinLength = 4;

  public func name(raw : Text) : Result.Result<Text, Types.Error> {
    let trimmed = raw.trim(#char ' ');
    let size = trimmed.size();
    if (size == 0) return #err(#invalid "name is empty");
    if (size > maxNameLength) return #err(#invalid "name is too long");
    #ok trimmed
  };

  public func pin(raw : Text) : Result.Result<Text, Types.Error> {
    if (raw.size() != pinLength) return #err(#invalid "PIN must have 4 digits");
    for (c in raw.toIter()) {
      if (not c.isDigit()) return #err(#invalid "PIN must have 4 digits");
    };
    #ok raw
  };

  public let maxNoteLength = 200;
  public let maxBehaviorPoints = 100;
  public let maxCustomPoints = 100;
  public let maxAge = 18;
  // Backdating: up to a year back, a few minutes of clock skew forward.
  public let maxBackdateNs : Int = 31_536_000_000_000_000;
  public let maxSkewNs : Int = 300_000_000_000;

  func bounded(raw : Text, what : Text, max : Nat) : Result.Result<Text, Types.Error> {
    let trimmed = raw.trim(#char ' ');
    if (trimmed.size() == 0) return #err(#invalid(what # " is empty"));
    if (trimmed.size() > max) return #err(#invalid(what # " is too long"));
    #ok trimmed
  };

  public func emoji(raw : Text) : Result.Result<Text, Types.Error> = bounded(raw, "emoji", 16);

  public func note(raw : ?Text) : Result.Result<?Text, Types.Error> {
    switch (raw) {
      case null #ok null;
      case (?n) {
        let trimmed = n.trim(#char ' ');
        if (trimmed.size() == 0) #ok null
        else if (trimmed.size() > maxNoteLength) #err(#invalid "note is too long")
        else #ok(?trimmed)
      };
    }
  };

  public func reason(raw : Text) : Result.Result<Text, Types.Error> = bounded(raw, "reason", maxNoteLength);

  public func at(raw : ?Types.Time, now : Types.Time) : Result.Result<Types.Time, Types.Error> {
    switch (raw) {
      case null #ok now;
      case (?t) {
        if (t > now + maxSkewNs) #err(#invalid "time is in the future")
        else if (t < now - maxBackdateNs) #err(#invalid "time is too far back")
        else #ok t
      };
    }
  };

  public func dailyGoal(goal : Nat) : Result.Result<Nat, Types.Error> {
    if (goal == 0 or goal > 500) #err(#invalid "daily goal must be 1-500") else #ok goal
  };

  public func avatar(input : Types.Avatar) : Result.Result<Types.Avatar, Types.Error> {
    let character = switch (bounded(input.character, "avatar", 40)) { case (#ok v) v; case (#err e) return #err e };
    if (input.accessories.size() > 10) return #err(#invalid "too many accessories");
    for (a in input.accessories.values()) {
      switch (bounded(a, "accessory", 40)) { case (#err e) return #err e; case (#ok _) {} };
    };
    #ok { input with character }
  };

  public func child(input : Types.ChildInput, defaultGoal : Nat) : Result.Result<Types.ChildInput, Types.Error> {
    let n = switch (name(input.name)) { case (#ok v) v; case (#err e) return #err e };
    if (input.age > maxAge) return #err(#invalid "age out of range");
    let color = switch (bounded(input.favoriteColor, "favorite color", 20)) { case (#ok v) v; case (#err e) return #err e };
    let av = switch (avatar(input.avatar)) { case (#ok v) v; case (#err e) return #err e };
    let goal = switch (dailyGoal(input.dailyGoal ?? defaultGoal)) { case (#ok v) v; case (#err e) return #err e };
    #ok {
      name = n;
      age = input.age;
      avatar = av;
      favoriteColor = color;
      dailyGoal = ?goal;
    }
  };

  public func behavior(input : Types.BehaviorInput) : Result.Result<Types.BehaviorInput, Types.Error> {
    let n = switch (name(input.name)) { case (#ok v) v; case (#err e) return #err e };
    let e = switch (emoji(input.emoji)) { case (#ok v) v; case (#err err) return #err err };
    if (input.points == 0 or input.points > maxBehaviorPoints) return #err(#invalid "points must be 1-100");
    switch (input.assignedTo) {
      case (?ids) { if (ids.size() == 0) return #err(#invalid "assign to at least one child") };
      case null {};
    };
    let mission = switch (input.mission) {
      case null null;
      case (?m) {
        if (input.kind == #good) return #err(#invalid "missions are for oops behaviors");
        let s = switch (bounded(m.suggestion, "mission", maxNoteLength)) { case (#ok v) v; case (#err err) return #err err };
        if (m.refund == 0 or m.refund > input.points) return #err(#invalid "mission refund must be 1 to the behavior's points");
        ?{ suggestion = s; refund = m.refund }
      };
    };
    #ok { input with name = n; emoji = e; mission }
  };

  public func customPoints(points : Int) : Result.Result<Int, Types.Error> {
    if (points == 0 or points > 100 or points < -100) {
      #err(#invalid "points must be -100 to 100 and not 0")
    } else #ok points
  };

  public let maxRewardCost = 10_000;
  public let maxImageBytes = 100_000;

  public func reward(input : Types.RewardInput) : Result.Result<Types.RewardInput, Types.Error> {
    let n = switch (name(input.name)) { case (#ok v) v; case (#err e) return #err e };
    let e = switch (emoji(input.emoji)) { case (#ok v) v; case (#err err) return #err err };
    if (input.cost == 0 or input.cost > maxRewardCost) return #err(#invalid "cost must be 1-10000");
    switch (input.image) {
      case (#set b) {
        if (b.size() == 0) return #err(#invalid "image is empty");
        if (b.size() > maxImageBytes) return #err(#invalid "image is larger than 100 KB");
      };
      case (#keep or #remove) {};
    };
    #ok { input with name = n; emoji = e }
  };

  public func settings(s : Types.Settings) : Result.Result<Types.Settings, Types.Error> {
    if (s.tzOffsetMinutes < -720 or s.tzOffsetMinutes > 840) {
      return #err(#invalid "timezone offset out of range");
    };
    if (s.dailyGoalDefault == 0 or s.dailyGoalDefault > 500) {
      return #err(#invalid "daily goal must be 1-500");
    };
    switch (s.reminderMinute) {
      case (?m) { if (m >= 1440) return #err(#invalid "reminder time out of range") };
      case null {};
    };
    #ok s
  };
};
