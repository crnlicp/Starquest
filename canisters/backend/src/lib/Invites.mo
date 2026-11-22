import Array "mo:core/Array";
import Blob "mo:core/Blob";
import Iter "mo:core/Iter";
import Map "mo:core/Map";
import Nat8 "mo:core/Nat8";
import Char "mo:core/Char";
import Text "mo:core/Text";
import Types "../types";

module {
  public let ttlNs : Nat = 604_800_000_000_000; // 7 days
  public let maxActivePerFamily = 10;

  let hexDigits : [Char] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];

  public func hex(bytes : Blob) : Text {
    var out = "";
    for (b in bytes.values()) {
      let n = b.toNat();
      out #= hexDigits[n / 16].toText() # hexDigits[n % 16].toText();
    };
    out
  };

  public func pruneExpired(state : Types.State, now : Types.Time) {
    let expired = state.invites.entries().filter(func(_, i) = i.expiresAt <= now).map(func(t, _) = t).toArray();
    for (token in expired.values()) state.invites.remove(token);
  };

  public func activeCount(state : Types.State, familyId : Types.FamilyId) : Nat {
    state.invites.values().filter(func i = i.familyId == familyId).size()
  };
};
