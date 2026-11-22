import Array "mo:core/Array";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Result "mo:core/Result";
import Time "mo:core/Time";
import AvatarItems "../lib/AvatarItems";
import Children "../lib/Children";
import Families "../lib/Families";
import Sync "../lib/Sync";
import Validation "../lib/Validation";
import Types "../types";

mixin (state : Types.State) {
  public shared ({ caller }) func addChild(input : Types.ChildInput) : async Result.Result<Types.ChildView, Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let family = switch (Families.family(state, parent.familyId)) { case (#ok f) f; case (#err e) return #err e };
    let valid = switch (Validation.child(input, family.settings.dailyGoalDefault)) { case (#ok v) v; case (#err e) return #err e };
    if (Children.ofFamily(state, family.id).size() >= Children.maxPerFamily) return #err(#invalid "too many children");
    switch (AvatarItems.check(1, [], [], valid.avatar.accessories)) { case (#err e) return #err e; case (#ok) {} };
    let now = Time.now();
    let child = Children.create(state, family.id, valid, valid.dailyGoal ?? family.settings.dailyGoalDefault, now);
    #ok(Children.view(state, child, family.settings.tzOffsetMinutes, now))
  };

  public shared ({ caller }) func updateChild(id : Types.ChildId, input : Types.ChildInput) : async Result.Result<Types.ChildView, Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    let family = switch (Families.family(state, parent.familyId)) { case (#ok f) f; case (#err e) return #err e };
    let child = switch (Children.inFamily(state, family.id, id)) { case (#ok c) c; case (#err e) return #err e };
    let valid = switch (Validation.child(input, child.dailyGoal)) { case (#ok v) v; case (#err e) return #err e };
    switch (AvatarItems.check(AvatarItems.levelOf(child), AvatarItems.badgeIds(state, child), child.avatar.accessories, valid.avatar.accessories)) {
      case (#err e) return #err e;
      case (#ok) {};
    };
    let now = Time.now();
    let updated = {
      child with
      name = valid.name;
      age = valid.age;
      avatar = valid.avatar;
      favoriteColor = valid.favoriteColor;
      dailyGoal = valid.dailyGoal ?? child.dailyGoal;
      updatedAt = now;
    };
    state.children.add(id, updated);
    #ok(Children.view(state, updated, family.settings.tzOffsetMinutes, now))
  };

  public shared ({ caller }) func deleteChild(id : Types.ChildId) : async Result.Result<(), Types.Error> {
    let parent = switch (Families.requireParent(state, caller)) { case (#ok p) p; case (#err e) return #err e };
    switch (Children.inFamily(state, parent.familyId, id)) { case (#err e) return #err e; case (#ok _) {} };
    Children.remove(state, id);
    Sync.recordDeletion(state, parent.familyId, #child, id, Time.now());
    #ok
  };

  public query ({ caller }) func listChildren() : async Result.Result<[Types.ChildView], Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    let family = switch (Families.family(state, access.familyId)) { case (#ok f) f; case (#err e) return #err e };
    let now = Time.now();
    #ok(Children.ofFamily(state, family.id).filter(func c = Families.allows(access, c.id)).map(func c = Children.view(state, c, family.settings.tzOffsetMinutes, now)))
  };

  public query ({ caller }) func getChild(id : Types.ChildId) : async Result.Result<Types.ChildView, Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    if (not Families.allows(access, id)) return #err(#notAuthorized);
    let family = switch (Families.family(state, access.familyId)) { case (#ok f) f; case (#err e) return #err e };
    let child = switch (Children.inFamily(state, family.id, id)) { case (#ok c) c; case (#err e) return #err e };
    #ok(Children.view(state, child, family.settings.tzOffsetMinutes, Time.now()))
  };
};
