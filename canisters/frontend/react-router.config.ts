import type { Config } from "@react-router/dev/config";

// SPA mode: the static-site canister serves build/client; there is no server runtime on the IC.
export default {
  ssr: false,
} satisfies Config;
