import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Badge, ChildView, Reward, RewardRequest } from "~/bindings/backend";
import { useLocation, useNavigate } from "react-router";
import { useAuth, type Backend } from "./auth";
import { forgetDevice } from "./device";
import { ApiError, unwrap } from "./result";
import { readJson, writeJson } from "./storage";

export type KidData = { children: ChildView[]; rewards: Reward[]; requests: RewardRequest[]; badges: Badge[] };

// A paired kid device: its own key, tied to one child.
export type KidDevice = { backend: Backend; childId: bigint };

type KidValue = {
  backend: Backend;
  device: KidDevice | null;
  data: KidData | null;
  error: unknown;
  reload: () => Promise<void>;
  setChild: (child: ChildView) => void;
  addRequest: (request: RewardRequest) => void;
  // Children whose picture password was entered this visit.
  unlocked: Set<bigint>;
  unlock: (id: bigint) => void;
  // Goes up each time polling brings news, so the profile can check what to celebrate.
  pulse: number;
};

type KidContextValue = Omit<KidValue, "backend"> & { backend: Backend | null; setDevice: (d: KidDevice | null) => void };
const KidContext = createContext<KidContextValue | null>(null);

const POLL_MS = 5000;
const HEARTBEAT_MS = 5 * 60_000;

// Kid Mode reads only member-level calls, so the same screens run for a parent or a paired device.
// It lives above the page transitions, which remount every page, so unlocks survive navigation.
export function KidProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const parentBackend = session.status === "signedIn" && session.role.__kind__ === "parent" ? session.backend : null;
  const [device, setDevice] = useState<KidDevice | null>(null);
  const backend = parentBackend ?? device?.backend ?? null;
  const active = backend !== null && pathname.startsWith("/kid");
  const [data, setData] = useState<KidData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [unlocked, setUnlocked] = useState<Set<bigint>>(() => new Set());
  const [pulse, setPulse] = useState(0);

  const reload = useCallback(async () => {
    if (!backend) return;
    try {
      const [kids, rewards, requests, badges] = await Promise.all([
        backend.listChildren(),
        backend.listRewards(),
        backend.listPendingRequests(),
        backend.getBadgeDefinitions(),
      ]);
      setData({ children: unwrap(kids), rewards: unwrap(rewards).filter((r) => r.enabled), requests: unwrap(requests), badges });
      setError(null);
    } catch (e) {
      console.error("Loading Kid Mode failed", e);
      setError(e);
    }
  }, [backend]);

  // Loaded on entering Kid Mode, and again each time a parent comes back to it.
  // Each visit starts locked, except on the child's own device. Cleared on the way in, not out:
  // the page fading out must keep its unlock.
  useEffect(() => {
    if (!active) return;
    setUnlocked(new Set(device ? [device.childId] : []));
    void reload();
  }, [active, reload, device]);
  useEffect(() => {
    if (!backend) setData(null);
  }, [backend]);

  // Live sync: ask for changes every few seconds while the screen is visible, and at once on return.
  const since = useRef<bigint | null>(null);
  const lastBeat = useRef(0);
  useEffect(() => {
    if (!active || !backend) return;
    since.current = null;
    let stopped = false;
    let busy = false;
    const revoked = () => {
      forgetDevice();
      setDevice(null);
      navigate("/", { replace: true });
    };
    const tick = async () => {
      if (stopped || busy || document.hidden) return;
      busy = true;
      try {
        if (device && Date.now() - lastBeat.current > HEARTBEAT_MS) {
          lastBeat.current = Date.now();
          unwrap(await device.backend.heartbeat());
        }
        const c = unwrap(await backend.getChangesSince(since.current ?? BigInt(Date.now()) * 1_000_000n));
        const news = since.current !== null && (c.entries.length > 0 || c.badges.length > 0 || c.requests.length > 0 || c.rewards.length > 0 || c.children.length > 0 || c.deleted.length > 0);
        since.current = c.serverTime;
        if (news && !stopped) {
          await reload();
          setPulse((p) => p + 1);
        }
      } catch (e) {
        if (device && e instanceof ApiError && e.err.__kind__ === "notAuthorized") return revoked();
        console.warn("Checking for changes failed", e);
      } finally {
        busy = false;
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    const wake = () => void tick();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [active, backend, device, reload, navigate]);

  const setChild = useCallback((child: ChildView) => {
    setData((d) => d && { ...d, children: d.children.map((c) => (c.id === child.id ? child : c)) });
  }, []);
  const addRequest = useCallback((request: RewardRequest) => {
    setData((d) => d && { ...d, requests: [...d.requests, request] });
  }, []);
  const unlock = useCallback((id: bigint) => setUnlocked((s) => new Set(s).add(id)), []);

  const value = useMemo(
    () => ({ backend, device, setDevice, data, error, reload, setChild, addRequest, unlocked, unlock, pulse }),
    [backend, device, data, error, reload, setChild, addRequest, unlocked, unlock, pulse],
  );
  return <KidContext.Provider value={value}>{children}</KidContext.Provider>;
}

// For Kid Mode screens, which only render once a backend is known.
export function useKid(): KidValue {
  const value = useContext(KidContext);
  if (!value?.backend) throw new Error("useKid outside Kid Mode");
  return { ...value, backend: value.backend };
}

// For the device gate, which runs before a backend is known.
export function useKidDevice() {
  const value = useContext(KidContext);
  if (!value) throw new Error("useKidDevice outside KidProvider");
  return { device: value.device, setDevice: value.setDevice };
}

// While this is set, the parent area on this device is behind the PIN.
const KID_MODE_KEY = "starquest.kidMode";
export const kidModeOn = () => readJson<boolean>(KID_MODE_KEY) === true;
export const setKidMode = (on: boolean) => writeJson(KID_MODE_KEY, on);
