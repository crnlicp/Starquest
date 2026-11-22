import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import { useMotionLevel } from "~/lib/motion";

// Counts up or down to `value`; jumps straight there in calm mode.
export function NumberRoller({ value, className = "" }: { value: number; className?: string }) {
  const level = useMotionLevel();
  const count = useMotionValue(value);
  const text = useTransform(count, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    if (level === "reduced") {
      count.set(value);
      return;
    }
    const controls = animate(count, value, { duration: 0.8, ease: "easeOut" });
    return () => controls.stop();
  }, [value, level, count]);

  return (
    <motion.span className={`number-roller ${className}`} aria-live="polite" aria-label={String(value)}>
      {text}
    </motion.span>
  );
}
