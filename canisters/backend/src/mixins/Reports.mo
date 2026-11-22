import Array "mo:core/Array";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Badges "../lib/Badges";
import Children "../lib/Children";
import Days "../lib/Days";
import Families "../lib/Families";
import Reports "../lib/Reports";
import Sync "../lib/Sync";
import Types "../types";

mixin (state : Types.State) {
  public query ({ caller }) func getChildStats(childId : Types.ChildId, range : Types.Range) : async Result.Result<Types.ChildStats, Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    if (not Families.allows(access, childId)) return #err(#notAuthorized);
    let family = switch (Families.family(state, access.familyId)) { case (#ok f) f; case (#err e) return #err e };
    let child = switch (Children.inFamily(state, family.id, childId)) { case (#ok c) c; case (#err e) return #err e };
    #ok(Reports.stats(state, child, range, Days.dayOf(Time.now(), family.settings.tzOffsetMinutes)))
  };

  public query ({ caller }) func getWeeklySummary(childId : Types.ChildId) : async Result.Result<Types.WeeklySummary, Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    if (not Families.allows(access, childId)) return #err(#notAuthorized);
    let family = switch (Families.family(state, access.familyId)) { case (#ok f) f; case (#err e) return #err e };
    let child = switch (Children.inFamily(state, family.id, childId)) { case (#ok c) c; case (#err e) return #err e };
    #ok(Reports.weekly(state, child, Days.dayOf(Time.now(), family.settings.tzOffsetMinutes)))
  };

  public query ({ caller }) func getHistory(filter : Types.HistoryFilter, cursor : ?Types.LogId, limit : Nat) : async Result.Result<Types.HistoryPage, Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    switch (filter.childId) {
      case (?id) { if (not Families.allows(access, id)) return #err(#notAuthorized) };
      case null {};
    };
    let wanted = switch (access.childId) { case (?own) ?own; case null filter.childId };
    let ids = switch (wanted) {
      case (?id) {
        switch (Children.inFamily(state, access.familyId, id)) { case (#err e) return #err e; case (#ok _) {} };
        [id]
      };
      case null { Children.ofFamily(state, access.familyId).map(func c = c.id) };
    };
    Reports.history(state, ids, filter, cursor, limit)
  };

  public query func getBadgeDefinitions() : async [Types.Badge] {
    Badges.all
  };

  public query ({ caller }) func listChildBadges(childId : Types.ChildId) : async Result.Result<[Types.ChildBadge], Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    if (not Families.allows(access, childId)) return #err(#notAuthorized);
    switch (Children.inFamily(state, access.familyId, childId)) { case (#err e) return #err e; case (#ok _) {} };
    #ok(Badges.ofChild(state, childId))
  };

  // A parent gets the whole family; a paired device only its own child.
  public query ({ caller }) func getChangesSince(since : Types.Time) : async Result.Result<Types.Changes, Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    let family = switch (Families.family(state, access.familyId)) { case (#ok f) f; case (#err e) return #err e };
    #ok(Sync.changes(state, family, access.childId, since, Time.now()))
  };
};
