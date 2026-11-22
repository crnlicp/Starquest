import Array "mo:core/Array";
import Text "mo:core/Text";
import Result "mo:core/Result";
import Badges "Badges";
import Levels "Levels";
import Types "../types";

module {
  public let items : [Types.AvatarItem] = [
    { id = "hat-party"; slot = #hat; unlock = #free },
    { id = "hat-bow"; slot = #hat; unlock = #badge "first-star" },
    { id = "hat-cap"; slot = #hat; unlock = #level 2 },
    { id = "hat-crown"; slot = #hat; unlock = #level 3 },
    { id = "hat-flowers"; slot = #hat; unlock = #badge "kindness-hero" },
    { id = "hat-wizard"; slot = #hat; unlock = #level 5 },
    { id = "hat-pirate"; slot = #hat; unlock = #level 6 },
    { id = "hat-propeller"; slot = #hat; unlock = #badge "streak-7" },
    { id = "hat-top"; slot = #hat; unlock = #level 8 },
    { id = "glasses-round"; slot = #glasses; unlock = #free },
    { id = "glasses-sun"; slot = #glasses; unlock = #level 2 },
    { id = "glasses-star"; slot = #glasses; unlock = #level 4 },
    { id = "glasses-heart"; slot = #glasses; unlock = #badge "make-it-right" },
    { id = "glasses-goggles"; slot = #glasses; unlock = #level 7 },
    { id = "bg-sky"; slot = #background; unlock = #free },
    { id = "bg-meadow"; slot = #background; unlock = #badge "clean-room" },
    { id = "bg-rainbow"; slot = #background; unlock = #level 3 },
    { id = "bg-ocean"; slot = #background; unlock = #level 4 },
    { id = "bg-space"; slot = #background; unlock = #level 6 },
    { id = "bg-sunset"; slot = #background; unlock = #badge "comeback-kid" },
    { id = "bg-galaxy"; slot = #background; unlock = #level 10 },
  ];

  public func isUnlocked(item : Types.AvatarItem, level : Nat, badges : [Types.BadgeId]) : Bool {
    switch (item.unlock) {
      case (#free) true;
      case (#level n) level >= n;
      case (#badge b) badges.contains(b);
    }
  };

  func sameSlot(a : Types.AvatarSlot, b : Types.AvatarSlot) : Bool {
    switch (a, b) {
      case (#hat, #hat) true;
      case (#glasses, #glasses) true;
      case (#background, #background) true;
      case _ false;
    }
  };

  // Items already worn stay allowed, so an undo that lowers XP does not lock the child out of an edit.
  public func check(level : Nat, badges : [Types.BadgeId], worn : [Text], next : [Text]) : Result.Result<(), Types.Error> {
    let picked = next.map(func id = items.find(func i = i.id == id));
    for (p in picked.values()) {
      let item = switch (p) { case (?i) i; case null return #err(#invalid "unknown avatar item") };
      if (not isUnlocked(item, level, badges) and not worn.contains(item.id)) return #err(#invalid "avatar item is locked");
      let inSlot = picked.filter(func q = switch (q) { case (?o) sameSlot(o.slot, item.slot); case null false });
      if (inSlot.size() > 1) return #err(#invalid "one avatar item per slot");
    };
    #ok
  };

  public func badgeIds(state : Types.State, child : Types.Child) : [Types.BadgeId] {
    Badges.ofChild(state, child.id).map(func b = b.badgeId)
  };

  public func levelOf(child : Types.Child) : Nat = Levels.forXp(child.xp).number;

  public func views(state : Types.State, child : Types.Child) : [Types.AvatarItemView] {
    let level = levelOf(child);
    let badges = badgeIds(state, child);
    items.map(func i = { i with unlocked = isUnlocked(i, level, badges) })
  };
};
