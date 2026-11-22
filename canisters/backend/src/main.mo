import Timer "mo:core/Timer";
import Types "types";
import Cleanup "lib/Cleanup";
import AvatarsMixin "mixins/Avatars";
import BehaviorsMixin "mixins/Behaviors";
import CaregiversMixin "mixins/Caregivers";
import DevicesMixin "mixins/Devices";
import ChildrenMixin "mixins/Children";
import FamiliesMixin "mixins/Families";
import HealthMixin "mixins/Health";
import LoggingMixin "mixins/Logging";
import MissionsMixin "mixins/Missions";
import ParentPinMixin "mixins/ParentPin";
import ReportsMixin "mixins/Reports";
import RewardsMixin "mixins/Rewards";

actor {
  let state : Types.State;

  include HealthMixin();
  include FamiliesMixin(state);
  include ParentPinMixin(state);
  include CaregiversMixin(state);
  include ChildrenMixin(state);
  include BehaviorsMixin(state);
  include LoggingMixin(state);
  include RewardsMixin(state);
  include MissionsMixin(state);
  include ReportsMixin(state);
  include DevicesMixin(state);
  include AvatarsMixin(state);

  // Timers do not survive upgrades; the actor body re-arms this one on every install and upgrade.
  ignore Timer.recurringTimer<system>(#seconds(Cleanup.intervalSeconds), func() : async () { Cleanup.run(state) });
};
