import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Badge, Level } from "~/bindings/backend";
import { useMotionLevel } from "~/lib/motion";
import { type SoundName, useSound } from "~/lib/sound";
import type { Avatar as AvatarData } from "~/bindings/backend";
import { Avatar } from "./Avatar";

export type Celebration =
  | { kind: "points"; amount: number }
  | { kind: "oops"; amount: number }
  | { kind: "badge"; badge: Badge }
  | { kind: "reward"; title: string; emoji: string }
  | { kind: "level"; level: Level };

const colors = ["#ffc107", "#ff7eb6", "#7c4dff", "#2ec27e", "#3a86ff", "#ff9f1c"];

// A small canvas confetti: `bursts` points (0–1 of the screen) each throw a handful of pieces.
export function Confetti({ bursts }: { bursts: { x: number; y: number; delay: number }[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    c.width = innerWidth;
    c.height = innerHeight;
    const start = performance.now();
    const pieces = bursts.flatMap((b) =>
      Array.from({ length: 40 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 7;
        return {
          x: b.x * c.width, y: b.y * c.height, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 4,
          size: 6 + Math.random() * 6, spin: Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)], delay: b.delay,
        };
      }),
    );
    let frame = 0;
    const draw = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of pieces) {
        if (t < p.delay) continue;
        p.vy += 0.25;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((t / 1000) * p.spin);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (t < 3500) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [bursts]);
  return <canvas ref={canvas} className="confetti" aria-hidden="true" />;
}

const center = [{ x: 0.5, y: 0.45, delay: 0 }];
// Fireworks: bursts in different places, one after another.
const fireworks = [
  { x: 0.5, y: 0.4, delay: 0 },
  { x: 0.2, y: 0.25, delay: 500 },
  { x: 0.8, y: 0.3, delay: 900 },
  { x: 0.35, y: 0.15, delay: 1400 },
  { x: 0.7, y: 0.2, delay: 1800 },
];

function Show({ item, avatar }: { item: Celebration; avatar: AvatarData }) {
  const { t } = useTranslation();
  const calm = useMotionLevel() === "reduced";
  const spin = calm ? {} : { initial: { scale: 0, rotate: -540 }, animate: { scale: 1, rotate: 0 }, transition: { type: "spring" as const, stiffness: 120, damping: 12 } };

  switch (item.kind) {
    case "level":
      return (
        <>
          {!calm && <Confetti bursts={fireworks} />}
          <motion.div className="celebrate__big" {...spin}>🏅</motion.div>
          <Avatar avatar={avatar} size="5rem" action="dance" />
          <p className="celebrate__title">{t("kidMode.level", { number: Number(item.level.number) })}</p>
          <p>{item.level.title}</p>
        </>
      );
    case "badge":
      return (
        <>
          <motion.div
            className="celebrate__big"
            animate={calm ? undefined : { rotate: [0, -8, 8, -8, 8, 0], scale: [1, 1, 1, 1, 1, 0] }}
            transition={{ duration: 1 }}
            style={{ position: "absolute" }}
          >
            🧰
          </motion.div>
          <motion.div className="celebrate__big" initial={{ scale: 0, y: 40 }} animate={{ scale: 1, y: 0 }} transition={{ delay: calm ? 0 : 1, type: "spring" }}>
            {item.badge.emoji}
            {!calm && <span className="sparkles" aria-hidden="true">✨</span>}
          </motion.div>
          <p className="celebrate__title">{item.badge.name}</p>
        </>
      );
    case "reward":
      return (
        <>
          {!calm && <Confetti bursts={[{ x: 0.5, y: 0.45, delay: 1000 }]} />}
          <motion.div
            className="celebrate__big"
            animate={calm ? undefined : { rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.1, 1, 1.1, 1.6, 0] }}
            transition={{ duration: 1 }}
            style={{ position: "absolute" }}
          >
            🎁
          </motion.div>
          <motion.div className="celebrate__big" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: calm ? 0 : 1, type: "spring" }}>
            {item.emoji}
          </motion.div>
          <p className="celebrate__title">🎉 {item.title}</p>
        </>
      );
    case "points":
      return (
        <>
          {!calm && <Confetti bursts={center} />}
          <Avatar avatar={avatar} size="5rem" action="dance" />
          <motion.p className="celebrate__title" initial={{ scale: 0 }} animate={{ scale: 1 }}>+{item.amount} ⭐</motion.p>
        </>
      );
    case "oops":
      return (
        <>
          <Avatar avatar={avatar} size="5rem" action="wobble" />
          <motion.p className="celebrate__oops" initial={{ y: 0, opacity: 1 }} animate={{ y: calm ? 0 : 60, opacity: 0.4 }} transition={{ duration: 2 }}>
            −{item.amount} ⭐
          </motion.p>
          <p>{t("mission.nextTime")}</p>
        </>
      );
  }
}

const sounds = { level: "fanfare", badge: "chest", reward: "chest", points: "coin", oops: "oops" } as const satisfies Record<Celebration["kind"], SoundName>;

// Plays the queue one at a time; a tap skips ahead.
export function Celebrations({ queue, avatar, onNext }: { queue: Celebration[]; avatar: AvatarData; onNext: () => void }) {
  const play = useSound();
  const item = queue[0];

  useEffect(() => {
    if (!item) return;
    play(sounds[item.kind]);
    const timer = setTimeout(onNext, item.kind === "level" ? 4500 : 3500);
    return () => clearTimeout(timer);
  }, [item, onNext, play]);

  return (
    <AnimatePresence mode="wait">
      {item && (
        <motion.div
          key={queue.length + item.kind}
          className={`celebrate celebrate--${item.kind}`}
          role="status"
          data-testid={`celebrate-${item.kind}`}
          onClick={onNext}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Show item={item} avatar={avatar} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
