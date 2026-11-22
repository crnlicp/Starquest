import Int "mo:core/Int";
import Map "mo:core/Map";

module {
  let dayNs : Int = 86_400_000_000_000;
  let minuteNs : Int = 60_000_000_000;

  public func dayOf(t : Int, tzOffsetMinutes : Int) : Int {
    let local = t + tzOffsetMinutes * minuteNs;
    if (local >= 0) local / dayNs else (local - dayNs + 1) / dayNs
  };

  // Consecutive days meeting the goal, ending today (or yesterday while today is still open).
  public func streak(totals : Map.Map<Int, Nat>, goal : Nat, today : Int) : Nat {
    if (goal == 0) return 0;
    func met(d : Int) : Bool { (totals.get(d) ?? 0) >= goal };
    var d = if (met(today)) today else today - 1;
    var n = 0;
    while (met(d)) {
      n += 1;
      d -= 1;
    };
    n
  };
};
