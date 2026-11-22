import Time "mo:core/Time";
import Devices "Devices";
import Invites "Invites";
import Types "../types";

module {
  public let intervalSeconds = 3600;

  public func run(state : Types.State) {
    let now = Time.now();
    Invites.pruneExpired(state, now);
    Devices.pruneExpired(state, now);
    Devices.pruneAttempts(state, now);
  };
};
