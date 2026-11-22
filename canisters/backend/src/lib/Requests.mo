import Iter "mo:core/Iter";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Result "mo:core/Result";
import Logs "Logs";
import Types "../types";

module {
  public let maxPendingPerChild = 20;

  public func pending(state : Types.State, familyId : Types.FamilyId) : [Types.RewardRequest] {
    state.requests.values().filter(func q = q.familyId == familyId and q.status == #pending).toArray()
  };

  public func create(state : Types.State, child : Types.Child, reward : Types.Reward, caller : Principal, now : Types.Time) : Result.Result<Types.RewardRequest, Types.Error> {
    if (not reward.enabled) return #err(#invalid "reward is disabled");
    if (child.balance < reward.cost) return #err(#invalid "not enough points");
    var open = 0;
    for (q in state.requests.values()) {
      if (q.childId == child.id and q.status == #pending) {
        if (q.rewardId == reward.id) return #err(#alreadyExists);
        open += 1;
      };
    };
    if (open >= maxPendingPerChild) return #err(#invalid "too many open requests");
    let id = state.nextRequestId;
    state.nextRequestId += 1;
    let q : Types.RewardRequest = {
      id;
      familyId = child.familyId;
      childId = child.id;
      rewardId = reward.id;
      title = reward.name;
      emoji = reward.emoji;
      cost = reward.cost;
      status = #pending;
      logId = null;
      createdBy = caller;
      createdAt = now;
      decidedAt = null;
      decidedBy = null;
      updatedAt = now;
    };
    state.requests.add(id, q);
    #ok q
  };

  // Runs without awaits, so a request can only move out of #pending once.
  public func decide(state : Types.State, q : Types.RewardRequest, approve : Bool, tzOffsetMinutes : Int, caller : Principal, now : Types.Time) : Result.Result<Types.Decision, Types.Error> {
    if (q.status != #pending) return #err(#invalid "request was already decided");
    let decided = { q with decidedAt = ?now; decidedBy = ?caller; updatedAt = now };
    if (not approve) {
      let declined = { decided with status = #declined };
      state.requests.add(q.id, declined);
      return #ok { request = declined; log = null };
    };
    let child = state.children.get(q.childId) ?? (return #err(#notFound));
    if (child.balance < q.cost) return #err(#invalid "not enough points");
    let input : Logs.Input = { kind = #reward; behaviorId = null; title = q.title; emoji = ?q.emoji; note = null; points = -(q.cost : Int); earnsXp = false };
    let result = Logs.record(state, child, tzOffsetMinutes, input, now, caller, now);
    // The reward is bought, so it is no longer the saving goal.
    if (child.savingForRewardId == ?q.rewardId) {
      let c = state.children.get(child.id) ?? child;
      state.children.add(c.id, { c with savingForRewardId = null });
    };
    let approved = { decided with status = #approved; logId = ?result.entry.id };
    state.requests.add(q.id, approved);
    #ok { request = approved; log = ?result }
  };
};
