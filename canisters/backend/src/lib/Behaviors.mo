import Array "mo:core/Array";
import Text "mo:core/Text";
import Iter "mo:core/Iter";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Result "mo:core/Result";
import Types "../types";

module {
  public let maxPerFamily = 100;

  public let starters : [Types.StarterBehavior] = [
    { key = "brush-teeth"; name = "Brushed teeth"; emoji = "🪥"; points = 5; kind = #good; mission = null },
    { key = "make-bed"; name = "Made bed"; emoji = "🛏️"; points = 5; kind = #good; mission = null },
    { key = "help-sibling"; name = "Helped a sibling"; emoji = "🤝"; points = 10; kind = #good; mission = null },
    { key = "homework"; name = "Finished homework"; emoji = "📚"; points = 10; kind = #good; mission = null },
    { key = "vegetables"; name = "Ate vegetables"; emoji = "🥦"; points = 5; kind = #good; mission = null },
    { key = "kind"; name = "Was kind"; emoji = "💖"; points = 10; kind = #good; mission = null },
    { key = "bedtime"; name = "Went to bed on time"; emoji = "🌙"; points = 5; kind = #good; mission = null },
    { key = "tidy-toys"; name = "Cleaned up toys"; emoji = "🧸"; points = 5; kind = #good; mission = null },
    { key = "hitting"; name = "Hitting"; emoji = "✋"; points = 10; kind = #oops; mission = ?{ suggestion = "Say sorry and give a gentle hug"; refund = 5 } },
    { key = "shouting"; name = "Shouting"; emoji = "📢"; points = 5; kind = #oops; mission = ?{ suggestion = "Use a calm voice and say it again"; refund = 3 } },
    { key = "not-listening"; name = "Not listening"; emoji = "🙉"; points = 5; kind = #oops; mission = ?{ suggestion = "Do what was asked right away"; refund = 3 } },
    { key = "lying"; name = "Lying"; emoji = "🤥"; points = 10; kind = #oops; mission = ?{ suggestion = "Tell the truth about what happened"; refund = 5 } },
    { key = "screen-time"; name = "Screen time overuse"; emoji = "📱"; points = 5; kind = #oops; mission = ?{ suggestion = "Do a screen-free activity for 30 minutes"; refund = 3 } },
  ];

  public func ofFamily(state : Types.State, familyId : Types.FamilyId) : [Types.Behavior] {
    state.behaviors.values().filter(func b = b.familyId == familyId).toArray()
  };

  public func inFamily(state : Types.State, familyId : Types.FamilyId, id : Types.BehaviorId) : Result.Result<Types.Behavior, Types.Error> {
    switch (state.behaviors.get(id)) {
      case (?b) { if (b.familyId == familyId) #ok b else #err(#notFound) };
      case null #err(#notFound);
    }
  };

  public func appliesTo(b : Types.Behavior, childId : Types.ChildId) : Bool {
    switch (b.assignedTo) {
      case (?ids) ids.contains(childId);
      case null true;
    }
  };

  public func checkAssigned(state : Types.State, familyId : Types.FamilyId, input : Types.BehaviorInput) : Result.Result<(), Types.Error> {
    switch (input.assignedTo) {
      case (?ids) {
        for (id in ids.values()) {
          switch (state.children.get(id)) {
            case (?c) { if (c.familyId != familyId) return #err(#notFound) };
            case null return #err(#notFound);
          };
        };
        #ok
      };
      case null #ok;
    }
  };

  public func add(state : Types.State, familyId : Types.FamilyId, input : Types.BehaviorInput, starterKey : ?Text, now : Types.Time) : Types.Behavior {
    let id = state.nextBehaviorId;
    state.nextBehaviorId += 1;
    let b : Types.Behavior = {
      id;
      familyId;
      name = input.name;
      emoji = input.emoji;
      points = input.points;
      kind = input.kind;
      assignedTo = input.assignedTo;
      enabled = true;
      mission = input.mission;
      starterKey;
      createdAt = now;
      updatedAt = now;
    };
    state.behaviors.add(id, b);
    b
  };

  // Adds missing starters and re-enables disabled ones. Unknown keys are rejected before any change.
  public func enableStarters(state : Types.State, familyId : Types.FamilyId, keys : [Text], now : Types.Time) : Result.Result<(), Types.Error> {
    for (key in keys.values()) {
      if (starters.find(func s = s.key == key) == null) return #err(#invalid("unknown starter behavior: " # key));
    };
    let existing = ofFamily(state, familyId);
    for (s in starters.values()) {
      if (keys.contains(s.key)) {
        switch (existing.find(func b = b.starterKey == ?s.key)) {
          case (?b) { if (not b.enabled) state.behaviors.add(b.id, { b with enabled = true; updatedAt = now }) };
          case null {
            ignore add(state, familyId, { name = s.name; emoji = s.emoji; points = s.points; kind = s.kind; assignedTo = null; mission = s.mission }, ?s.key, now);
          };
        };
      };
    };
    #ok
  };

  public func seedStarters(state : Types.State, familyId : Types.FamilyId, now : Types.Time) {
    ignore enableStarters(state, familyId, starters.map(func s = s.key), now);
  };
};
