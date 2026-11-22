import { safeGetCanisterEnv } from "@icp-sdk/core/agent/canister-env";
import type { Identity } from "@icp-sdk/core/agent";
import { createActor } from "~/bindings/backend";

// No `host`: the agent resolves the right endpoint on local, mainnet and custom domains.
// rootKey comes from the ic_env cookie; never fetch it at runtime.
export function createBackend(identity?: Identity) {
  const canisterEnv = safeGetCanisterEnv();
  const canisterId = canisterEnv?.["PUBLIC_CANISTER_ID:backend"];
  if (!canisterId) {
    throw new Error("Backend canister ID missing from the ic_env cookie");
  }
  return createActor(canisterId, {
    agentOptions: { identity, rootKey: canisterEnv?.IC_ROOT_KEY },
  });
}
