import { motion, type TargetAndTransition } from "framer-motion";
import { useId, type ReactNode } from "react";
import type { Avatar as AvatarData } from "~/bindings/backend";
import { useMotionLevel } from "~/lib/motion";
import { backgroundArt, characterArt, Cheeks, Eyes, faceOf, glassesArt, hatArt, Mouth, type Mood } from "./AvatarArt";

export type AvatarAction = "idle" | "cheer" | "wobble" | "dance" | "none";

const bodyMotion: Record<AvatarAction, TargetAndTransition | undefined> = {
  idle: { y: [0, -3, 0], rotate: [0, 0, -3, 3, 0], transition: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: Math.random() } },
  cheer: { y: [0, -16, 0], scaleY: [1, 1.04, 0.94, 1], transition: { duration: 0.6, repeat: Infinity } },
  wobble: { rotate: [0, -8, 8, -5, 5, 0], transition: { duration: 1.2 } },
  dance: { rotate: [0, -10, 10, -10, 10, 0], y: [0, -12, 0, -12, 0], transition: { duration: 1.2, repeat: Infinity } },
  none: undefined,
};

const moods: Record<AvatarAction, Mood> = { idle: "happy", none: "happy", cheer: "cheer", dance: "cheer", wobble: "sad" };

// A newly worn item drops in with a bounce.
function Layer({ id, pop, children }: { id: string; pop: boolean; children: ReactNode }) {
  return (
    <motion.g
      style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
      initial={pop ? { scale: 0.2, opacity: 0, y: -16 } : false}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 14 }}
    >
      {children}
    </motion.g>
  );
}

export function Avatar({
  avatar,
  size = "3.5rem",
  bounce = true,
  action,
  pop = false,
}: {
  avatar: AvatarData;
  size?: string;
  bounce?: boolean;
  action?: AvatarAction;
  pop?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const calm = useMotionLevel() === "reduced";
  const doing = action ?? (bounce ? "idle" : "none");
  const art = characterArt[avatar.character] ?? characterArt.lion;
  const face = faceOf(avatar.character in characterArt ? avatar.character : "lion");
  const bg = avatar.accessories.find((a) => a in backgroundArt);
  const hat = avatar.accessories.find((a) => a in hatArt);
  const glasses = avatar.accessories.find((a) => a in glassesArt);
  const mood = moods[doing];

  return (
    <span className="avatar" aria-hidden="true" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width="100%" height="100%" overflow="visible">
        {bg && (
          <>
            <clipPath id={`${uid}c`}>
              <circle cx={60} cy={60} r={58} />
            </clipPath>
            <g clipPath={`url(#${uid}c)`}>
              <Layer key={bg} id={bg} pop={pop}>{backgroundArt[bg](`${uid}g`)}</Layer>
            </g>
          </>
        )}
        <motion.g style={{ transformBox: "view-box", transformOrigin: "60px 104px" }} animate={calm ? undefined : bodyMotion[doing]}>
          {art.back}
          {art.head}
          {art.front}
          <Cheeks face={face} />
          <Eyes face={face} mood={mood} blink={!calm && doing === "idle"} />
          <Mouth face={face} mood={mood} />
          {glasses && (
            <g transform={`translate(0 ${face.eyeY - 64})`}>
              <Layer key={glasses} id={glasses} pop={pop}>{glassesArt[glasses]()}</Layer>
            </g>
          )}
          {hat && (
            <g transform={`translate(0 ${face.hatY - 36})`}>
              <Layer key={hat} id={hat} pop={pop}>{hatArt[hat](!calm)}</Layer>
            </g>
          )}
        </motion.g>
      </svg>
    </span>
  );
}
