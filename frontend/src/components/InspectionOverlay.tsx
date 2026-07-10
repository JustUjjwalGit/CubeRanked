import { motion } from "framer-motion";
import type { Penalty } from "../utils/scramble";

export default function InspectionOverlay({
  inspectionRemaining,
  penalty,
}: {
  inspectionRemaining: number;
  penalty: Penalty;
}) {
  return (
    <motion.div
      className="inspection-overlay"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.24 }}
    >
      <span>INSPECTION</span>
      <strong>{inspectionRemaining.toFixed(1)}</strong>
      <small>{penalty === "none" ? "First move starts timer" : penalty}</small>
    </motion.div>
  );
}
