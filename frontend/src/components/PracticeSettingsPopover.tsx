import { AnimatePresence, motion } from "framer-motion";
import {
  RefreshCcw,
  StepBack,
  StepForward,
  Play,
  Copy,
  Clipboard,
  RotateCcw,
  Keyboard,
  X,
  Moon,
  Sun,
} from "lucide-react";
import { scrambleToString } from "../utils/scramble";
import { DEFAULT_SETTINGS, type SessionSettings } from "../utils/sessionStats";
import type { GameMode } from "../state/gameStateMachine";
import type { TurnMode } from "../state/cubeStore";

const turnModes: Array<{ mode: TurnMode; label: string }> = [
  { mode: "normal", label: "90" },
  { mode: "prime", label: "90'" },
  { mode: "double", label: "180" },
];

export default function PracticeSettingsPopover({
  mode,
  settings,
  scramble,
  showScramble,
  copyLabel,
  turnMode,
  allowReset,
  onClose,
  onGenerate,
  onReset,
  onUndo,
  onRedo,
  onReplay,
  onCopy,
  onToggleScramble,
  onSettings,
  onTurnMode,
  onOpenRebinds,
}: {
  mode: GameMode;
  settings: SessionSettings;
  scramble: string[];
  showScramble: boolean;
  copyLabel: string;
  turnMode: TurnMode;
  allowReset: boolean;
  onClose: () => void;
  onGenerate: () => void;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onReplay: () => void;
  onCopy: () => void;
  onToggleScramble: () => void;
  onSettings: (settings: Partial<SessionSettings>) => void;
  onTurnMode: (mode: TurnMode) => void;
  onOpenRebinds: () => void;
}) {
  const isRace = mode === "bot-race";

  return (
    <motion.aside
      className="practice-popover"
      initial={{ x: 26, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 26, opacity: 0 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
    >
      <div className="popover-head">
        <div>
          <span>{isRace ? "Bot Race" : "Practice"}</span>
          <h2>Settings</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close practice settings">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="popover-actions">
        <button type="button" onClick={onGenerate}><RefreshCcw size={16} />Generate New Scramble</button>
        {!isRace ? (
          <>
            <button type="button" onClick={onUndo}><StepBack size={16} />Undo</button>
            <button type="button" onClick={onRedo}><StepForward size={16} />Redo</button>
          </>
        ) : null}
        <button type="button" onClick={onReplay}><Play size={16} />Replay</button>
        <button type="button" onClick={onCopy}><Copy size={16} />{copyLabel}</button>
      </div>

      <button type="button" className="scramble-toggle" onClick={onToggleScramble}>
        <Clipboard size={16} aria-hidden="true" />
        {showScramble ? "Hide Scramble" : "Show Scramble"}
      </button>
      <AnimatePresence>
        {showScramble ? (
          <motion.div
            className="scramble-reveal"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {scrambleToString(scramble)}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="setting-block">
        <button 
          type="button" 
          className="danger-button compact" 
          onClick={onReset}
          disabled={!allowReset}
        >
          <RotateCcw size={16} aria-hidden="true" />
          Reset Cube
        </button>
        <label className="switch-row compact">
          <span>Keyboard Cheat Sheet</span>
          <input
            type="checkbox"
            checked={settings.showKeyboardCheatSheet}
            onChange={(event) => onSettings({ showKeyboardCheatSheet: event.target.checked })}
          />
        </label>
        <label className="range-row compact">
          <span>Animation Speed</span>
          <input
            type="range"
            min="0.1"
            max="0.45"
            step="0.01"
            value={settings.animationSpeed}
            onChange={(event) => onSettings({ animationSpeed: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="segmented-control">
        <button
          type="button"
          className={settings.theme === "dark" ? "selected" : ""}
          onClick={() => onSettings({ theme: "dark" })}
        >
          <Moon size={15} />
          Dark
        </button>
        <button
          type="button"
          className={settings.theme === "light" ? "selected" : ""}
          onClick={() => onSettings({ theme: "light" })}
        >
          <Sun size={15} />
          Light
        </button>
      </div>

      <div className="segmented-control three">
        {turnModes.map((mode) => (
          <button
            key={mode.mode}
            type="button"
            className={turnMode === mode.mode ? "selected" : ""}
            onClick={() => onTurnMode(mode.mode)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="keyboard-rebinds-popover-row">
        <button
          type="button"
          className="rebinds-redirect-btn"
          onClick={onOpenRebinds}
        >
          <Keyboard size={15} />
          <span>Configure Keybindings</span>
        </button>
      </div>
    </motion.aside>
  );
}
