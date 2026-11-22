import Int "mo:core/Int";

module {
  public type Applied = { balance : Nat; balanceDelta : Int; xpDelta : Nat };

  public func subFloor(a : Nat, b : Nat) : Nat {
    if (b >= a) 0 else Int.abs((a : Int) - b)
  };

  // Balance never drops below zero; only gains earn XP.
  public func apply(balance : Nat, delta : Int) : Applied {
    let raw : Int = balance + delta;
    let newBalance = if (raw < 0) 0 else Int.abs(raw);
    {
      balance = newBalance;
      balanceDelta = (newBalance : Int) - balance;
      xpDelta = if (delta > 0) Int.abs(delta) else 0;
    }
  };

  public func revert(balance : Nat, xp : Nat, balanceDelta : Int, xpDelta : Nat) : { balance : Nat; xp : Nat } {
    let raw : Int = balance - balanceDelta;
    { balance = if (raw < 0) 0 else Int.abs(raw); xp = subFloor(xp, xpDelta) }
  };
};
