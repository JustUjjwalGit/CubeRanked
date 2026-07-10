import { motion } from "framer-motion";
import { Play, RotateCcw, Settings, Home as HomeIcon, Gamepad2 } from "lucide-react";
import type { GameMode } from "../state/gameStateMachine";

export default function PauseMenu({
  mode,
  onResume,
  onRestart,
  onSettings,
  onHome,
}: {
  mode: GameMode;
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onHome: () => void;
}) {
  return (
    <motion.div
      className="modal-backdrop pause-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        className="pause-menu"
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 170, damping: 20 }}
      >
        <span>Paused</span>
        <h2>{mode === "ranked" ? "Ranked" : mode === "bot-race" ? "Bot Race" : "Practice"}</h2>
        <div className="pause-actions">
          <button type="button" className="primary" onClick={onResume}>
            <Play size={16} aria-hidden="true" />
            Resume
          </button>
          <button type="button" onClick={onRestart}>
            <RotateCcw size={16} aria-hidden="true" />
            Reset Cube
          </button>
          <button type="button" onClick={onSettings}>
            <Settings size={16} aria-hidden="true" />
            Settings
          </button>
          <button type="button" onClick={onHome}>
            {mode === "private" ? (
              <>
                <Gamepad2 size={16} aria-hidden="true" />
                Exit to Lobby
              </>
            ) : (
              <>
                <HomeIcon size={16} aria-hidden="true" />
                Return Home
              </>
            )}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}
