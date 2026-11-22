import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Behavior, ChildView, FamilyView, MissionTask, Reward, RewardRequest, Settings } from "~/bindings/backend";
import { useAuth, type Backend } from "./auth";
import { unwrap } from "./result";

type FamilyData = {
  family: FamilyView;
  children: ChildView[];
  behaviors: Behavior[];
  rewards: Reward[];
  requests: RewardRequest[];
  missions: MissionTask[];
};

type FamilyValue = {
  backend: Backend | null;
  data: FamilyData | null;
  loading: boolean;
  error: unknown;
  reload: () => Promise<void>;
  setChild: (child: ChildView) => void;
  setBehaviors: (update: (bs: Behavior[]) => Behavior[]) => void;
  update: (change: (d: FamilyData) => FamilyData) => void;
  reloadInbox: () => Promise<void>;
};

const FamilyContext = createContext<FamilyValue | null>(null);

// One shared copy of the parent's family so pages can update a child card without refetching everything.
export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const backend = session.status === "signedIn" && session.role.__kind__ === "parent" ? session.backend : null;
  const [data, setData] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    if (!backend) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const [family, kids, behaviors, rewards, requests, missions] = await Promise.all([
        backend.getMyFamily(),
        backend.listChildren(),
        backend.listBehaviors(),
        backend.listRewards(),
        backend.listPendingRequests(),
        backend.listActiveMissions(),
      ]);
      setData({
        family: unwrap(family),
        children: unwrap(kids),
        behaviors: unwrap(behaviors),
        rewards: unwrap(rewards),
        requests: unwrap(requests),
        missions: unwrap(missions),
      });
      setError(null);
    } catch (e) {
      console.error("Loading the family failed", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => void reload(), [reload]);

  const setChild = useCallback((child: ChildView) => {
    setData((d) => {
      if (!d) return d;
      const exists = d.children.some((c) => c.id === child.id);
      return {
        ...d,
        children: exists ? d.children.map((c) => (c.id === child.id ? child : c)) : [...d.children, child],
      };
    });
  }, []);

  const setBehaviors = useCallback((update: (bs: Behavior[]) => Behavior[]) => {
    setData((d) => (d ? { ...d, behaviors: update(d.behaviors) } : d));
  }, []);

  const update = useCallback((change: (d: FamilyData) => FamilyData) => {
    setData((d) => (d ? change(d) : d));
  }, []);

  // Kids make requests from their own devices, so the inbox is refetched when it is opened.
  const reloadInbox = useCallback(async () => {
    if (!backend) return;
    const [kids, requests, missions] = await Promise.all([backend.listChildren(), backend.listPendingRequests(), backend.listActiveMissions()]);
    setData((d) => (d ? { ...d, children: unwrap(kids), requests: unwrap(requests), missions: unwrap(missions) } : d));
  }, [backend]);

  const value = useMemo(
    () => ({ backend, data, loading, error, reload, setChild, setBehaviors, update, reloadInbox }),
    [backend, data, loading, error, reload, setChild, setBehaviors, update, reloadInbox],
  );
  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const value = useContext(FamilyContext);
  if (!value) throw new Error("useFamily outside FamilyProvider");
  return value;
}

// Read-modify-write against the latest settings, so two screens saving different fields don't undo each other.
// Saves run one at a time: two quick changes would otherwise both read the old settings.
let saving: Promise<unknown> = Promise.resolve();
export function patchSettings(backend: Backend, patch: Partial<Settings>): Promise<Settings> {
  const run = saving.then(async () => {
    const next = { ...unwrap(await backend.getMyFamily()).settings, ...patch };
    unwrap(await backend.updateSettings(next));
    return next;
  });
  saving = run.catch(() => undefined);
  return run;
}
