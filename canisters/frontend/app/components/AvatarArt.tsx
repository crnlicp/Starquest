import { motion } from "framer-motion";
import type { ReactNode } from "react";

// Original avatar artwork, drawn on a 120×120 grid. The head sits around (60, 66).
// Each character has parts behind the head (ears, mane), the head, and parts in front (muzzle, nose).

const ink = "#2b2350";

export type Face = { eyeY: number; mouthY: number; hatY: number; led?: boolean };
type Character = { back?: ReactNode; head: ReactNode; front?: ReactNode; face?: Partial<Face> };

const ears = (fill: string, inner: string, r = 9, y = 40) => (
  <>
    <circle cx={36} cy={y} r={r} fill={fill} />
    <circle cx={84} cy={y} r={r} fill={fill} />
    <circle cx={36} cy={y} r={r * 0.55} fill={inner} />
    <circle cx={84} cy={y} r={r * 0.55} fill={inner} />
  </>
);
const nose = (y: number, fill = ink) => <path d={`M55 ${y} h10 q-1 5 -5 6 q-4 -1 -5 -6z`} fill={fill} />;

export const characterArt: Record<string, Character> = {
  lion: {
    back: (
      <>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <circle key={i} cx={60 + Math.cos(a) * 34} cy={66 + Math.sin(a) * 34} r={13} fill="#e07a1f" />;
        })}
        <circle cx={60} cy={66} r={38} fill="#e07a1f" />
        {ears("#f7c35f", "#e9a23b", 8, 42)}
      </>
    ),
    head: <circle cx={60} cy={66} r={30} fill="#f7c35f" />,
    front: (
      <>
        <ellipse cx={60} cy={80} rx={13} ry={9} fill="#fde3a7" />
        {nose(73, "#7a3e1d")}
      </>
    ),
    face: { mouthY: 84, hatY: 30 },
  },
  panda: {
    back: ears("#2d2d38", "#2d2d38", 10, 40),
    head: <circle cx={60} cy={66} r={32} fill="#fafafa" stroke="#e3e3ea" strokeWidth={1.5} />,
    front: (
      <>
        <ellipse cx={48} cy={64} rx={9} ry={11} transform="rotate(20 48 64)" fill="#2d2d38" />
        <ellipse cx={72} cy={64} rx={9} ry={11} transform="rotate(-20 72 64)" fill="#2d2d38" />
        <ellipse cx={60} cy={76} rx={4.5} ry={3.2} fill="#2d2d38" />
      </>
    ),
    face: { mouthY: 83 },
  },
  fox: {
    back: (
      <>
        <path d="M32 54 L36 20 L58 40 Z" fill="#f08a3c" />
        <path d="M88 54 L84 20 L62 40 Z" fill="#f08a3c" />
        <path d="M37 46 L39 28 L50 39 Z" fill="#fff3e6" />
        <path d="M83 46 L81 28 L70 39 Z" fill="#fff3e6" />
      </>
    ),
    head: <circle cx={60} cy={66} r={30} fill="#f08a3c" />,
    front: (
      <>
        <path d="M31 70 Q46 70 60 88 Q74 70 89 70 Q86 95 60 96 Q34 95 31 70 Z" fill="#fff6ec" />
        {nose(78)}
      </>
    ),
    face: { mouthY: 87 },
  },
  frog: {
    back: (
      <>
        <circle cx={44} cy={44} r={13} fill="#6cc24a" />
        <circle cx={76} cy={44} r={13} fill="#6cc24a" />
      </>
    ),
    head: <ellipse cx={60} cy={70} rx={36} ry={27} fill="#6cc24a" />,
    front: <ellipse cx={60} cy={86} rx={20} ry={7} fill="#a6e38a" opacity={0.6} />,
    face: { eyeY: 44, mouthY: 76, hatY: 36 },
  },
  monkey: {
    back: (
      <>
        <circle cx={28} cy={64} r={11} fill="#8a5a3b" />
        <circle cx={92} cy={64} r={11} fill="#8a5a3b" />
        <circle cx={28} cy={64} r={6} fill="#f0cfa0" />
        <circle cx={92} cy={64} r={6} fill="#f0cfa0" />
      </>
    ),
    head: <circle cx={60} cy={66} r={31} fill="#8a5a3b" />,
    front: (
      <>
        <circle cx={49} cy={62} r={12} fill="#f0cfa0" />
        <circle cx={71} cy={62} r={12} fill="#f0cfa0" />
        <ellipse cx={60} cy={79} rx={19} ry={13} fill="#f0cfa0" />
        <circle cx={57} cy={75} r={1.6} fill={ink} />
        <circle cx={63} cy={75} r={1.6} fill={ink} />
      </>
    ),
    face: { mouthY: 83 },
  },
  unicorn: {
    back: (
      <>
        <path d="M38 50 L40 28 L54 40 Z" fill="#fff5fb" stroke="#f0d9ea" strokeWidth={1.5} />
        <path d="M82 50 L80 28 L66 40 Z" fill="#fff5fb" stroke="#f0d9ea" strokeWidth={1.5} />
        <ellipse cx={86} cy={62} rx={10} ry={24} fill="#b48cff" />
        <ellipse cx={80} cy={50} rx={12} ry={18} fill="#ff9bd2" />
      </>
    ),
    head: <circle cx={60} cy={66} r={30} fill="#fff5fb" stroke="#f0d9ea" strokeWidth={1.5} />,
    front: (
      <>
        <path d="M54 39 L60 8 L66 39 Z" fill="#ffd54a" stroke="#e8b923" strokeWidth={1} />
        <path d="M56 31 L64 28 M57 23 L63 20" stroke="#e8b923" strokeWidth={1.5} />
        <path d="M44 40 Q52 34 62 38 Q54 44 44 40 Z" fill="#ff9bd2" />
      </>
    ),
    face: { hatY: 32 },
  },
  tiger: {
    back: ears("#f59a3a", "#fff0dc", 9, 40),
    head: <circle cx={60} cy={66} r={31} fill="#f59a3a" />,
    front: (
      <>
        <g stroke="#4a2c1a" strokeWidth={3} strokeLinecap="round">
          <path d="M60 37 v9 M50 38 l3 7 M70 38 l-3 7 M30 60 h8 M31 68 h7 M90 60 h-8 M89 68 h-7" />
        </g>
        <ellipse cx={60} cy={80} rx={14} ry={10} fill="#fff6ea" />
        {nose(74)}
      </>
    ),
    face: { mouthY: 84 },
  },
  koala: {
    back: (
      <>
        <circle cx={30} cy={46} r={15} fill="#a3aab6" />
        <circle cx={90} cy={46} r={15} fill="#a3aab6" />
        <circle cx={30} cy={46} r={8} fill="#f4c6d2" />
        <circle cx={90} cy={46} r={8} fill="#f4c6d2" />
      </>
    ),
    head: <circle cx={60} cy={66} r={31} fill="#a3aab6" />,
    front: <ellipse cx={60} cy={75} rx={6} ry={8} fill="#3b3f4a" />,
    face: { mouthY: 87 },
  },
  octopus: {
    back: (
      <g fill="none" stroke="#b57edc" strokeWidth={9} strokeLinecap="round">
        <path d="M36 80 q-10 14 -2 24" />
        <path d="M48 84 q-4 14 2 22" />
        <path d="M60 86 v20" />
        <path d="M72 84 q4 14 -2 22" />
        <path d="M84 80 q10 14 2 24" />
      </g>
    ),
    head: <ellipse cx={60} cy={58} rx={33} ry={31} fill="#b57edc" />,
    front: (
      <>
        <circle cx={44} cy={40} r={4} fill="#d3a8f0" />
        <circle cx={77} cy={44} r={3} fill="#d3a8f0" />
        <circle cx={70} cy={34} r={2} fill="#d3a8f0" />
      </>
    ),
    face: { eyeY: 58, mouthY: 74, hatY: 30 },
  },
  dragon: {
    back: (
      <>
        <path d="M42 42 L34 16 L52 36 Z" fill="#ffd27a" />
        <path d="M78 42 L86 16 L68 36 Z" fill="#ffd27a" />
        <path d="M28 56 L18 50 L30 66 Z M92 56 L102 50 L90 66 Z" fill="#2fa17f" />
      </>
    ),
    head: <circle cx={60} cy={66} r={31} fill="#49c29b" />,
    front: (
      <>
        <ellipse cx={60} cy={82} rx={17} ry={11} fill="#86dfc2" />
        <circle cx={54} cy={79} r={2} fill="#1d5f4b" />
        <circle cx={66} cy={79} r={2} fill="#1d5f4b" />
      </>
    ),
    face: { mouthY: 87 },
  },
  monster: {
    back: (
      <>
        <path d="M40 44 Q28 30 34 18 Q40 32 50 38 Z" fill="#f6f0ff" />
        <path d="M80 44 Q92 30 86 18 Q80 32 70 38 Z" fill="#f6f0ff" />
      </>
    ),
    head: (
      <>
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return <circle key={i} cx={60 + Math.cos(a) * 30} cy={66 + Math.sin(a) * 30} r={6} fill="#5aa9e6" />;
        })}
        <circle cx={60} cy={66} r={31} fill="#5aa9e6" />
      </>
    ),
    front: <path d="M64 84 l3 6 l3 -6 z" fill="#fff" />,
    face: { mouthY: 82 },
  },
  robot: {
    back: (
      <>
        <path d="M60 36 V20" stroke="#8892a6" strokeWidth={3} />
        <circle cx={60} cy={18} r={5} fill="#ff5d73" />
        <rect x={20} y={58} width={10} height={18} rx={3} fill="#8892a6" />
        <rect x={90} y={58} width={10} height={18} rx={3} fill="#8892a6" />
      </>
    ),
    head: <rect x={28} y={34} width={64} height={62} rx={16} fill="#c3cddd" stroke="#8892a6" strokeWidth={2} />,
    front: <rect x={36} y={50} width={48} height={38} rx={10} fill="#2d3550" />,
    face: { eyeY: 64, mouthY: 78, hatY: 36, led: true },
  },
};

