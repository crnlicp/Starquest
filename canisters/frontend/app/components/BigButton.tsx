import { motion, type HTMLMotionProps } from "framer-motion";
import { useSound } from "~/lib/sound";

type Props = HTMLMotionProps<"button"> & { variant?: "primary" | "secondary" | "kid" | "danger" | "good" | "oops" };

export function BigButton({ variant = "primary", className = "", onClick, ...rest }: Props) {
  const play = useSound();
  return (
    <motion.button
      type="button"
      className={`big-button big-button--${variant} ${className}`}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.88, rotate: -2 }}
      transition={{ type: "spring", stiffness: 500, damping: 15 }}
      onClick={(e) => {
        play("pop");
        onClick?.(e);
      }}
      {...rest}
    />
  );
}
