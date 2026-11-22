import Array "mo:core/Array";
import Iter "mo:core/Iter";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Badges "Badges";
import Children "Children";
import Logs "Logs";
import Types "../types";

module {
  // Deletions older than this are dropped; clients syncing from further back must reload.
  public let retentionNs : Int = 2_592_000_000_000_000; // 30 days

  public func recordDeletion(state : Types.State, familyId : Types.FamilyId, kind : Types.DeletedKind, id : Nat, now : Types.Time) {
    // Rebuilt instead of List.retain, which traps on an empty list (core 2.7.0).
    let list = switch (state.deletions.get(familyId)) {
      case (?l) { l.filter(func d = d.at >= now - retentionNs) };
      case null { List.empty<Types.Deletion>() };
    };
    state.deletions.add(familyId, list);
    list.add({ kind; id; at = now });
  };

  // Everything in the family changed at or after `since` (inclusive, so nothing is missed at the boundary).
  public func changes(state : Types.State, family : Types.Family, only : ?Types.ChildId, since : Types.Time, now : Types.Time) : Types.Changes {
    let fid = family.id;
    let mine = func(id : Types.ChildId) : Bool = switch (only) { case (?c) c == id; case null true };
    let kids = Children.ofFamily(state, fid).filter(func c = mine(c.id));
    let entries = List.empty<Types.LogEntry>();
    let badges = List.empty<Types.ChildBadge>();
    for (c in kids.values()) {
      for (e in Logs.entriesOf(state, c.id).values()) { if (e.createdAt >= since) entries.add(e) };
      for (b in Badges.ofChild(state, c.id).values()) { if (b.unlockedAt >= since) badges.add(b) };
    };
    let deleted = switch (state.deletions.get(fid)) {
      case (?l) { l.values().filter(func d = d.at >= since).toArray() };
      case null [];
    };
    {
      serverTime = now;
      complete = since <= 0 or since >= now - retentionNs;
      children = kids.filter(func c = c.updatedAt >= since).map(func c = Children.view(state, c, family.settings.tzOffsetMinutes, now));
      behaviors = state.behaviors.values().filter(func b = b.familyId == fid and b.updatedAt >= since).toArray();
      rewards = state.rewards.values().filter(func r = r.familyId == fid and r.updatedAt >= since).toArray();
      requests = state.requests.values().filter(func q = q.familyId == fid and mine(q.childId) and q.updatedAt >= since).toArray();
      missions = state.missions.values().filter(func m = m.familyId == fid and mine(m.childId) and m.updatedAt >= since).toArray();
      entries = entries.toArray();
      badges = badges.toArray();
      deleted;
    }
  };
};
