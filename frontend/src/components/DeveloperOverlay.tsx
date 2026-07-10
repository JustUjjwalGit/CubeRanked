import { motion } from "framer-motion";
import { connectionLabel } from "../utils/helpers";
import type { SocketDebugSnapshot } from "../network/socketTypes";

export default function DeveloperOverlay({ snapshot }: { snapshot: SocketDebugSnapshot }) {
  const rows = [
    ["Socket ID", snapshot.socketId ?? "-"],
    ["Current Match ID", snapshot.currentMatchId ?? "-"],
    ["Opponent Socket ID", snapshot.opponentSocketId ?? "-"],
    ["Queue Status", snapshot.queueStatus],
    ["Connection", connectionLabel(snapshot.connectionState)],
    ["Current RTT", snapshot.pingMs === null ? "-- ms" : `${snapshot.pingMs} ms`],
    ["Sync Delay", snapshot.synchronizationDelayMs === null ? "-- ms" : `${snapshot.synchronizationDelayMs} ms`],
    ["Packets Sent", snapshot.eventsSent.toLocaleString()],
    ["Packets Received", snapshot.eventsReceived.toLocaleString()],
  ];

  return (
    <motion.aside
      className="developer-overlay"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
    >
      <div className="developer-title">
        <span>F9</span>
        Developer
      </div>
      {rows.map(([label, value]) => (
        <div className="developer-row" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </motion.aside>
  );
}
