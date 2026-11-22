import Array "mo:core/Array";
import Iter "mo:core/Iter";
import Result "mo:core/Result";
import Text "mo:core/Text";
import Types "../types";

module {
  public let length = 3;

  func key(a : Types.Animal) : Text {
    switch (a) {
      case (#cat) "cat";
      case (#dog) "dog";
      case (#lion) "lion";
      case (#panda) "panda";
      case (#frog) "frog";
      case (#owl) "owl";
      case (#fox) "fox";
      case (#bear) "bear";
      case (#rabbit) "rabbit";
      case (#penguin) "penguin";
      case (#monkey) "monkey";
      case (#unicorn) "unicorn";
    }
  };

  // Order matters and repeats are allowed: 12^3 combinations, so the lockout does the real work.
  public func secret(animals : [Types.Animal]) : Result.Result<Text, Types.Error> {
    if (animals.size() != length) return #err(#invalid "picture password needs 3 animals");
    #ok(animals.values().map(key).join("|"))
  };
};
