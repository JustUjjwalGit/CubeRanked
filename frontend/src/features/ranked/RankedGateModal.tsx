import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Trophy, X } from "lucide-react";

interface RankedGateModalProps {
  onClose: () => void;
  onGoogle: () => void;
}

const PERKS = [
  "Elo Rating & Rank",
  "Leaderboard Placement",
  "Match History Sync",
  "Seasonal Rewards",
  "Public Profile",
];

export default function RankedGateModal({ onClose, onGoogle }: RankedGateModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        className="ranked-gate-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          className="ranked-gate-modal"
          initial={{ opacity: 0, scale: 0.93, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 20 }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
        >
          <button
            type="button"
            className="ranked-gate-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>

          <div className="ranked-gate-header">
            <div className="ranked-gate-trophy">
              <Trophy size={24} />
            </div>
            <div>
              <h2>Ranked Play</h2>
              <p>Create a free account to compete in ranked matches.</p>
            </div>
          </div>

          <ul className="ranked-gate-perks">
            {PERKS.map((perk) => (
              <li key={perk}>
                <BadgeCheck size={16} />
                {perk}
              </li>
            ))}
          </ul>

          <div className="ranked-gate-actions">
            <button type="button" className="ranked-gate-btn google" onClick={onGoogle}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff" opacity=".9" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" opacity=".9" />
                <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" fill="#fff" opacity=".9" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#fff" opacity=".9" />
              </svg>
              Continue with Google
            </button>
          </div>

          <p className="ranked-gate-note">
            Already playing as guest? Your practice history will be preserved.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
