import { useReducedMotion } from "framer-motion";
import { AnimationLevel } from "~/bindings/backend";
import { usePrefs } from "./prefs";

export type MotionLevel = "full" | "reduced";

// The OS setting and the in-app setting both count; either one asking for calm wins.
export function useMotionLevel(): MotionLevel {
  const osReduced = useReducedMotion();
  const { prefs } = usePrefs();
  return osReduced || prefs.animation === AnimationLevel.reduced ? "reduced" : "full";
}
