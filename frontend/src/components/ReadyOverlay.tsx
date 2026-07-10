import { motion } from "framer-motion";

export default function ReadyOverlay({ inspectionEnabled, isSpectator }: { inspectionEnabled: boolean; isSpectator?: boolean }) {
  const message = isSpectator
    ? "Waiting for match to start..."
    : inspectionEnabled
    ? "Inspection starting..."
    : "Press any move key to start";

  return (
    <motion.div
      className="ready-overlay"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.24 }}
    >
      <span>READY</span>
      <strong>{message}</strong>
    </motion.div>
  );
}
