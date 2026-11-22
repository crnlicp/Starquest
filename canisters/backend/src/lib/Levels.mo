import Array "mo:core/Array";
import Option "mo:core/Option";
import Types "../types";

module {
  public let levels : [Types.Level] = [
    { number = 1; title = "Little Star"; minXp = 0 },
    { number = 2; title = "Bright Star"; minXp = 50 },
    { number = 3; title = "Shining Star"; minXp = 120 },
    { number = 4; title = "Rising Star"; minXp = 220 },
    { number = 5; title = "Super Star"; minXp = 350 },
    { number = 6; title = "Star Explorer"; minXp = 520 },
    { number = 7; title = "Star Captain"; minXp = 750 },
    { number = 8; title = "Star Hero"; minXp = 1050 },
    { number = 9; title = "Galaxy Champion"; minXp = 1450 },
    { number = 10; title = "Superstar Legend"; minXp = 2000 },
  ];

  public func forXp(xp : Nat) : Types.Level {
    var current = levels[0];
    for (l in levels.values()) {
      if (xp >= l.minXp) current := l;
    };
    current
  };

  public func nextThreshold(xp : Nat) : ?Nat {
    levels.find(func l = l.minXp > xp).map(func l = l.minXp)
  };
};
