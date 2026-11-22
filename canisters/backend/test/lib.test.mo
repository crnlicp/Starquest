import Map "mo:core/Map";
import Int "mo:core/Int";
import Nat "mo:core/Nat";
import AvatarItems "../src/lib/AvatarItems";
import Days "../src/lib/Days";
import Levels "../src/lib/Levels";
import Pin "../src/lib/Pin";
import Points "../src/lib/Points";

// Balance floors at zero; XP only grows on gains.
let a = Points.apply(3, -10);
assert a.balance == 0 and a.balanceDelta == -3 and a.xpDelta == 0;
let b = Points.apply(3, 5);
assert b.balance == 8 and b.balanceDelta == 5 and b.xpDelta == 5;

// Undo of an oops restores only what was taken; undo of a gain floors at zero.
let r1 = Points.revert(0, 20, -3, 0);
assert r1.balance == 3 and r1.xp == 20;
let r2 = Points.revert(2, 4, 5, 5);
assert r2.balance == 0 and r2.xp == 0;

// Levels.
assert Levels.forXp(0).number == 1;
assert Levels.forXp(49).number == 1;
assert Levels.forXp(50).number == 2;
assert Levels.forXp(5000).title == "Superstar Legend";
assert Levels.nextThreshold(50) == ?120;
assert Levels.nextThreshold(2000) == null;

// Days: tz offset shifts the boundary.
let day : Int = 86_400_000_000_000;
assert Days.dayOf(0, 0) == 0;
assert Days.dayOf(day - 1, 0) == 0;
assert Days.dayOf(day - 1, 60) == 1;
assert Days.dayOf(0, -60) == -1;

// Streaks: today open keeps yesterday's chain; a gap breaks it.
let totals = Map.empty<Int, Nat>();
totals.add(10, 20);
totals.add(11, 25);
totals.add(12, 5);
assert Days.streak(totals, 20, 12) == 2;
totals.add(12, 20);
assert Days.streak(totals, 20, 12) == 3;
assert Days.streak(totals, 20, 14) == 0;
totals.remove(11);
assert Days.streak(totals, 20, 12) == 1;

// Avatar items: unlocks by level and badge, one per slot, worn items stay allowed.
assert AvatarItems.check(1, [], [], ["hat-party", "glasses-round"]) == #ok;
assert AvatarItems.check(1, [], [], ["hat-crown"]) != #ok;
assert AvatarItems.check(3, [], [], ["hat-crown", "bg-rainbow"]) == #ok;
assert AvatarItems.check(1, ["first-star"], [], ["hat-bow"]) == #ok;
assert AvatarItems.check(9, [], [], ["hat-party", "hat-cap"]) != #ok;
assert AvatarItems.check(1, [], [], ["nope"]) != #ok;
assert AvatarItems.check(1, [], ["hat-crown"], ["hat-crown"]) == #ok;

// PIN: salted hash matches only the same PIN; five failures lock for a minute.
let salt : Blob = "\01\02\03";
let stored = Pin.make(salt, "1234");
assert Pin.matches(stored, "1234");
assert not Pin.matches(stored, "4321");
assert Pin.make("\09", "1234").hash != stored.hash;
var tries : ?{ failures : Nat; lockedUntil : Int } = null;
for (_ in Nat.range(0, 4)) { tries := ?Pin.afterFailure(tries, 0) };
assert Pin.lockedFor(tries, 0) == null;
tries := ?Pin.afterFailure(tries, 0);
assert Pin.lockedFor(tries, 0) == ?Pin.lockNs;
assert Pin.lockedFor(tries, Pin.lockNs) == null;