export const characterKeys = Object.keys(characterArt);

export function faceOf(character: string): Face {
  return { eyeY: 64, mouthY: 82, hatY: 36, ...characterArt[character]?.face };
}

export type Mood = "happy" | "cheer" | "sad";

export function Eyes({ face, mood, blink }: { face: Face; mood: Mood; blink: boolean }) {
  const y = face.eyeY;
  const eye = (x: number) =>
    face.led ? (
      mood === "happy" || mood === "cheer" ? (
        <path d={`M${x - 5} ${y + 2} Q${x} ${y - 5} ${x + 5} ${y + 2}`} stroke="#5ff2ff" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      ) : (
        <circle cx={x} cy={y} r={4.5} fill="#5ff2ff" />
      )
    ) : (
      <>
        <circle cx={x} cy={y} r={6.5} fill="#fff" />
        <circle cx={x} cy={y + 0.5} r={3.6} fill={ink} />
        <circle cx={x + 1.3} cy={y - 1} r={1.2} fill="#fff" />
      </>
    );
  return (
    <>
      <motion.g
        style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
        animate={blink ? { scaleY: [1, 1, 0.1, 1] } : undefined}
        transition={blink ? { duration: 4, times: [0, 0.92, 0.96, 1], repeat: Infinity, delay: Math.random() * 2 } : undefined}
      >
        {eye(49)}
        {eye(71)}
      </motion.g>
      {mood === "sad" && (
        <path d={`M41 ${y - 12} L53 ${y - 9} M79 ${y - 12} L67 ${y - 9}`} stroke={face.led ? "#5ff2ff" : ink} strokeWidth={2.5} strokeLinecap="round" />
      )}
    </>
  );
}

