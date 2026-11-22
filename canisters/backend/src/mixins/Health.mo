mixin () {
  // Lets the frontend confirm which principal the backend sees for the current identity.
  public query ({ caller }) func whoami() : async Principal {
    caller
  };
};
