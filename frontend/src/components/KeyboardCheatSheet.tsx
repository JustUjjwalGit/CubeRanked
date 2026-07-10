import { motion } from "framer-motion";
import { Keyboard } from "lucide-react";
import { DEFAULT_SETTINGS, type SessionSettings } from "../utils/sessionStats";

export default function KeyboardCheatSheet({ settings }: { settings: SessionSettings }) {
  const bindings = settings.keybindings || DEFAULT_SETTINGS.keybindings;

  const moveRows: Array<{ key: string; shift?: string; label: string }> = [
    { key: bindings.R || "R", shift: `Shift+${bindings.R || "R"}`, label: "Right" },
    { key: bindings.L || "L", shift: `Shift+${bindings.L || "L"}`, label: "Left" },
    { key: bindings.U || "U", shift: `Shift+${bindings.U || "U"}`, label: "Up" },
    { key: bindings.D || "D", shift: `Shift+${bindings.D || "D"}`, label: "Down" },
    { key: bindings.F || "F", shift: `Shift+${bindings.F || "F"}`, label: "Front" },
    { key: bindings.B || "B", shift: `Shift+${bindings.B || "B"}`, label: "Back" },
  ];

  const cameraRows = [
    { key: "Mouse Drag", label: "Rotate View" },
    { key: "Scroll", label: "Zoom" },
  ];

  const actionRows = [
    { key: "Space", label: "Inspect / Start" },
    { key: "Esc", label: "Pause" },
  ];

  return (
    <motion.aside
      className="kbd-panel"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
    >
      <div className="kbd-panel-header">
        <Keyboard size={13} aria-hidden="true" />
        <span>Controls</span>
      </div>

      <div className="kbd-section">
        <div className="kbd-section-label">Moves</div>
        {moveRows.map((row) => (
          <div key={row.key} className="kbd-row">
            <div className="kbd-keys">
              <kbd className="kbd-key">{row.key}</kbd>
              {row.shift && <kbd className="kbd-key modifier">{row.shift}</kbd>}
            </div>
            <span className="kbd-label">{row.label}</span>
          </div>
        ))}
      </div>

      <div className="kbd-section">
        <div className="kbd-section-label">Camera</div>
        {cameraRows.map((row) => (
          <div key={row.key} className="kbd-row">
            <div className="kbd-keys">
              <kbd className="kbd-key">{row.key}</kbd>
            </div>
            <span className="kbd-label">{row.label}</span>
          </div>
        ))}
      </div>

      <div className="kbd-section">
        <div className="kbd-section-label">Actions</div>
        {actionRows.map((row) => (
          <div key={row.key} className="kbd-row">
            <div className="kbd-keys">
              <kbd className="kbd-key">{row.key}</kbd>
            </div>
            <span className="kbd-label">{row.label}</span>
          </div>
        ))}
      </div>
    </motion.aside>
  );
}