export function Mouth({ face, mood }: { face: Face; mood: Mood }) {
  const y = face.mouthY;
  const color = face.led ? "#5ff2ff" : ink;
  if (mood === "cheer")
    return (
      <>
        <path d={`M51 ${y - 2} Q60 ${y + 12} 69 ${y - 2} Z`} fill={face.led ? "#5ff2ff" : "#7a2a3a"} />
        {!face.led && <ellipse cx={60} cy={y + 4} rx={4} ry={2.5} fill="#ff8fa3" />}
      </>
    );
  if (mood === "sad") return <path d={`M53 ${y + 3} Q60 ${y - 3} 67 ${y + 3}`} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />;
  return <path d={`M52 ${y - 1} Q60 ${y + 6} 68 ${y - 1}`} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />;
}

export function Cheeks({ face }: { face: Face }) {
  if (face.led) return null;
  return (
    <>
      <circle cx={40} cy={face.eyeY + 11} r={5} fill="#ff7eb6" opacity={0.35} />
      <circle cx={80} cy={face.eyeY + 11} r={5} fill="#ff7eb6" opacity={0.35} />
    </>
  );
}

// Hats are drawn with their base at y = 36 and moved to the character's hatY.
export const hatArt: Record<string, (spin: boolean) => ReactNode> = {
  "hat-party": () => (
    <>
      <path d="M44 38 L60 4 L76 38 Z" fill="#ff5d8f" />
      <path d="M49 28 L71 28 M54 18 L66 18" stroke="#ffd23f" strokeWidth={3} />
      <circle cx={60} cy={4} r={5} fill="#ffd23f" />
    </>
  ),
  "hat-bow": () => (
    <>
      <path d="M76 30 L62 21 L62 39 Z" fill="#ff4f9a" />
      <path d="M76 30 L90 21 L90 39 Z" fill="#ff4f9a" />
      <circle cx={76} cy={30} r={4.5} fill="#d62f7a" />
    </>
  ),
  "hat-cap": () => (
    <>
      <path d="M36 40 Q36 14 60 14 Q84 14 84 40 Z" fill="#3a86ff" />
      <ellipse cx={76} cy={40} rx={20} ry={4} fill="#2a66cc" />
      <circle cx={60} cy={14} r={3} fill="#ffd23f" />
    </>
  ),
  "hat-crown": () => (
    <>
      <path d="M40 38 L40 16 L50 27 L60 10 L70 27 L80 16 L80 38 Z" fill="#ffcf3f" stroke="#e0a800" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={50} cy={32} r={3} fill="#e63946" />
      <circle cx={60} cy={31} r={3} fill="#3a86ff" />
      <circle cx={70} cy={32} r={3} fill="#2ec27e" />
    </>
  ),
  "hat-flowers": () => (
    <>
      {[
        [36, 40, "#ff7eb6"],
        [48, 33, "#ffd23f"],
        [60, 31, "#b48cff"],
        [72, 33, "#ff9f1c"],
        [84, 40, "#ff7eb6"],
      ].map(([x, y, c]) => (
        <g key={`${x}`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={Number(x) + Math.cos((a * Math.PI) / 180) * 4} cy={Number(y) + Math.sin((a * Math.PI) / 180) * 4} r={3.5} fill={String(c)} />
          ))}
          <circle cx={Number(x)} cy={Number(y)} r={2.5} fill="#fff6c2" />
        </g>
      ))}
    </>
  ),
  "hat-wizard": () => (
    <>
      <path d="M42 38 Q54 22 64 -4 Q68 20 80 38 Z" fill="#7c5cff" />
      <ellipse cx={60} cy={38} rx={30} ry={6} fill="#5a3fd1" />
      <path d="M58 22 l1.5 3 3 .5 -2 2 .5 3 -3 -1.5 -3 1.5 .5 -3 -2 -2 3 -.5z" fill="#ffd23f" />
      <circle cx={68} cy={30} r={1.8} fill="#ffd23f" />
    </>
  ),
  "hat-pirate": () => (
    <>
      <path d="M28 38 Q60 2 92 38 Q60 30 28 38 Z" fill="#2b2b36" />
      <path d="M32 36 Q60 28 88 36" stroke="#ffcf3f" strokeWidth={2} fill="none" />
      <circle cx={60} cy={22} r={5} fill="#fff" />
      <circle cx={58} cy={21.5} r={1.2} fill="#2b2b36" />
      <circle cx={62} cy={21.5} r={1.2} fill="#2b2b36" />
    </>
  ),
  "hat-propeller": (spin) => (
    <>
      <path d="M38 40 Q38 18 60 18 Q82 18 82 40 Z" fill="#ffd23f" />
      <path d="M53 19 Q50 28 49 40 M67 19 Q70 28 71 40" stroke="#3a86ff" strokeWidth={4} fill="none" />
      <path d="M60 18 V9" stroke="#8892a6" strokeWidth={2.5} />
      <motion.g
        style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
        animate={spin ? { rotate: 360 } : undefined}
        transition={spin ? { duration: 1.2, repeat: Infinity, ease: "linear" } : undefined}
      >
        <ellipse cx={51} cy={8} rx={9} ry={3} fill="#ff5d73" />
        <ellipse cx={69} cy={8} rx={9} ry={3} fill="#3a86ff" />
      </motion.g>
    </>
  ),
  "hat-top": () => (
    <>
      <rect x={46} y={6} width={28} height={32} rx={2} fill="#2b2b36" />
      <rect x={46} y={28} width={28} height={6} fill="#e63946" />
      <ellipse cx={60} cy={38} rx={26} ry={5} fill="#1f1f2a" />
    </>
  ),
};

