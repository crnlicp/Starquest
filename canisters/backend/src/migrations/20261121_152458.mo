import List "mo:core/List";
import Map "mo:core/Map";

// First migration: introduces all stable state. Types are inlined on purpose (migrations are frozen once applied).
module {
  type Time = Int;
  type Settings = {
    language : { #en; #sv };
    soundOn : Bool;
    animation : { #full; #reduced };
    showLeaderboard : Bool;
    reminderMinute : ?Nat;
    dailyGoalDefault : Nat;
    tzOffsetMinutes : Int;
  };
  type Family = {
    id : Nat;
    name : Text;
    owner : Principal;
    createdAt : Time;
    settings : Settings;
    pin : ?{ salt : Blob; hash : Blob };
  };
  type Parent = {
    principal : Principal;
    familyId : Nat;
    kind : { #owner; #caregiver };
    joinedAt : Time;
  };
  type Invite = {
    token : Text;
    familyId : Nat;
    createdBy : Principal;
    createdAt : Time;
    expiresAt : Time;
  };

  type PinHash = { salt : Blob; hash : Blob };
  type Kind = { #good; #oops };
  type Mission = { suggestion : Text; refund : Nat };
  type Child = {
    id : Nat;
    familyId : Nat;
    name : Text;
    age : Nat;
    avatar : { character : Text; accessories : [Text] };
    favoriteColor : Text;
    dailyGoal : Nat;
    balance : Nat;
    xp : Nat;
    savingForRewardId : ?Nat;
    picture : ?PinHash;
    createdAt : Time;
    updatedAt : Time;
  };
  type Behavior = {
    id : Nat;
    familyId : Nat;
    name : Text;
    emoji : Text;
    points : Nat;
    kind : Kind;
    assignedTo : ?[Nat];
    enabled : Bool;
    mission : ?Mission;
    starterKey : ?Text;
    createdAt : Time;
    updatedAt : Time;
  };
  type LogEntry = {
    id : Nat;
    familyId : Nat;
    childId : Nat;
    behaviorId : ?Nat;
    kind : { #behavior; #custom; #mission; #reward; #reset };
    title : Text;
    emoji : ?Text;
    note : ?Text;
    points : Int;
    balanceDelta : Int;
    xpDelta : Nat;
    at : Time;
    day : Int;
    createdBy : Principal;
    createdAt : Time;
  };

  type Reward = {
    id : Nat;
    familyId : Nat;
    name : Text;
    emoji : Text;
    hasImage : Bool;
    cost : Nat;
    enabled : Bool;
    createdAt : Time;
    updatedAt : Time;
  };
  type RewardRequest = {
    id : Nat;
    familyId : Nat;
    childId : Nat;
    rewardId : Nat;
    title : Text;
    emoji : Text;
    cost : Nat;
    status : { #pending; #approved; #declined };
    logId : ?Nat;
    createdBy : Principal;
    createdAt : Time;
    decidedAt : ?Time;
    decidedBy : ?Principal;
    updatedAt : Time;
  };
  type MissionTask = {
    id : Nat;
    familyId : Nat;
    childId : Nat;
    entryId : Nat;
    suggestion : Text;
    refund : Nat;
    status : { #active; #completed; #cancelled };
    logId : ?Nat;
    createdAt : Time;
    updatedAt : Time;
  };
  type Deletion = { kind : { #child; #behavior; #reward; #entry }; id : Nat; at : Time };

  type PairingCode = {
    code : Text;
    familyId : Nat;
    childId : Nat;
    createdBy : Principal;
    createdAt : Time;
    expiresAt : Time;
  };
  type PairedDevice = {
    principal : Principal;
    familyId : Nat;
    childId : Nat;
    name : Text;
    pairedAt : Time;
    lastActive : Time;
  };
  type Attempts = { failures : Nat; lockedUntil : Time };

  type OldActor = {};
  type NewActor = {
    state : {
      families : Map.Map<Nat, Family>;
      parents : Map.Map<Principal, Parent>;
      invites : Map.Map<Text, Invite>;
      pinAttempts : Map.Map<Nat, { failures : Nat; lockedUntil : Time }>;
      var nextFamilyId : Nat;
      children : Map.Map<Nat, Child>;
      behaviors : Map.Map<Nat, Behavior>;
      logs : Map.Map<Nat, Map.Map<Nat, LogEntry>>;
      logOwner : Map.Map<Nat, Nat>;
      dayXp : Map.Map<Nat, Map.Map<Int, Nat>>;
      var nextChildId : Nat;
      var nextBehaviorId : Nat;
      var nextLogId : Nat;
      rewards : Map.Map<Nat, Reward>;
      rewardImages : Map.Map<Nat, Blob>;
      requests : Map.Map<Nat, RewardRequest>;
      missions : Map.Map<Nat, MissionTask>;
      badges : Map.Map<Nat, Map.Map<Text, Time>>;
      deletions : Map.Map<Nat, List.List<Deletion>>;
      var nextRewardId : Nat;
      var nextRequestId : Nat;
      var nextMissionId : Nat;
      pairingCodes : Map.Map<Text, PairingCode>;
      devices : Map.Map<Principal, PairedDevice>;
      pairAttempts : Map.Map<Principal, Attempts>;
      var pairWindow : { start : Time; failures : Nat };
      pictureAttempts : Map.Map<Nat, Attempts>;
    };
  };

  public func migration(_ : OldActor) : NewActor {
    {
      state = {
        families = Map.empty();
        parents = Map.empty();
        invites = Map.empty();
        pinAttempts = Map.empty();
        var nextFamilyId = 1;
        children = Map.empty();
        behaviors = Map.empty();
        logs = Map.empty();
        logOwner = Map.empty();
        dayXp = Map.empty();
        var nextChildId = 1;
        var nextBehaviorId = 1;
        var nextLogId = 1;
        rewards = Map.empty();
        rewardImages = Map.empty();
        requests = Map.empty();
        missions = Map.empty();
        badges = Map.empty();
        deletions = Map.empty();
        var nextRewardId = 1;
        var nextRequestId = 1;
        var nextMissionId = 1;
        pairingCodes = Map.empty();
        devices = Map.empty();
        pairAttempts = Map.empty();
        var pairWindow = { start = 0; failures = 0 };
        pictureAttempts = Map.empty();
      };
    }
  };
};
