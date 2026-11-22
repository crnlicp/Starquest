import { motion, type HTMLMotionProps } from "framer-motion";

export function Card({ className = "", delay = 0, ...rest }: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      className={`card ${className}`}
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18, delay }}
      {...rest}
    />
  );
}
