import Iter "mo:core/Iter";
import Array "mo:core/Array";
import Int "mo:core/Int";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Result "mo:core/Result";
import Logs "Logs";
import Types "../types";

module {
  public let maxPage = 100;
  public let topCount = 5;

  // (days covered, days per bucket); ranges are rolling and end today.
  func span(range : Types.Range) : (Nat, Nat) {
    switch (range) {
      case (#today) (1, 1);
      case (#week) (7, 1);
      case (#month) (30, 1);
      case (#year) (364, 7);
    }
  };

  public func stats(state : Types.State, child : Types.Child, range : Types.Range, today : Int) : Types.ChildStats {
    let (days, size) = span(range);
    let fromDay = today - days + 1;
    let n = days / size;
    let earnedBy = Array.repeat<Nat>(0, n).toVarArray<Nat>();
    let lostBy = Array.repeat<Nat>(0, n).toVarArray<Nat>();
    var earned = 0;
    var lost = 0;
    var refunded = 0;
    var spent = 0;
    var good = 0;
    var oops = 0;
    let counts = Map.empty<Types.BehaviorId, Types.BehaviorCount>();
    for (e in Logs.entriesOf(state, child.id).values()) {
      if (e.day >= fromDay and e.day <= today) {
        let i = Int.abs(e.day - fromDay) / size;
        earned += e.xpDelta;
        earnedBy[i] += e.xpDelta;
        let taken = if (e.balanceDelta < 0) Int.abs(e.balanceDelta) else 0;
        switch (e.kind) {
          case (#behavior or #custom) {
            if (e.points > 0) good += 1 else oops += 1;
            lost += taken;
            lostBy[i] += taken;
          };
          case (#mission) { refunded += Int.abs(e.balanceDelta) };
          case (#reward) { spent += taken };
          case (#reset) {};
        };
        switch (e.behaviorId) {
          case (?bid) {
            let c = counts.get(bid) ?? {
              behaviorId = bid;
              title = e.title;
              emoji = e.emoji;
              kind = if (e.points > 0) #good else #oops;
              count = 0;
            };
            counts.add(bid, { c with count = c.count + 1 });
          };
          case null {};
        };
      };
    };
    let top = counts.values().toArray().sort(func(a, b) = Nat.compare(b.count, a.count));
    {
      childId = child.id;
      range;
      fromDay;
      toDay = today;
      earned;
      lost;
      refunded;
      spent;
      goodCount = good;
      oopsCount = oops;
      buckets = Array.tabulate<Types.Bucket>(n, func i = { startDay = fromDay + i * size; days = size; earned = earnedBy[i]; lost = lostBy[i] });
      topBehaviors = top.sliceToArray(0, topCount);
    }
  };

  public func weekly(state : Types.State, child : Types.Child, today : Int) : Types.WeeklySummary {
    let s = stats(state, child, #week, today);
    {
      childId = child.id;
      name = child.name;
      fromDay = s.fromDay;
      toDay = s.toDay;
      earned = s.earned;
      goodCount = s.goodCount;
      oopsCount = s.oopsCount;
      topBehavior = s.topBehaviors.find(func b = b.kind == #good);
    }
  };

  func matches(e : Types.LogEntry, f : Types.HistoryFilter) : Bool {
    (f.kind == null or f.kind == ?e.kind)
    and (switch (f.fromDay) { case (?d) e.day >= d; case null true })
    and (switch (f.toDay) { case (?d) e.day <= d; case null true })
  };

  public func history(state : Types.State, childIds : [Types.ChildId], filter : Types.HistoryFilter, cursor : ?Types.LogId, limit : Nat) : Result.Result<Types.HistoryPage, Types.Error> {
    if (limit == 0 or limit > maxPage) return #err(#invalid "limit must be 1-100");
    let found = List.empty<Types.LogEntry>();
    for (id in childIds.values()) {
      for (e in Logs.entriesOf(state, id).values()) {
        let beforeCursor = switch (cursor) { case (?c) e.id < c; case null true };
        if (beforeCursor and matches(e, filter)) found.add(e);
      };
    };
    let sorted = found.toArray().sort(func(a, b) = Nat.compare(b.id, a.id));
    let page = sorted.sliceToArray(0, limit);
    #ok {
      entries = page;
      nextCursor = if (sorted.size() > limit) ?page[limit - 1].id else null;
    }
  };
};
