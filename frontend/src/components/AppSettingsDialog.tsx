import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Keyboard, X, Download, Upload, RotateCcw } from "lucide-react";
import {
  DEFAULT_SETTINGS,
  type SessionSettings,
  type Face,
  type CubeStyle,
  type CameraFace,
  type AudioSettings,
} from "../utils/sessionStats";

type SettingsCategory =
  | "General"
  | "Appearance"
  | "Camera"
  | "Controls"
  | "Cube"
  | "Audio";

const CUBE_STYLES: { key: CubeStyle; label: string; desc: string }[] = [
  { key: "classic", label: "Classic", desc: "Original Rubik's cube appearance" },
  { key: "speedcube", label: "Speedcube", desc: "Smaller bevels, brighter plastic, modern GAN/Moyu style" },
  { key: "stickerless", label: "Stickerless", desc: "Pure plastic colors, no sticker borders" },
  { key: "minimal", label: "Minimal", desc: "Flat colors, very thin borders, clean esports style" },
];

const CAMERA_FACES: { key: CameraFace; label: string }[] = [
  { key: "white", label: "White" },
  { key: "yellow", label: "Yellow" },
  { key: "green", label: "Green" },
  { key: "blue", label: "Blue" },
  { key: "red", label: "Red" },
  { key: "orange", label: "Orange" },
];

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
  const categories: SettingsCategory[] = ["General", "Appearance", "Camera", "Controls", "Cube", "Audio"];
  const [listeningFace, setListeningFace] = useState<Face | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!listeningFace) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") { setListeningFace(null); return; }
      const key = event.key.toUpperCase();
      const currentBindings = settings.keybindings || DEFAULT_SETTINGS.keybindings;
      onSettings({ keybindings: { ...currentBindings, [listeningFace]: key } });
      setListeningFace(null);
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [listeningFace, onSettings, settings.keybindings]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.cubeStyle = settings.cubeStyle;
  }, [settings.theme, settings.cubeStyle]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cuberanked-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [settings]);

  const handleImport = useCallback((file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        onSettings(parsed);
      } catch {
        setImportError("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  }, [onSettings]);

  const handleRestoreDefaults = useCallback(() => {
    if (window.confirm("Restore all settings to defaults?")) {
      onSettings(DEFAULT_SETTINGS);
    }
  }, [onSettings]);

  const setAudio = useCallback((patch: Partial<AudioSettings>) => {
    onSettings({ audio: { ...settings.audio, ...patch } });
  }, [settings.audio, onSettings]);

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.08 } }}
    >
      <motion.section
        className="settings-dialog"
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 170, damping: 20 }}
        onClick={(e) => e.stopPropagation()}
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

            {category === "General" && (
              <div className="settings-scroll">
                <div className="settings-section">
                  <h4>Default Camera Face</h4>
                  <p className="settings-hint">Determines initial camera orientation and first visible face when entering Practice, Bot Race, or Ranked.</p>
                  <div className="settings-chip-group">
                    {CAMERA_FACES.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        className={`settings-chip ${settings.defaultCameraFace === f.key ? "active" : ""}`}
                        onClick={() => onSettings({ defaultCameraFace: f.key })}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-section">
                  <h4>HUD</h4>
                  <label className="switch-row compact">
                    <span>Show FPS Counter</span>
                    <input type="checkbox" checked={settings.showFpsCounter} onChange={(e) => onSettings({ showFpsCounter: e.target.checked })} />
                  </label>
                </div>
              </div>
            )}

            {category === "Appearance" && (
              <div className="settings-scroll">
                <div className="settings-section">
                  <h4>Theme</h4>
                  <div className="theme-toggle-container" style={{ marginTop: "8px" }}>
                    <button
                      className={`premium-theme-toggle ${settings.theme === "dark" ? "is-dark" : "is-light"}`}
                      onClick={() => onSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
                      aria-label="Toggle theme"
                    >
                      <motion.div className="theme-toggle-orb" layout transition={{ type: "spring", stiffness: 500, damping: 30 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="theme-icon-dark">
                          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                        </svg>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="theme-icon-light">
                          <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                        </svg>
                      </motion.div>
                      <div className="theme-toggle-bg" />
                    </button>
                    <span className="theme-label">{settings.theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
                  </div>
                </div>

                <div className="settings-section">
                  <h4>Display</h4>
                  <label className="range-row compact">
                    <span>UI Scale ({Math.round(settings.uiScale * 100)}%)</span>
                    <input type="range" min="0.8" max="1.2" step="0.05" value={settings.uiScale} onChange={(e) => onSettings({ uiScale: Number(e.target.value) })} />
                  </label>
                  <label className="switch-row compact">
                    <span>Reduced Motion</span>
                    <input type="checkbox" checked={settings.reducedMotion} onChange={(e) => onSettings({ reducedMotion: e.target.checked })} />
                  </label>
                </div>
              </div>
            )}

            {category === "Camera" && (
              <div className="settings-scroll">
                <div className="settings-section">
                  <h4>Camera Mode</h4>
                  <div className="settings-chip-group">
                    <button
                      type="button"
                      className={`settings-chip ${settings.cameraMode === "free-orbit" ? "active" : ""}`}
                      onClick={() => onSettings({ cameraMode: "free-orbit" })}
                    >
                      Free Orbit
                    </button>
                    <button
                      type="button"
                      className={`settings-chip ${settings.cameraMode === "competitive" ? "active" : ""}`}
                      onClick={() => onSettings({ cameraMode: "competitive" })}
                    >
                      Fixed Competitive
                    </button>
                  </div>
                  <p className="settings-hint">
                    {settings.cameraMode === "competitive"
                      ? "Fixed, optimized view angle for standard plays."
                      : "Unrestricted rotation and zoom from any angle."}
                  </p>
                </div>

                <div className="settings-section">
                  <label className="switch-row compact">
                    <span>Invert Vertical Rotation</span>
                    <input type="checkbox" checked={settings.cameraInvertVertical} onChange={(e) => onSettings({ cameraInvertVertical: e.target.checked })} />
                  </label>
                </div>

                <div className="settings-section">
                  <label className="range-row compact">
                    <span>Mouse Sensitivity ({settings.cameraSensitivity.toFixed(1)}x)</span>
                    <input type="range" min="0.1" max="3.0" step="0.1" value={settings.cameraSensitivity} onChange={(e) => onSettings({ cameraSensitivity: Number(e.target.value) })} />
                  </label>
                </div>

                <div className="settings-section">
                  <label className="range-row compact">
                    <span>Zoom Speed ({settings.cameraZoomSpeed.toFixed(1)}x)</span>
                    <input type="range" min="0.1" max="3.0" step="0.1" value={settings.cameraZoomSpeed} onChange={(e) => onSettings({ cameraZoomSpeed: Number(e.target.value) })} />
                  </label>
                </div>
              </div>
            )}

            {category === "Controls" && (
              <div className="settings-scroll">
                <div className="settings-section">
                  <h4>Shift Modifier</h4>
                  <p className="settings-hint">
                    Hold <kbd>Shift</kbd> + a move key to perform the inverse (counter-clockwise) rotation.
                  </p>
                  <div className="settings-examples">
                    <span><kbd>R</kbd> → Clockwise</span>
                    <span><kbd>Shift</kbd> + <kbd>R</kbd> → Counter Clockwise</span>
                  </div>
                </div>

                <div className="settings-section">
                  <h4>Camera Shortcuts</h4>
                  <div className="settings-examples">
                    <span><kbd>1</kbd> Front</span>
                    <span><kbd>2</kbd> Right</span>
                    <span><kbd>3</kbd> Back</span>
                    <span><kbd>4</kbd> Left</span>
                    <span><kbd>5</kbd> Top</span>
                    <span><kbd>6</kbd> Bottom</span>
                  </div>
                </div>

                <div className="settings-section">
                  <label className="switch-row compact">
                    <span>Show Keyboard Cheat Sheet</span>
                    <input type="checkbox" checked={settings.showKeyboardCheatSheet} onChange={(e) => onSettings({ showKeyboardCheatSheet: e.target.checked })} />
                  </label>
                </div>

                <div className="settings-section">
                  <h4>Keyboard Rebinds</h4>
                  <div className="rebinds-grid">
                    {(["U", "R", "F", "D", "L", "B"] as Face[]).map((face) => {
                      const label = { U: "Up (U)", R: "Right (R)", F: "Front (F)", D: "Down (D)", L: "Left (L)", B: "Back (B)" }[face];
                      const boundKey = (settings.keybindings || DEFAULT_SETTINGS.keybindings)[face];
                      return (
                        <div key={face} className="rebind-row">
                          <span>{label}</span>
                          <button
                            type="button"
                            className={`rebind-key-btn ${listeningFace === face ? "listening" : ""}`}
                            onClick={() => setListeningFace(face)}
                          >
                            {listeningFace === face ? "Press key..." : boundKey}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {listeningFace && (
                    <p className="settings-hint" style={{ marginTop: "8px" }}>
                      Press any key to bind, or <kbd>ESC</kbd> to cancel
                    </p>
                  )}
                </div>
              </div>
            )}

            {category === "Cube" && (
              <div className="settings-scroll">
                <div className="settings-section">
                  <h4>Cube Style</h4>
                  <div className="settings-chip-group">
                    {CUBE_STYLES.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        className={`settings-chip ${settings.cubeStyle === s.key ? "active" : ""}`}
                        onClick={() => onSettings({ cubeStyle: s.key })}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <p className="settings-hint">
                    {CUBE_STYLES.find(s => s.key === settings.cubeStyle)?.desc}
                  </p>
                </div>

                <div className="settings-section">
                  <label className="range-row compact">
                    <span>Animation Speed ({settings.animationSpeed.toFixed(2)}s)</span>
                    <input type="range" min="0.1" max="0.45" step="0.01" value={settings.animationSpeed} onChange={(e) => onSettings({ animationSpeed: Number(e.target.value) })} />
                  </label>
                </div>
              </div>
            )}

            {category === "Audio" && (
              <div className="settings-scroll">
                <div className="settings-section">
                  <label className="range-row compact">
                    <span>Master Volume ({Math.round(settings.audio.masterVolume * 100)}%)</span>
                    <input type="range" min="0" max="1" step="0.05" value={settings.audio.masterVolume} onChange={(e) => setAudio({ masterVolume: Number(e.target.value) })} />
                  </label>
                </div>
                <div className="settings-section">
                  <label className="range-row compact">
                    <span>SFX Volume ({Math.round(settings.audio.sfxVolume * 100)}%)</span>
                    <input type="range" min="0" max="1" step="0.05" value={settings.audio.sfxVolume} onChange={(e) => setAudio({ sfxVolume: Number(e.target.value) })} />
                  </label>
                </div>
                <div className="settings-section">
                  <label className="range-row compact">
                    <span>UI Volume ({Math.round(settings.audio.uiVolume * 100)}%)</span>
                    <input type="range" min="0" max="1" step="0.05" value={settings.audio.uiVolume} onChange={(e) => setAudio({ uiVolume: Number(e.target.value) })} />
                  </label>
                </div>
                <div className="settings-section">
                  <label className="range-row compact">
                    <span>Notification Volume ({Math.round(settings.audio.notificationVolume * 100)}%)</span>
                    <input type="range" min="0" max="1" step="0.05" value={settings.audio.notificationVolume} onChange={(e) => setAudio({ notificationVolume: Number(e.target.value) })} />
                  </label>
                </div>
                <div className="settings-section">
                  <label className="range-row compact">
                    <span>Music Volume ({Math.round(settings.audio.musicVolume * 100)}%)</span>
                    <input type="range" min="0" max="1" step="0.05" value={settings.audio.musicVolume} onChange={(e) => setAudio({ musicVolume: Number(e.target.value) })} />
                  </label>
                  <p className="settings-hint">Background music is not yet implemented.</p>
                </div>
              </div>
            )}

            <div className="settings-qol-row">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }}
              />
              <button type="button" className="settings-qol-btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} /> Import
              </button>
              <button type="button" className="settings-qol-btn" onClick={handleExport}>
                <Download size={14} /> Export
              </button>
              <button type="button" className="settings-qol-btn danger" onClick={handleRestoreDefaults}>
                <RotateCcw size={14} /> Defaults
              </button>
              {importError && <span className="settings-qol-error">{importError}</span>}
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
