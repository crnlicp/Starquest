import { AuthClient } from "@icp-sdk/auth/client";
import type { Identity } from "@icp-sdk/core/agent";
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Role } from "~/bindings/backend";
import { createBackend } from "./actor";

const ANONYMOUS = "2vxsx-fae";

export type Backend = ReturnType<typeof createBackend>;

export type Session =
  | { status: "loading" }
  | { status: "signedOut"; error?: string }
  | { status: "signedIn"; principal: string; role: Role; backend: Backend };

type AuthValue = {
  session: Session;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

// `vite dev` only (compiled out of builds): headless tests sign in as a parent with a stored test key,
// because Internet Identity needs a person at the popup.
function devTestIdentity(): Identity | null {
  if (!import.meta.env.DEV) return null;
  try {
    const json = localStorage.getItem("starquest.dev-parent-key");
    return json ? Ed25519KeyIdentity.fromJSON(json) : null;
  } catch {
    return null;
  }
}

async function sessionFor(identity: Identity): Promise<Session> {
  const principal = identity.getPrincipal().toText();
  // The anonymous principal means sign-in silently failed.
  if (principal === ANONYMOUS) return { status: "signedOut", error: "anonymous" };
  const backend = createBackend(identity);
  return { status: "signedIn", principal, role: await backend.getMyRole(), backend };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Mainnet II (no identityProvider). Its own calls to II must go to mainnet: by default the agent
  // uses the page's host, which on a local network has no II canister.
  const [client] = useState(() => new AuthClient({ agentOptions: { host: "https://icp-api.io" } }));
  const [session, setSession] = useState<Session>({ status: "loading" });

  const load = useCallback(async () => {
    const testIdentity = devTestIdentity();
    if (testIdentity) {
      setSession(await sessionFor(testIdentity));
      return;
    }
    if (!client.isAuthenticated()) {
      setSession({ status: "signedOut" });
      return;
    }
    try {
      setSession(await sessionFor(await client.getIdentity()));
    } catch (e) {
      console.error("Restoring the session failed", e);
      setSession({ status: "signedOut", error: String(e) });
    }
  }, [client]);

  useEffect(() => {
    void load();
    // Fires on any change, including sign-in or sign-out in another tab.
    const unsubscribe = client.subscribe(() => void load());
    // The client lives as long as the page, so it is not disposed here (StrictMode remounts effects).
    return unsubscribe;
  }, [client, load]);

  const signIn = useCallback(async () => {
    try {
      setSession(await sessionFor(await client.signIn()));
    } catch (e) {
      console.error("Sign-in failed", e);
      setSession({ status: "signedOut", error: String(e) });
    }
  }, [client]);

  const signOut = useCallback(async () => {
    await client.signOut();
    setSession({ status: "signedOut" });
  }, [client]);

  const refreshRole = useCallback(async () => {
    if (session.status !== "signedIn") return;
    const role = await session.backend.getMyRole();
    setSession({ ...session, role });
  }, [session]);

  const value = useMemo(() => ({ session, signIn, signOut, refreshRole }), [session, signIn, signOut, refreshRole]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth outside AuthProvider");
  return value;
}
