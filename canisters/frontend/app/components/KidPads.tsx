import { motion, useAnimationControls } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Animal } from "~/bindings/backend";
import { useMotionLevel } from "~/lib/motion";
import { usePrefs } from "~/lib/prefs";
import { canSpeak, speak } from "~/lib/speech";
import { useSound } from "~/lib/sound";

export const animalEmoji: Record<Animal, string> = {
  [Animal.bear]: "🐻",
  [Animal.cat]: "🐱",
  [Animal.dog]: "🐶",
  [Animal.fox]: "🦊",
  [Animal.frog]: "🐸",
  [Animal.lion]: "🦁",
  [Animal.monkey]: "🐵",
  [Animal.owl]: "🦉",
  [Animal.panda]: "🐼",
  [Animal.penguin]: "🐧",
  [Animal.rabbit]: "🐰",
  [Animal.unicorn]: "🦄",
};
const animals = Object.keys(animalEmoji) as Animal[];

export function ReadAloud({ text }: { text: string }) {
  const { t } = useTranslation();
  const { prefs } = usePrefs();
  if (!canSpeak()) return null;
  return (
    <motion.button type="button" className="kid-icon" aria-label={t("kidMode.readAloud")} whileTap={{ scale: 0.85 }} onClick={() => speak(text, prefs.language)}>
      🔊
    </motion.button>
  );
}

// Shakes the wrapped element; calm mode just flashes it.
export function useShake() {
  const controls = useAnimationControls();
  const level = useMotionLevel();
  const shake = () =>
    void controls.start(level === "reduced" ? { opacity: [1, 0.4, 1], transition: { duration: 0.4 } } : { x: [0, -14, 14, -10, 10, 0], transition: { duration: 0.45 } });
  return { controls, shake };
}

type Verdict = "ok" | "wrong" | { waitMs: number };

// A digit keypad (the 4-digit parent PIN, or a 6-digit pairing code). A wrong entry shakes and clears.
export function PinPad({ check, length = 4 }: { check: (pin: string) => Promise<Verdict>; length?: number }) {
  const { t } = useTranslation();
  const play = useSound();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [waitUntil, setWaitUntil] = useState(0);
  const { controls, shake } = useShake();

  async function press(d: string) {
    if (busy || pin.length >= length) return;
    play("pop");
    const next = pin + d;
    setPin(next);
    if (next.length < length) return;
    setBusy(true);
    const verdict = await check(next);
    setBusy(false);
    if (verdict === "ok") return;
    if (verdict !== "wrong") setWaitUntil(Date.now() + verdict.waitMs);
    shake();
    setPin("");
  }

  // Re-renders each second while locked out, so the countdown moves.
  const [, setNow] = useState(0);
  const waitLeft = Math.ceil((waitUntil - Date.now()) / 1000);
  useEffect(() => {
    if (waitLeft <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  });
  const waiting = waitLeft > 0;
  return (
    <div className="pin-pad">
      <motion.div className="pin-dots" role="img" animate={controls} aria-label={t("kidMode.pinDigits", { count: pin.length })}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={i < pin.length ? "on" : ""} />
        ))}
      </motion.div>
      {waiting && <p role="alert">⏳ {t("kidMode.wait", { count: waitLeft })}</p>}
      <div className="pin-keys">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k) =>
          k === "" ? (
            <span key="blank" />
          ) : (
            <motion.button
              key={k}
              type="button"
              whileTap={{ scale: 0.85 }}
              disabled={busy || waiting}
              aria-label={k === "⌫" ? t("kidMode.erase") : k}
              onClick={() => (k === "⌫" ? setPin((p) => p.slice(0, -1)) : void press(k))}
            >
              {k}
            </motion.button>
          ),
        )}
      </div>
    </div>
  );
}

// Three animals in order. Used both to enter and to set a picture password.
export function AnimalPad({ value, onChange, disabled }: { value: Animal[]; onChange: (v: Animal[]) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const play = useSound();
  return (
    <div className="animal-pad">
      <div className="animal-slots" aria-live="polite">
        {[0, 1, 2].map((i) => (
          <motion.span key={`${i}-${value[i] ?? ""}`} initial={value[i] ? { scale: 0 } : false} animate={{ scale: 1 }}>
            {value[i] ? animalEmoji[value[i]] : "❔"}
          </motion.span>
        ))}
      </div>
      <div className="animal-grid">
        {animals.map((a) => (
          <motion.button
            key={a}
            type="button"
            aria-label={t(`animals.${a}`)}
            whileTap={{ scale: 0.8 }}
            disabled={disabled || value.length >= 3}
            onClick={() => {
              play("pop");
              onChange([...value, a]);
            }}
          >
            {animalEmoji[a]}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
