import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AnimationLevel, Language, type Settings } from "~/bindings/backend";
import i18n from "~/i18n";
import { useAuth } from "./auth";
import { patchSettings } from "./family";
import { readJson, writeJson } from "./storage";

export type Prefs = { language: Language; soundOn: boolean; animation: AnimationLevel };

const KEY = "starquest.prefs";
const defaults: Prefs = { language: Language.en, soundOn: true, animation: AnimationLevel.full };

type PrefsValue = { prefs: Prefs; setPrefs: (patch: Partial<Prefs>) => void };
const PrefsContext = createContext<PrefsValue | null>(null);

// Local copy so the device works before sign-in and offline; a parent's change is also saved to family settings.
export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [prefs, setLocal] = useState<Prefs>(defaults);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => setLocal({ ...defaults, ...readJson<Prefs>(KEY) }), []);

  // A parent's family settings win over the local copy.
  useEffect(() => {
    if (session.status !== "signedIn" || session.role.__kind__ !== "parent") {
      setSettings(null);
      return;
    }
    session.backend
      .getMyFamily()
      .then((r) => {
        if (r.__kind__ !== "ok") return;
        const s = r.ok.settings;
        setSettings(s);
        setLocal((p) => ({ ...p, language: s.language, soundOn: s.soundOn, animation: s.animation }));
      })
      .catch((e) => console.error("Loading family settings failed", e));
  }, [session]);

  useEffect(() => {
    writeJson(KEY, prefs);
    void i18n.changeLanguage(prefs.language);
    document.documentElement.lang = prefs.language;
  }, [prefs]);

  const setPrefs = useCallback(
    (patch: Partial<Prefs>) => {
      setLocal((p) => ({ ...p, ...patch }));
      if (session.status !== "signedIn" || !settings) return;
      patchSettings(session.backend, patch)
        .then(setSettings)
        .catch((e) => console.error("Saving settings failed", e));
    },
    [session, settings],
  );

  const value = useMemo(() => ({ prefs, setPrefs }), [prefs, setPrefs]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const value = useContext(PrefsContext);
  if (!value) throw new Error("usePrefs outside PrefsProvider");
  return value;
}
