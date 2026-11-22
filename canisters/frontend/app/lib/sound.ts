import { useCallback } from "react";
import { usePrefs } from "./prefs";

export const sounds = {
  pop: "/sounds/pop.wav",
  coin: "/sounds/coin.wav",
  oops: "/sounds/oops.wav",
  fanfare: "/sounds/fanfare.wav",
  chest: "/sounds/chest.wav",
} as const;
export type SoundName = keyof typeof sounds;

const cache = new Map<SoundName, HTMLAudioElement>();

function audio(name: SoundName) {
  let a = cache.get(name);
  if (!a) {
    a = new Audio(sounds[name]);
    a.preload = "auto";
    cache.set(name, a);
  }
  return a;
}

export function useSound() {
  const { prefs } = usePrefs();
  return useCallback(
    (name: SoundName) => {
      if (!prefs.soundOn) return;
      const a = audio(name);
      a.currentTime = 0;
      // Browsers block audio before the first tap; a missed sound is not an error worth showing.
      a.play().catch(() => {});
    },
    [prefs.soundOn],
  );
}
