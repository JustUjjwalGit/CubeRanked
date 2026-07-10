import { motion } from "framer-motion";
import { X, Gamepad2, Lock } from "lucide-react";

const playModes = [
  { title: "Practice", description: "Offline 3x3 trainer", available: true, mode: "practice" },
  { title: "Bot Race", description: "Race a human-like opponent", available: true, mode: "bot-race" },
  { title: "Ranked", description: "Find a live opponent", available: true, mode: "ranked" },
  { title: "Private Room", description: "Invite-only lobby", available: true, mode: "private" },
  { title: "Weekly Challenge", description: "Rotating official scramble", available: false, mode: "weekly" },
] as const;

export default function PlayModal({
  onClose,
  onPractice,
  onBotRace,
  onRanked,
  onPrivate,
  onLockedMode,
}: {
  onClose: () => void;
  onPractice: () => void;
  onBotRace: () => void;
  onRanked: () => void;
  onPrivate: () => void;
  onLockedMode: (mode: string) => void;
}) {
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        className="play-modal"
        initial={{ y: 30, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 170, damping: 20 }}
      >
        <div className="modal-head">
          <div>
            <span>Play</span>
            <h2>Select Mode</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close play menu">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="mode-grid">
          {playModes.map((mode) => (
            <button
              type="button"
              key={mode.title}
              className={mode.available ? "mode-card available" : "mode-card locked"}
              onClick={
                mode.mode === "practice"
                  ? onPractice
                  : mode.mode === "bot-race"
                    ? onBotRace
                    : mode.mode === "ranked"
                      ? onRanked
                      : mode.mode === "private"
                        ? onPrivate
                        : () => onLockedMode(mode.title)
              }
            >
              <div className="mode-icon">
                {mode.available ? <Gamepad2 size={24} aria-hidden="true" /> : <Lock size={22} aria-hidden="true" />}
              </div>
              <strong>{mode.title}</strong>
              <span>{mode.description}</span>
              <small>{mode.available ? "Available" : "Locked"}</small>
            </button>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}
