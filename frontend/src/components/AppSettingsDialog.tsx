import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Moon, Sun, Keyboard, X } from "lucide-react";
import { DEFAULT_SETTINGS, type SessionSettings } from "../utils/sessionStats";
import type { Face } from "../utils/cubeEngine";

type SettingsCategory = "General" | "Appearance" | "Camera" | "Controls" | "Cube" | "Graphics" | "Audio" | "Accessibility";

export default function AppSettingsDialog({
  category,
  settings,
  onCategory,
  onClose,
  onSettings,
}: {
  category: SettingsCategory;
  settings: SessionSettings;
  onCategory: (category: SettingsCategory) => void;
  onClose: () => void;
  onSettings: (settings: Partial<SessionSettings>) => void;
}) {
  const categories: SettingsCategory[] = ["General", "Appearance", "Camera", "Controls", "Cube", "Graphics", "Audio", "Accessibility"];
  const [listeningFace, setListeningFace] = useState<Face | null>(null);

  useEffect(() => {
    if (!listeningFace) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setListeningFace(null);
        return;
      }

      const key = event.key.toUpperCase();
      const currentBindings = settings.keybindings || DEFAULT_SETTINGS.keybindings;
      const updatedBindings = {
        ...currentBindings,
        [listeningFace]: key,
      };

      onSettings({ keybindings: updatedBindings });
      setListeningFace(null);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [listeningFace, onSettings, settings.keybindings]);

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        className="settings-dialog"
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 170, damping: 20 }}
      >
        <div className="modal-head">
          <div>
            <span>Application</span>
            <h2>Settings</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close settings">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="settings-layout">
          <nav className="settings-tabs">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                className={category === item ? "selected" : ""}
                onClick={() => onCategory(item)}
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="settings-content">
            <h3>{category}</h3>
            {category === "Appearance" ? (
              <div className="theme-toggle-container">
                <button
                  className={`premium-theme-toggle ${settings.theme === "dark" ? "is-dark" : "is-light"}`}
                  onClick={() => onSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
                  aria-label="Toggle theme"
                >
                  <motion.div
                    className="theme-toggle-orb"
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    {settings.theme === "dark" ? (
                      <Moon size={14} className="theme-icon-dark" />
                    ) : (
                      <Sun size={14} className="theme-icon-light" />
                    )}
                  </motion.div>
                  <div className="theme-toggle-bg" />
                </button>
              </div>
            ) : category === "Cube" || category === "Graphics" ? (
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
            ) : category === "Controls" ? (
              <>
                <label className="switch-row compact">
                  <span>Show Keyboard Cheat Sheet</span>
                  <input
                    type="checkbox"
                    checked={settings.showKeyboardCheatSheet}
                    onChange={(event) => onSettings({ showKeyboardCheatSheet: event.target.checked })}
                  />
                </label>
                <div className="keyboard-rebinds-section">
                  <div className="section-title">
                    <Keyboard size={16} />
                    <h4>Keyboard Rebinds</h4>
                  </div>
                  <div className="rebinds-grid">
                    {(["U", "R", "F", "D", "L", "B"] as Face[]).map((face) => {
                      const label = {
                        U: "Up (U)",
                        R: "Right (R)",
                        F: "Front (F)",
                        D: "Down (D)",
                        L: "Left (L)",
                        B: "Back (B)",
                      }[face];
                      const boundKey = (settings.keybindings || DEFAULT_SETTINGS.keybindings)[face];
                      const isListening = listeningFace === face;

                      return (
                        <div key={face} className="rebind-row">
                          <span>{label}</span>
                          <button
                            type="button"
                            className={`rebind-key-btn ${isListening ? "listening" : ""}`}
                            onClick={() => setListeningFace(face)}
                          >
                            {isListening ? "Press key..." : boundKey}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {listeningFace && (
                    <div className="rebind-tip">
                      Press any key to bind, or ESC to cancel
                    </div>
                  )}
                </div>
              </>
            ) : category === "Camera" ? (
              <div className="camera-settings-section" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 600 }}>Camera Mode</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <button
                      type="button"
                      className={`mode-tab-btn ${settings.cameraMode === "competitive" ? "selected" : ""}`}
                      onClick={() => onSettings({ cameraMode: "competitive" })}
                      style={{
                        padding: "10px",
                        borderRadius: "8px",
                        background: settings.cameraMode === "competitive" ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.03)",
                        border: settings.cameraMode === "competitive" ? "1px solid #6366f1" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: settings.cameraMode === "competitive" ? "#e0e7ff" : "#94a3b8",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        transition: "all 150ms ease"
                      }}
                    >
                      Competitive
                    </button>
                    <button
                      type="button"
                      className={`mode-tab-btn ${settings.cameraMode === "free-orbit" ? "selected" : ""}`}
                      onClick={() => onSettings({ cameraMode: "free-orbit" })}
                      style={{
                        padding: "10px",
                        borderRadius: "8px",
                        background: settings.cameraMode === "free-orbit" ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.03)",
                        border: settings.cameraMode === "free-orbit" ? "1px solid #6366f1" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: settings.cameraMode === "free-orbit" ? "#e0e7ff" : "#94a3b8",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        transition: "all 150ms ease"
                      }}
                    >
                      Free Orbit
                    </button>
                  </div>
                  <small style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "4px" }}>
                    {settings.cameraMode === "competitive" 
                      ? "Competitive Mode uses a fixed, optimized view angle for standard plays." 
                      : "Free Orbit Mode allows unrestricted rotation and zoom to inspect the cube from any angle."}
                  </small>
                </div>

                <label className="switch-row compact">
                  <span>Invert Vertical Rotation</span>
                  <input
                    type="checkbox"
                    checked={settings.cameraInvertVertical}
                    onChange={(event) => onSettings({ cameraInvertVertical: event.target.checked })}
                  />
                </label>

                <label className="range-row compact">
                  <span>Mouse Sensitivity ({settings.cameraSensitivity.toFixed(1)}x)</span>
                  <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.1"
                    value={settings.cameraSensitivity}
                    onChange={(event) => onSettings({ cameraSensitivity: Number(event.target.value) })}
                  />
                </label>

                <label className="range-row compact">
                  <span>Zoom Speed ({settings.cameraZoomSpeed.toFixed(1)}x)</span>
                  <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.1"
                    value={settings.cameraZoomSpeed}
                    onChange={(event) => onSettings({ cameraZoomSpeed: Number(event.target.value) })}
                  />
                </label>
              </div>
            ) : (
              <div className="settings-placeholder">
                {category} preferences will live here as the client grows.
              </div>
            )}
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
