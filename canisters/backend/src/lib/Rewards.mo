import Iter "mo:core/Iter";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Result "mo:core/Result";
import Types "../types";

module {
  public let maxPerFamily = 50;

  // Preloaded so a new family can start right away (spec).
  public let samples : [(Text, Text, Nat)] = [
    ("Ice cream", "🍦", 30),
    ("Extra 30 min screen time", "📺", 50),
    ("Trip to the playground", "🛝", 100),
    ("Movie night", "🎬", 150),
  ];

  public func ofFamily(state : Types.State, familyId : Types.FamilyId) : [Types.Reward] {
    state.rewards.values().filter(func r = r.familyId == familyId).toArray()
  };

  public func inFamily(state : Types.State, familyId : Types.FamilyId, id : Types.RewardId) : Result.Result<Types.Reward, Types.Error> {
    switch (state.rewards.get(id)) {
      case (?r) { if (r.familyId == familyId) #ok r else #err(#notFound) };
      case null #err(#notFound);
    }
  };

  func applyImage(state : Types.State, id : Types.RewardId, change : Types.ImageChange) : Bool {
    switch (change) {
      case (#set b) { state.rewardImages.add(id, b); true };
      case (#remove) { state.rewardImages.remove(id); false };
      case (#keep) { state.rewardImages.get(id) != null };
    }
  };

  public func add(state : Types.State, familyId : Types.FamilyId, input : Types.RewardInput, now : Types.Time) : Types.Reward {
    let id = state.nextRewardId;
    state.nextRewardId += 1;
    let reward : Types.Reward = {
      id;
      familyId;
      name = input.name;
      emoji = input.emoji;
      hasImage = applyImage(state, id, input.image);
      cost = input.cost;
      enabled = true;
      createdAt = now;
      updatedAt = now;
    };
    state.rewards.add(id, reward);
    reward
  };

  public func update(state : Types.State, r : Types.Reward, input : Types.RewardInput, now : Types.Time) : Types.Reward {
    let updated = {
      r with
      name = input.name;
      emoji = input.emoji;
      cost = input.cost;
      hasImage = applyImage(state, r.id, input.image);
      updatedAt = now;
    };
    state.rewards.add(r.id, updated);
    updated
  };

  // Pending requests for the reward are declined and saving goals pointing at it cleared.
  public func remove(state : Types.State, r : Types.Reward, caller : Principal, now : Types.Time) {
    // Collect first, then write: don't mutate a Map while iterating it.
    let open = state.requests.values().filter(func q = q.rewardId == r.id and q.status == #pending).toArray();
    for (q in open.values()) {
      state.requests.add(q.id, { q with status = #declined; decidedAt = ?now; decidedBy = ?caller; updatedAt = now });
    };
    let saving = state.children.values().filter(func c = c.savingForRewardId == ?r.id).toArray();
    for (c in saving.values()) {
      state.children.add(c.id, { c with savingForRewardId = null; updatedAt = now });
    };
    state.rewardImages.remove(r.id);
    state.rewards.remove(r.id);
  };

  public func seedSamples(state : Types.State, familyId : Types.FamilyId, now : Types.Time) {
    for ((name, emoji, cost) in samples.values()) {
      ignore add(state, familyId, { name; emoji; cost; image = #keep }, now);
    };
  };
};
