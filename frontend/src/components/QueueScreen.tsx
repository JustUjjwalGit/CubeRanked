import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import AppBackground from "./AppBackground";
import { formatTime } from "../utils/sessionStats";
import { connectionLabel } from "../utils/helpers";
import type { QueueUpdatePayload, SocketConnectionState } from "../network/socketTypes";

export default function QueueScreen({
  queue,
  connectionState,
  onCancel,
}: {
  queue: QueueUpdatePayload;
  connectionState: SocketConnectionState;
  onCancel: () => void;
}) {
  const [localElapsedMs, setLocalElapsedMs] = useState(queue.elapsedMs);

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
        <button type="button" onClick={onCancel}>
          <X size={16} aria-hidden="true" />
          Cancel
        </button>
      </motion.div>
    </motion.section>
  );
}
