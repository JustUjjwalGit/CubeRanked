import { motion } from "framer-motion";
import AppBackground from "./AppBackground";
import type { GameMode } from "../state/gameStateMachine";

function CubeLoader() {
  const faceSize = 22;
  const gap = 1;
  const cubeSize = faceSize * 3 + gap * 2;

  return (
    <motion.div
      className="cube-loader"
      animate={{ rotateX: 360, rotateY: 360 }}
      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      style={{
        width: cubeSize,
        height: cubeSize,
        position: "relative",
        transformStyle: "preserve-3d",
        perspective: 600,
      }}
    >
      {[
        { face: "front", color: "#22c55e", transform: `translateZ(${cubeSize / 2}px)` },
        { face: "back", color: "#3b82f6", transform: `rotateY(180deg) translateZ(${cubeSize / 2}px)` },
        { face: "right", color: "#ef4444", transform: `rotateY(90deg) translateZ(${cubeSize / 2}px)` },
        { face: "left", color: "#f97316", transform: `rotateY(-90deg) translateZ(${cubeSize / 2}px)` },
        { face: "top", color: "#f8fafc", transform: `rotateX(90deg) translateZ(${cubeSize / 2}px)` },
        { face: "bottom", color: "#facc15", transform: `rotateX(-90deg) translateZ(${cubeSize / 2}px)` },
      ].map(({ face, color, transform }) => (
        <div
          key={face}
          style={{
            position: "absolute",
            width: cubeSize,
            height: cubeSize,
            transform,
            display: "grid",
            gridTemplateColumns: `repeat(3, ${faceSize}px)`,
            gridTemplateRows: `repeat(3, ${faceSize}px)`,
            gap,
            backfaceVisibility: "hidden",
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: faceSize,
                height: faceSize,
                borderRadius: 3,
                background: color,
                opacity: 0.85 + Math.random() * 0.15,
              }}
            />
          ))}
        </div>
      ))}
    </motion.div>
  );
}

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
        <CubeLoader />
        <span>{status}</span>
        {mode === "ranked" ? <small>Loading cube... Synchronizing...</small> : null}
      </motion.div>
    </motion.section>
  );
}
