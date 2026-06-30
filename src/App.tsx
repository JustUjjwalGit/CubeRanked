import { AnimatePresence, motion } from "framer-motion";
import {
  Gauge,
  History,
  RotateCcw,
  Shuffle,
  StepBack,
  TimerReset,
} from "lucide-react";
import { useEffect } from "react";
import CubeScene from "./components/cube/CubeScene";
import { MOVE_FACES, type Face } from "./lib/cubeEngine";
import { useCubeStore, type TurnMode } from "./state/cubeStore";

const turnModes: Array<{ mode: TurnMode; label: string }> = [
  { mode: "normal", label: "90" },
  { mode: "prime", label: "90'" },
  { mode: "double", label: "180" },
];

export default function App() {
  const activeMove = useCubeStore((state) => state.activeMove);
  const moveQueue = useCubeStore((state) => state.moveQueue);
  const history = useCubeStore((state) => state.history);
  const playFace = useCubeStore((state) => state.playFace);
  const resetCube = useCubeStore((state) => state.resetCube);
  const scrambleCube = useCubeStore((state) => state.scrambleCube);
  const undoLast = useCubeStore((state) => state.undoLast);
  const turnMode = useCubeStore((state) => state.turnMode);
  const setTurnMode = useCubeStore((state) => state.setTurnMode);
  const turnDuration = useCubeStore((state) => state.turnDuration);
  const setTurnDuration = useCubeStore((state) => state.setTurnDuration);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toUpperCase();

      if (!MOVE_FACES.includes(key as Face)) {
        return;
      }

      event.preventDefault();
      playFace(key as Face);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playFace]);

  const lastMoves = history.slice(-8).map((move) => move.notation);

  return (
    <main className="app-shell">
      <CubeScene />

      <motion.header
        className="top-bar"
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 130, damping: 18 }}
      >
        <div>
          <p className="eyebrow">CubeRanked</p>
          <h1>3x3 Arena Engine</h1>
        </div>
        <div className="status-pill">
          <span className={activeMove ? "status-dot active" : "status-dot"} />
          {activeMove ? activeMove.move.notation : "Ready"}
        </div>
      </motion.header>

      <motion.aside
        className="control-dock"
        initial={{ x: -28, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.08 }}
      >
        <section className="panel-section">
          <div className="section-heading">
            <Gauge size={17} aria-hidden="true" />
            <span>Turns</span>
          </div>

          <div className="mode-tabs" role="tablist" aria-label="Turn amount">
            {turnModes.map((item) => (
              <button
                key={item.mode}
                type="button"
                className={turnMode === item.mode ? "mode-tab selected" : "mode-tab"}
                onClick={() => setTurnMode(item.mode)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="move-grid" aria-label="Cube face controls">
            {MOVE_FACES.map((face) => (
              <button
                key={face}
                type="button"
                className="face-button"
                onClick={() => playFace(face)}
              >
                {face}
              </button>
            ))}
          </div>
        </section>

        <section className="panel-section">
          <div className="section-heading">
            <TimerReset size={17} aria-hidden="true" />
            <span>Speed</span>
          </div>
          <input
            className="speed-slider"
            type="range"
            min="0.12"
            max="0.5"
            step="0.01"
            value={turnDuration}
            aria-label="Turn speed"
            onChange={(event) => setTurnDuration(Number(event.target.value))}
          />
          <div className="speed-readout">
            <span>{Math.round((1 / turnDuration) * 60)} TPS feel</span>
            <span>{Math.round(turnDuration * 1000)} ms</span>
          </div>
        </section>

        <section className="panel-section utility-row" aria-label="Cube utilities">
          <button type="button" className="utility-button" onClick={scrambleCube} title="Scramble">
            <Shuffle size={18} aria-hidden="true" />
          </button>
          <button type="button" className="utility-button" onClick={undoLast} title="Undo">
            <StepBack size={18} aria-hidden="true" />
          </button>
          <button type="button" className="utility-button" onClick={resetCube} title="Reset">
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        </section>
      </motion.aside>

      <motion.section
        className="match-strip"
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 130, damping: 18, delay: 0.16 }}
      >
        <div className="strip-item">
          <span>Cube</span>
          <strong>3x3</strong>
        </div>
        <div className="strip-item">
          <span>Queue</span>
          <strong>{moveQueue.length}</strong>
        </div>
        <div className="strip-item history-item">
          <History size={16} aria-hidden="true" />
          <AnimatePresence mode="popLayout">
            {lastMoves.length > 0 ? (
              <motion.div
                key={lastMoves.join("-")}
                className="move-history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {lastMoves.map((move, index) => (
                  <span key={`${move}-${index}`}>{move}</span>
                ))}
              </motion.div>
            ) : (
              <motion.strong
                key="fresh"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Fresh
              </motion.strong>
            )}
          </AnimatePresence>
        </div>
      </motion.section>
    </main>
  );
}