const star = (cx: number, cy: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.5 : r;
    return `${(cx + Math.cos(a) * d).toFixed(1)},${(cy + Math.sin(a) * d).toFixed(1)}`;
  }).join(" ");
const heart = (cx: number, cy: number) => `M${cx} ${cy + 8} C${cx - 14} ${cy - 2} ${cx - 8} ${cy - 12} ${cx} ${cy - 5} C${cx + 8} ${cy - 12} ${cx + 14} ${cy - 2} ${cx} ${cy + 8} Z`;

// Glasses are drawn for eyes at y = 64 and moved to the character's eyeY.
export const glassesArt: Record<string, () => ReactNode> = {
  "glasses-round": () => (
    <g stroke="#3b2f66" strokeWidth={3} fill="#ffffff" fillOpacity={0.15}>
      <circle cx={49} cy={64} r={9.5} />
      <circle cx={71} cy={64} r={9.5} />
      <path d="M58.5 63 Q60 60 61.5 63" fill="none" />
    </g>
  ),
  "glasses-sun": () => (
    <>
      <rect x={38} y={57} width={21} height={14} rx={6} fill="#1f1f2a" />
      <rect x={61} y={57} width={21} height={14} rx={6} fill="#1f1f2a" />
      <path d="M59 62 h2" stroke="#1f1f2a" strokeWidth={3} />
      <path d="M42 61 l5 -2 M65 61 l5 -2" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.6} />
    </>
  ),
  "glasses-star": () => (
    <g fill="#ff7eb6" fillOpacity={0.55} stroke="#e0408a" strokeWidth={2} strokeLinejoin="round">
      <polygon points={star(49, 64, 13)} />
      <polygon points={star(71, 64, 13)} />
    </g>
  ),
  "glasses-heart": () => (
    <g fill="#ff4d6d" fillOpacity={0.55} stroke="#d6264a" strokeWidth={2}>
      <path d={heart(48, 64)} />
      <path d={heart(72, 64)} />
    </g>
  ),
  "glasses-goggles": () => (
    <>
      <rect x={24} y={60} width={72} height={7} rx={3} fill="#6b4f3a" />
      <circle cx={48} cy={64} r={10.5} fill="#9be7ff" fillOpacity={0.6} stroke="#a5753d" strokeWidth={4} />
      <circle cx={72} cy={64} r={10.5} fill="#9be7ff" fillOpacity={0.6} stroke="#a5753d" strokeWidth={4} />
    </>
  ),
};

