import { motion } from "framer-motion";
import type { CSSProperties } from "react";

export default function SolvedOverlay() {
  const confetti = Array.from({ length: 16 }, (_, index) => index);

  return (
    <motion.div
      className="solved-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <motion.div
        className="solved-glow"
        initial={{ scale: 0.72, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 150, damping: 18 }}
      />
      {confetti.map((item) => (
        <span key={item} style={{ "--burst-index": item } as CSSProperties} />
      ))}
      <motion.strong
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.08 }}
      >
        SOLVED
      </motion.strong>
    </motion.div>
  );
}
