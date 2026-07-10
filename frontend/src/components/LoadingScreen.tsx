import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import AppBackground from "./AppBackground";
import type { GameMode } from "../state/gameStateMachine";

export default function LoadingScreen({
  mode,
  opponent,
}: {
  mode: GameMode;
  opponent: string | null;
}) {
  const status = mode === "ranked"
    ? opponent
      ? `Opponent Found: ${opponent}`
      : "Preparing Match..."
    : "Generating Scramble...";

  return (
    <motion.section
      className="loading-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <AppBackground />
      <motion.div
        className="loading-card"
        initial={{ y: 18, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -12, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 160, damping: 22 }}
      >
        <Loader2 className="loading-spinner" size={28} aria-hidden="true" />
        <span>{status}</span>
        {mode === "ranked" ? <small>Loading cube... Synchronizing...</small> : null}
      </motion.div>
    </motion.section>
  );
}