// Backgrounds fill the avatar's circle; `id` keeps gradient ids unique per avatar on the page.
export const backgroundArt: Record<string, (id: string) => ReactNode> = {
  "bg-sky": (id) => (
    <>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#9fd8ff" />
        <stop offset="1" stopColor="#e9f7ff" />
      </linearGradient>
      <rect width={120} height={120} fill={`url(#${id})`} />
      <ellipse cx={24} cy={28} rx={14} ry={6} fill="#fff" />
      <ellipse cx={98} cy={40} rx={12} ry={5} fill="#fff" />
    </>
  ),
  "bg-meadow": (id) => (
    <>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#bfe9ff" />
        <stop offset="1" stopColor="#f2fbff" />
      </linearGradient>
      <rect width={120} height={120} fill={`url(#${id})`} />
      <path d="M0 92 Q60 70 120 92 V120 H0 Z" fill="#7ed36b" />
      {[14, 30, 92, 106].map((x) => (
        <circle key={x} cx={x} cy={96 + (x % 3)} r={2.5} fill={x % 2 ? "#ff7eb6" : "#ffd23f"} />
      ))}
    </>
  ),
  "bg-rainbow": () => (
    <>
      <rect width={120} height={120} fill="#fff5e6" />
      {["#ff6b6b", "#ff9f1c", "#ffd23f", "#2ec27e", "#3a86ff", "#7c4dff"].map((c, i) => (
        <circle key={c} cx={60} cy={118} r={70 - i * 8} fill="none" stroke={c} strokeWidth={8} opacity={0.75} />
      ))}
    </>
  ),
  "bg-ocean": (id) => (
    <>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6fd0ff" />
        <stop offset="1" stopColor="#1e7fc4" />
      </linearGradient>
      <rect width={120} height={120} fill={`url(#${id})`} />
      <path d="M0 30 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 t20 0" stroke="#bdeeff" strokeWidth={3} fill="none" />
      {[
        [18, 70, 4],
        [24, 54, 2.5],
        [102, 80, 3.5],
        [96, 62, 2],
      ].map(([x, y, r]) => (
        <circle key={`${x}`} cx={x} cy={y} r={r} fill="none" stroke="#fff" strokeWidth={1.5} opacity={0.8} />
      ))}
    </>
  ),
  "bg-space": () => (
    <>
      <rect width={120} height={120} fill="#1b1f4b" />
      {[
        [16, 20],
        [34, 100],
        [100, 92],
        [20, 66],
        [108, 60],
        [76, 14],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} fill="#fff" />
      ))}
      <circle cx={96} cy={28} r={10} fill="#ffb74d" />
      <ellipse cx={96} cy={28} rx={17} ry={4} fill="none" stroke="#ffe0a3" strokeWidth={2} />
    </>
  ),
  "bg-sunset": (id) => (
    <>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffcf6b" />
        <stop offset="1" stopColor="#ff6f91" />
      </linearGradient>
      <rect width={120} height={120} fill={`url(#${id})`} />
      <circle cx={60} cy={104} r={28} fill="#ffe29a" opacity={0.8} />
    </>
  ),
  "bg-galaxy": (id) => (
    <>
      <radialGradient id={id}>
        <stop offset="0" stopColor="#9b6bff" />
        <stop offset="1" stopColor="#1a0b3d" />
      </radialGradient>
      <rect width={120} height={120} fill={`url(#${id})`} />
      {Array.from({ length: 14 }, (_, i) => {
        const a = i * 0.9;
        const d = 12 + i * 3.4;
        return <circle key={i} cx={60 + Math.cos(a) * d} cy={60 + Math.sin(a) * d} r={i % 3 ? 1.2 : 2} fill="#fff" opacity={0.85} />;
      })}
      <polygon points={star(20, 22, 5)} fill="#ffe680" />
      <polygon points={star(100, 98, 4)} fill="#ffe680" />
    </>
  ),
};

export type Slot = "hat" | "glasses" | "background";
export const slotOf = (id: string): Slot | null =>
  id in hatArt ? "hat" : id in glassesArt ? "glasses" : id in backgroundArt ? "background" : null;
