import { motion } from "framer-motion";
import CubeScene from "./cube/CubeScene";
import { statusText, type RaceOpponentSnapshot, type AnimatedCubeState } from "../utils/botRace";
import { formatTime } from "../utils/sessionStats";

interface BotRaceStats {
  wins: number;
  losses: number;
}

export default function OpponentPanel({
  opponent,
  opponentCube,
  theme,
  stats,
  onFrame,
}: {
  opponent: RaceOpponentSnapshot;
  opponentCube: AnimatedCubeState;
  theme: "dark" | "light";
  stats: BotRaceStats;
  onFrame: (deltaSeconds: number) => void;
}) {
  return (
    <motion.aside
      className={`opponent-card status-${opponent.status}`}
      initial={{ x: 24, opacity: 0, scale: 0.98 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 24, opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 160, damping: 20 }}
    >
      <div className="opponent-head">
        <div className="opponent-avatar" style={{ background: opponent.avatarColor }}>
          {opponent.avatar}
        </div>
        <div>
          <strong>{opponent.name}</strong>
          <span>{opponent.difficultyLabel ?? "Opponent"}</span>
        </div>
      </div>

      <div className="opponent-cube-wrap">
        <CubeScene
          theme={theme}
          cube={opponentCube.cube}
          activeMove={opponentCube.activeMove}
          onFrame={onFrame}
          interactive={false}
          compact
        />
      </div>

      <div className="opponent-footer">
        <div>
          <span>{statusText(opponent.status)}</span>
          <strong>{formatTime(opponent.finalTimeMs ?? opponent.elapsedMs)}</strong>
        </div>
        <div>
          <span>{opponent.source === "bot" ? "Record" : "Ping"}</span>
          <strong>{opponent.source === "bot" ? `${stats.wins}-${stats.losses}` : opponent.pingMs === null || opponent.pingMs === undefined ? "-- ms" : `${opponent.pingMs} ms`}</strong>
        </div>
      </div>
    </motion.aside>
  );
}
