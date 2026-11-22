import Array "mo:core/Array";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Children "../lib/Children";
import Devices "../lib/Devices";
import Families "../lib/Families";
import Requests "../lib/Requests";
import Rewards "../lib/Rewards";
import Sync "../lib/Sync";
import Validation "../lib/Validation";
import Types "../types";

mixin (state : Types.State) {
  public shared ({ caller }) func addReward(input : Types.RewardInput) : async Result.Result<Types.Reward, Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let valid = switch (Validation.reward(input)) { case (#ok v) v; case (#err e) return #err e };
    if (Rewards.ofFamily(state, parent.familyId).size() >= Rewards.maxPerFamily) return #err(#invalid "too many rewards");
    #ok(Rewards.add(state, parent.familyId, valid, Time.now()))
  };

  public shared ({ caller }) func updateReward(id : Types.RewardId, input : Types.RewardInput) : async Result.Result<Types.Reward, Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let r = switch (Rewards.inFamily(state, parent.familyId, id)) { case (#ok r) r; case (#err e) return #err e };
    let valid = switch (Validation.reward(input)) { case (#ok v) v; case (#err e) return #err e };
    #ok(Rewards.update(state, r, valid, Time.now()))
  };

  public shared ({ caller }) func setRewardEnabled(id : Types.RewardId, enabled : Bool) : async Result.Result<(), Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let r = switch (Rewards.inFamily(state, parent.familyId, id)) { case (#ok r) r; case (#err e) return #err e };
    state.rewards.add(id, { r with enabled; updatedAt = Time.now() });
    #ok
  };

  public shared ({ caller }) func deleteReward(id : Types.RewardId) : async Result.Result<(), Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let r = switch (Rewards.inFamily(state, parent.familyId, id)) { case (#ok r) r; case (#err e) return #err e };
    let now = Time.now();
    Rewards.remove(state, r, caller, now);
    Sync.recordDeletion(state, parent.familyId, #reward, id, now);
    #ok
  };

  public query ({ caller }) func listRewards() : async Result.Result<[Types.Reward], Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    #ok(Rewards.ofFamily(state, access.familyId))
  };

  public query ({ caller }) func getRewardImage(id : Types.RewardId) : async Result.Result<?Blob, Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    switch (Rewards.inFamily(state, access.familyId, id)) { case (#err e) return #err e; case (#ok _) {} };
    #ok(state.rewardImages.get(id))
  };

  // Also callable by the child's paired device.
  public shared ({ caller }) func setSavingGoal(childId : Types.ChildId, rewardId : ?Types.RewardId) : async Result.Result<Types.ChildView, Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    if (not Families.allows(access, childId)) return #err(#notAuthorized);
    let family = switch (Families.family(state, access.familyId)) { case (#ok f) f; case (#err e) return #err e };
    let child = switch (Children.inFamily(state, family.id, childId)) { case (#ok c) c; case (#err e) return #err e };
    switch (rewardId) {
      case (?rid) { switch (Rewards.inFamily(state, family.id, rid)) { case (#err e) return #err e; case (#ok _) {} } };
      case null {};
    };
    let now = Time.now();
    let updated = { child with savingForRewardId = rewardId; updatedAt = now };
    state.children.add(childId, updated);
    #ok(Children.view(state, updated, family.settings.tzOffsetMinutes, now))
  };

  public shared ({ caller }) func requestReward(childId : Types.ChildId, rewardId : Types.RewardId) : async Result.Result<Types.RewardRequest, Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    if (not Families.allows(access, childId)) return #err(#notAuthorized);
    let child = switch (Children.inFamily(state, access.familyId, childId)) { case (#ok c) c; case (#err e) return #err e };
    let reward = switch (Rewards.inFamily(state, access.familyId, rewardId)) { case (#ok r) r; case (#err e) return #err e };
    let now = Time.now();
    Devices.touch(state, caller, now);
    Requests.create(state, child, reward, caller, now)
  };

  public shared ({ caller }) func decideRequest(id : Types.RequestId, approve : Bool) : async Result.Result<Types.Decision, Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let family = switch (Families.family(state, parent.familyId)) { case (#ok f) f; case (#err e) return #err e };
    let q = state.requests.get(id) ?? (return #err(#notFound));
    if (q.familyId != family.id) return #err(#notFound);
    Requests.decide(state, q, approve, family.settings.tzOffsetMinutes, caller, Time.now())
  };

  public query ({ caller }) func listPendingRequests() : async Result.Result<[Types.RewardRequest], Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    #ok(Requests.pending(state, access.familyId).filter(func q = Families.allows(access, q.childId)))
  };
};
