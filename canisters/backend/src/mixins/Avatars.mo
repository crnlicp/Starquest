import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Result "mo:core/Result";
import Time "mo:core/Time";
import AvatarItems "../lib/AvatarItems";
import Children "../lib/Children";
import Families "../lib/Families";
import Validation "../lib/Validation";
import Types "../types";

// The child's own device may dress up its avatar; parents may dress up any child in the family.
mixin (state : Types.State) {
  public query ({ caller }) func listAvatarItems(childId : Types.ChildId) : async Result.Result<[Types.AvatarItemView], Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    if (not Families.allows(access, childId)) return #err(#notAuthorized);
    let child = switch (Children.inFamily(state, access.familyId, childId)) { case (#ok c) c; case (#err e) return #err e };
    #ok(AvatarItems.views(state, child))
  };

  public shared ({ caller }) func setAvatar(childId : Types.ChildId, avatar : Types.Avatar) : async Result.Result<Types.ChildView, Types.Error> {
    let access = switch (Families.requireMember(state, caller)) { case (#ok a) a; case (#err e) return #err e };
    if (not Families.allows(access, childId)) return #err(#notAuthorized);
    let family = switch (Families.family(state, access.familyId)) { case (#ok f) f; case (#err e) return #err e };
    let child = switch (Children.inFamily(state, family.id, childId)) { case (#ok c) c; case (#err e) return #err e };
    let valid = switch (Validation.avatar(avatar)) { case (#ok v) v; case (#err e) return #err e };
    switch (AvatarItems.check(AvatarItems.levelOf(child), AvatarItems.badgeIds(state, child), child.avatar.accessories, valid.accessories)) {
      case (#err e) return #err e;
      case (#ok) {};
    };
    let now = Time.now();
    let updated = { child with avatar = valid; updatedAt = now };
    state.children.add(childId, updated);
    #ok(Children.view(state, updated, family.settings.tzOffsetMinutes, now))
  };
};
