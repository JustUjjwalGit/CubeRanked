import { motion } from "framer-motion";
import { stateLabel } from "../utils/helpers";
import { formatTime } from "../utils/sessionStats";
import type { GameStage } from "../state/gameStateMachine";
import type { Penalty } from "../utils/scramble";

type PlayableStage = Extract<GameStage, "COUNTDOWN" | "READY" | "INSPECTION" | "PLAYING" | "SOLVED" | "RESULT">;

export default function CompactTimer({
  stage,
  elapsedMs,
  inspectionRemaining,
  penalty,
}: {
  stage: PlayableStage;
  elapsedMs: number;
  inspectionRemaining: number;
  penalty: Penalty;
}) {
  return (
    <motion.div
      className={`compact-timer phase-${stage.toLowerCase()}`}
      animate={{ y: stage === "PLAYING" ? -2 : 0 }}
      transition={{ type: "spring", stiffness: 190, damping: 18 }}
    >
      <span>{stateLabel(stage)}</span>
      <strong>{stage === "INSPECTION" ? inspectionRemaining.toFixed(1) : formatTime(elapsedMs)}</strong>
      {penalty !== "none" ? <small>{penalty}</small> : null}
    </motion.div>
  );
}
