import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, X, Wifi, MapPin } from "lucide-react";
import AppBackground from "./AppBackground";
import { formatTime } from "../utils/sessionStats";
import { connectionLabel } from "../utils/helpers";
import { getRankFromElo, getRankProgress } from "../utils/ranks";
import type { QueueUpdatePayload, SocketConnectionState } from "../network/socketTypes";

export default function QueueScreen({
  queue,
  connectionState,
  userElo,
  userPlacementMatches,
  onCancel,
}: {
  queue: QueueUpdatePayload;
  connectionState: SocketConnectionState;
  userElo?: number;
  userPlacementMatches?: number;
  onCancel: () => void;
}) {
  const [localElapsedMs, setLocalElapsedMs] = useState(queue.elapsedMs);
  const elo = userElo ?? 1200;
  const inPlacement = userPlacementMatches != null && userPlacementMatches < 10;
  const rank = getRankFromElo(elo, inPlacement);
  const progress = !inPlacement ? getRankProgress(elo, false) : null;

  useEffect(() => {
    const startedAt = Date.now() - queue.elapsedMs;
    const interval = window.setInterval(() => {
      setLocalElapsedMs(Date.now() - startedAt);
    }, 100);

    return () => window.clearInterval(interval);
  }, [queue.elapsedMs]);

  return (
    <motion.section
      className="queue-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <AppBackground />
      <motion.div
        className="queue-card"
        initial={{ y: 18, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -12, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 160, damping: 22 }}
      >
        <div className="search-orbit">
          <Loader2 className="loading-spinner" size={30} aria-hidden="true" />
        </div>
        <span>Searching for opponent...</span>

        <div className="queue-rank-display" style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.04)", borderRadius: "16px", padding: "12px 20px", width: "100%" }}>
          <div className="rank-badge" style={{ borderColor: rank.color, color: rank.color, width: "40px", height: "40px", fontSize: "1rem" }}>
            {rank.badge}
          </div>
          <div>
            <div style={{ fontSize: "0.82rem", fontWeight: 800, color: rank.color }}>
              {inPlacement ? "Placement Matches" : `${rank.tier}${rank.division ? ` ${rank.division}` : ""}`}
            </div>
            <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600 }}>
              {inPlacement ? `Match ${Math.min(userPlacementMatches ?? 0, 10)}/10` : `${elo} ELO`}
            </div>
          </div>
          {progress && progress.nextRank && (
            <div style={{ flex: 1, marginLeft: "8px" }}>
              <div className="rank-progress-track" style={{ height: "4px" }}>
                <div className="rank-progress-fill" style={{ width: `${Math.round(progress.progress * 100)}%`, background: rank.color }} />
              </div>
            </div>
          )}
        </div>

        <div className="queue-grid">
          <div>
            <small>Elapsed</small>
            <strong>{formatTime(localElapsedMs)}</strong>
          </div>
          <div>
            <small>Estimated Wait</small>
            <strong>{queue.estimatedWaitMs === null ? "--" : formatTime(queue.estimatedWaitMs)}</strong>
          </div>
          <div>
            <small>Status</small>
            <strong>{connectionLabel(connectionState)}</strong>
          </div>
        </div>

        <div className="queue-grid" style={{ marginTop: "0" }}>
          <div>
            <small><MapPin size={12} style={{ display: "inline", marginRight: "4px" }} />Region</small>
            <strong>Auto</strong>
          </div>
          <div>
            <small><Wifi size={12} style={{ display: "inline", marginRight: "4px" }} />Ping</small>
            <strong id="queue-ping">-- ms</strong>
          </div>
          <div>
            <small>Players</small>
            <strong>{queue.queuePosition ?? 1} ahead</strong>
          </div>
        </div>

        <button type="button" onClick={onCancel}>
          <X size={16} aria-hidden="true" />
          Cancel
        </button>
      </motion.div>
    </motion.section>
  );
}
