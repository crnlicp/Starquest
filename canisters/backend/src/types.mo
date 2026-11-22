import List "mo:core/List";
import Map "mo:core/Map";

module {
  public type FamilyId = Nat;
  public type Time = Int;

  public type Language = { #en; #sv };
  public type AnimationLevel = { #full; #reduced };

  public type Settings = {
    language : Language;
    soundOn : Bool;
    animation : AnimationLevel;
    showLeaderboard : Bool;
    // Minute of the day (family local time) for the in-app logging reminder.
    reminderMinute : ?Nat;
    dailyGoalDefault : Nat;
    // Minutes east of UTC; used for "day" boundaries (goals, streaks, reports).
    tzOffsetMinutes : Int;
  };

  public type PinHash = { salt : Blob; hash : Blob };

  public type Family = {
    id : FamilyId;
    name : Text;
    owner : Principal;
    createdAt : Time;
    settings : Settings;
    pin : ?PinHash;
  };

  public type ParentKind = { #owner; #caregiver };

  public type Parent = {
    principal : Principal;
    familyId : FamilyId;
    kind : ParentKind;
    joinedAt : Time;
  };

  public type Invite = {
    token : Text;
    familyId : FamilyId;
    createdBy : Principal;
    createdAt : Time;
    expiresAt : Time;
  };

  public type Attempts = { failures : Nat; lockedUntil : Time };
  // Failures counted across all callers in a fixed window.
  public type Window = { start : Time; failures : Nat };

  public type ChildId = Nat;
  public type BehaviorId = Nat;
  public type LogId = Nat;
  public type BadgeId = Text;

  public type Avatar = { character : Text; accessories : [Text] };

  // One item per slot can be worn at a time.
  public type AvatarSlot = { #hat; #glasses; #background };
  public type Unlock = { #free; #level : Nat; #badge : BadgeId };
  public type AvatarItem = { id : Text; slot : AvatarSlot; unlock : Unlock };
  public type AvatarItemView = { id : Text; slot : AvatarSlot; unlock : Unlock; unlocked : Bool };

  public type Child = {
    id : ChildId;
    familyId : FamilyId;
    name : Text;
    age : Nat;
    avatar : Avatar;
    favoriteColor : Text;
    dailyGoal : Nat;
    // Spendable points; never below zero.
    balance : Nat;
    // Lifetime points; only an undo can lower it.
    xp : Nat;
    savingForRewardId : ?Nat;
    picture : ?PinHash;
    createdAt : Time;
    updatedAt : Time;
  };

  public type ChildInput = {
    name : Text;
    age : Nat;
    avatar : Avatar;
    favoriteColor : Text;
    // null = family default.
    dailyGoal : ?Nat;
  };

  public type Level = { number : Nat; title : Text; minXp : Nat };

  public type ChildView = {
    id : ChildId;
    familyId : FamilyId;
    name : Text;
    age : Nat;
    avatar : Avatar;
    favoriteColor : Text;
    dailyGoal : Nat;
    balance : Nat;
    xp : Nat;
    level : Level;
    nextLevelXp : ?Nat;
    todayPoints : Nat;
    streak : Nat;
    savingForRewardId : ?Nat;
    hasPicture : Bool;
    createdAt : Time;
    updatedAt : Time;
  };

  public type BehaviorKind = { #good; #oops };

  // "Make It Right" suggestion for an oops; confirming it refunds points (Phase 3).
  public type Mission = { suggestion : Text; refund : Nat };

  public type Behavior = {
    id : BehaviorId;
    familyId : FamilyId;
    name : Text;
    emoji : Text;
    points : Nat;
    kind : BehaviorKind;
    // null = all children.
    assignedTo : ?[ChildId];
    enabled : Bool;
    mission : ?Mission;
    starterKey : ?Text;
    createdAt : Time;
    updatedAt : Time;
  };

  public type BehaviorInput = {
    name : Text;
    emoji : Text;
    points : Nat;
    kind : BehaviorKind;
    assignedTo : ?[ChildId];
    mission : ?Mission;
  };

  public type StarterBehavior = {
    key : Text;
    name : Text;
    emoji : Text;
    points : Nat;
    kind : BehaviorKind;
    mission : ?Mission;
  };

  public type LogKind = { #behavior; #custom; #mission; #reward; #reset };

  public type LogEntry = {
    id : LogId;
    familyId : FamilyId;
    childId : ChildId;
    behaviorId : ?BehaviorId;
    kind : LogKind;
    // Behavior name or custom reason, copied so history survives behavior edits.
    title : Text;
    emoji : ?Text;
    note : ?Text;
    // Requested change; balanceDelta is what was applied after the zero floor.
    points : Int;
    balanceDelta : Int;
    xpDelta : Nat;
    at : Time;
    // Family-local day index of `at`, fixed at log time.
    day : Int;
    createdBy : Principal;
    createdAt : Time;
  };

  public type LogResult = {
    entry : LogEntry;
    newBalance : Nat;
    newXp : Nat;
    leveledUp : ?Level;
    newBadges : [BadgeId];
    // The entry's day crossed the daily goal with this log.
    goalReached : Bool;
    dayPoints : Nat;
    streak : Nat;
  };

  public type RewardId = Nat;
  public type RequestId = Nat;
  public type MissionId = Nat;

  public type Reward = {
    id : RewardId;
    familyId : FamilyId;
    name : Text;
    emoji : Text;
    // Image bytes live in State.rewardImages (fetched with getRewardImage).
    hasImage : Bool;
    cost : Nat;
    enabled : Bool;
    createdAt : Time;
    updatedAt : Time;
  };

  public type ImageChange = { #keep; #remove; #set : Blob };

  public type RewardInput = {
    name : Text;
    emoji : Text;
    cost : Nat;
    image : ImageChange;
  };

  public type RequestStatus = { #pending; #approved; #declined };

  public type RewardRequest = {
    id : RequestId;
    familyId : FamilyId;
    childId : ChildId;
    rewardId : RewardId;
    // Copied at request time: the child is promised the price they saw.
    title : Text;
    emoji : Text;
    cost : Nat;
    status : RequestStatus;
    // The #reward log entry written on approval.
    logId : ?LogId;
    createdBy : Principal;
    createdAt : Time;
    decidedAt : ?Time;
    decidedBy : ?Principal;
    updatedAt : Time;
  };

  public type Decision = { request : RewardRequest; log : ?LogResult };

  public type MissionStatus = { #active; #completed; #cancelled };

  // A started "Make It Right" mission for one oops entry.
  public type MissionTask = {
    id : MissionId;
    familyId : FamilyId;
    childId : ChildId;
    entryId : LogId;
    suggestion : Text;
    // Capped at the points the oops actually took.
    refund : Nat;
    status : MissionStatus;
    // The #mission log entry written on confirmation.
    logId : ?LogId;
    createdAt : Time;
    updatedAt : Time;
  };

  public type Badge = { id : BadgeId; name : Text; emoji : Text; description : Text };
  public type ChildBadge = { childId : ChildId; badgeId : BadgeId; unlockedAt : Time };

  public type Range = { #today; #week; #month; #year };
  // Days are family-local day indices (see lib/Days.mo).
  public type Bucket = { startDay : Int; days : Nat; earned : Nat; lost : Nat };
  public type BehaviorCount = {
    behaviorId : BehaviorId;
    title : Text;
    emoji : ?Text;
    kind : BehaviorKind;
    count : Nat;
  };

  public type ChildStats = {
    childId : ChildId;
    range : Range;
    fromDay : Int;
    toDay : Int;
    earned : Nat;
    lost : Nat;
    refunded : Nat;
    spent : Nat;
    goodCount : Nat;
    oopsCount : Nat;
    buckets : [Bucket];
    topBehaviors : [BehaviorCount];
  };

  public type WeeklySummary = {
    childId : ChildId;
    name : Text;
    fromDay : Int;
    toDay : Int;
    earned : Nat;
    goodCount : Nat;
    oopsCount : Nat;
    topBehavior : ?BehaviorCount;
  };

  public type HistoryFilter = {
    childId : ?ChildId;
    kind : ?LogKind;
    fromDay : ?Int;
    toDay : ?Int;
  };

  // Newest logged first; pass nextCursor back to get the following page.
  public type HistoryPage = { entries : [LogEntry]; nextCursor : ?LogId };

  public type DeletedKind = { #child; #behavior; #reward; #entry };
  public type Deletion = { kind : DeletedKind; id : Nat; at : Time };

  public type Changes = {
    serverTime : Time;
    // false: `since` is older than the kept deletion log, so reload everything.
    complete : Bool;
    children : [ChildView];
    behaviors : [Behavior];
    rewards : [Reward];
    requests : [RewardRequest];
    missions : [MissionTask];
    entries : [LogEntry];
    badges : [ChildBadge];
    deleted : [Deletion];
  };

  public type PairingCode = {
    code : Text;
    familyId : FamilyId;
    childId : ChildId;
    createdBy : Principal;
    createdAt : Time;
    expiresAt : Time;
  };

  public type PairingView = { code : Text; childId : ChildId; expiresAt : Time; url : Text };

  public type Animal = { #cat; #dog; #lion; #panda; #frog; #owl; #fox; #bear; #rabbit; #penguin; #monkey; #unicorn };

  public type PairedDevice = {
    principal : Principal;
    familyId : FamilyId;
    childId : ChildId;
    name : Text;
    pairedAt : Time;
    lastActive : Time;
  };

  // What the caller may see: a parent sees the family, a device only its child.
  public type Access = { familyId : FamilyId; childId : ?ChildId };

  // Single state record so every mixin receives the same binding.
  public type State = {
    families : Map.Map<FamilyId, Family>;
    parents : Map.Map<Principal, Parent>;
    invites : Map.Map<Text, Invite>;
    pinAttempts : Map.Map<FamilyId, Attempts>;
    var nextFamilyId : FamilyId;
    children : Map.Map<ChildId, Child>;
    behaviors : Map.Map<BehaviorId, Behavior>;
    logs : Map.Map<ChildId, Map.Map<LogId, LogEntry>>;
    logOwner : Map.Map<LogId, ChildId>;
    // XP earned per family-local day, per child (daily goal and streaks).
    dayXp : Map.Map<ChildId, Map.Map<Int, Nat>>;
    var nextChildId : ChildId;
    var nextBehaviorId : BehaviorId;
    var nextLogId : LogId;
    rewards : Map.Map<RewardId, Reward>;
    rewardImages : Map.Map<RewardId, Blob>;
    requests : Map.Map<RequestId, RewardRequest>;
    missions : Map.Map<MissionId, MissionTask>;
    badges : Map.Map<ChildId, Map.Map<BadgeId, Time>>;
    // Recent deletions per family, for getChangesSince.
    deletions : Map.Map<FamilyId, List.List<Deletion>>;
    var nextRewardId : RewardId;
    var nextRequestId : RequestId;
    var nextMissionId : MissionId;
    pairingCodes : Map.Map<Text, PairingCode>;
    devices : Map.Map<Principal, PairedDevice>;
    pairAttempts : Map.Map<Principal, Attempts>;
    var pairWindow : Window;
    pictureAttempts : Map.Map<ChildId, Attempts>;
  };

  public type Error = {
    #notAuthorized;
    #notFound;
    #alreadyExists;
    #invalid : Text;
    #rateLimited : { retryAfterNs : Nat };
  };

  public type Role = {
    #parent : { familyId : FamilyId; kind : ParentKind };
    #device : { familyId : FamilyId; childId : ChildId };
    #none;
  };

  public type FamilyView = {
    id : FamilyId;
    name : Text;
    owner : Principal;
    createdAt : Time;
    settings : Settings;
    hasPin : Bool;
  };

  public type InviteView = { token : Text; expiresAt : Time };
};
