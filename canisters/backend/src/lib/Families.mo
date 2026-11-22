import Iter "mo:core/Iter";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Types "../types";

module {
  public let defaultSettings : Types.Settings = {
    language = #en;
    soundOn = true;
    animation = #full;
    showLeaderboard = false;
    reminderMinute = ?1140; // 19:00
    dailyGoalDefault = 20;
    tzOffsetMinutes = 0;
  };

  public func roleOf(state : Types.State, caller : Principal) : Types.Role {
    switch (state.parents.get(caller)) {
      case (?p) #parent({ familyId = p.familyId; kind = p.kind });
      case null {
        switch (device(state, caller)) {
          case (?d) #device({ familyId = d.familyId; childId = d.childId });
          case null #none;
        }
      };
    }
  };

  // Read live on every call, so a revoke takes effect immediately.
  public func device(state : Types.State, caller : Principal) : ?Types.PairedDevice {
    let d = state.devices.get(caller) ?? (return null);
    switch (state.children.get(d.childId)) {
      case (?c) { if (c.familyId == d.familyId) ?d else null };
      case null null;
    }
  };

  public func requireMember(state : Types.State, caller : Principal) : Result.Result<Types.Access, Types.Error> {
    if (caller.isAnonymous()) return #err(#notAuthorized);
    switch (state.parents.get(caller)) {
      case (?p) #ok { familyId = p.familyId; childId = null };
      case null {
        switch (device(state, caller)) {
          case (?d) #ok { familyId = d.familyId; childId = ?d.childId };
          case null #err(#notAuthorized);
        }
      };
    }
  };

  public func allows(access : Types.Access, childId : Types.ChildId) : Bool {
    switch (access.childId) { case (?own) own == childId; case null true }
  };

  // Parents and paired devices hold disjoint principals.
  public func isKnown(state : Types.State, caller : Principal) : Bool {
    state.parents.containsKey(caller) or state.devices.containsKey(caller)
  };

  public func requireAuthenticated(caller : Principal) : Result.Result<(), Types.Error> {
    if (caller.isAnonymous()) #err(#notAuthorized) else #ok
  };

  public func requireParent(state : Types.State, caller : Principal) : Result.Result<Types.Parent, Types.Error> {
    if (caller.isAnonymous()) return #err(#notAuthorized);
    switch (state.parents.get(caller)) {
      case (?p) #ok p;
      case null #err(#notAuthorized);
    }
  };

  public func requireOwner(state : Types.State, caller : Principal) : Result.Result<Types.Parent, Types.Error> {
    switch (requireParent(state, caller)) {
      case (#ok p) { if (p.kind == #owner) #ok p else #err(#notAuthorized) };
      case (#err e) #err e;
    }
  };

  public func family(state : Types.State, id : Types.FamilyId) : Result.Result<Types.Family, Types.Error> {
    switch (state.families.get(id)) {
      case (?f) #ok f;
      case null #err(#notFound);
    }
  };

  public func create(state : Types.State, owner : Principal, name : Text, tzOffsetMinutes : Int, now : Types.Time) : Types.Family {
    let id = state.nextFamilyId;
    state.nextFamilyId += 1;
    let family : Types.Family = {
      id;
      name;
      owner;
      createdAt = now;
      settings = { defaultSettings with tzOffsetMinutes };
      pin = null;
    };
    state.families.add(id, family);
    state.parents.add(owner, { principal = owner; familyId = id; kind = #owner; joinedAt = now });
    family
  };

  public func view(f : Types.Family) : Types.FamilyView {
    {
      id = f.id;
      name = f.name;
      owner = f.owner;
      createdAt = f.createdAt;
      settings = f.settings;
      hasPin = f.pin != null;
    }
  };

  public func parentsOf(state : Types.State, familyId : Types.FamilyId) : [Types.Parent] {
    state.parents.values().filter(func p = p.familyId == familyId).toArray()
  };
};
