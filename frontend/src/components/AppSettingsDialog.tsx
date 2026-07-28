import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Download,
  Upload,
  RotateCcw,
  Monitor,
  Camera,
  Gamepad2,
  Box,
  Volume2,
  Settings,
  Eye,
  Keyboard,
  Sun,
  Moon,
  Check,
  RefreshCw,
} from "lucide-react";
import { audioManager } from "../utils/audioManager";
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

const CUBE_STYLES: { key: CubeStyle; label: string; desc: string; accentColor: string }[] = [
  { key: "classic", label: "Classic", desc: "Original Rubik's Cube look with traditional sticker borders", accentColor: "#6366f1" },
  { key: "speedcube", label: "Speedcube", desc: "Modern GAN/Moyu style — smaller bevels, brighter plastic", accentColor: "#06b6d4" },
  { key: "stickerless", label: "Stickerless", desc: "Pure plastic colors without sticker borders", accentColor: "#10b981" },
  { key: "minimal", label: "Minimal", desc: "Flat colors, very thin borders — clean esports aesthetic", accentColor: "#8b5cf6" },
];

const CAMERA_FACES: { key: CameraFace; label: string; color: string }[] = [
  { key: "white", label: "White", color: "#f8fafc" },
  { key: "yellow", label: "Yellow", color: "#facc15" },
  { key: "green", label: "Green", color: "#22c55e" },
  { key: "blue", label: "Blue", color: "#3b82f6" },
  { key: "red", label: "Red", color: "#ef4444" },
  { key: "orange", label: "Orange", color: "#f97316" },
];

const CAMERA_MODES: {
  key: SessionSettings["cameraMode"];
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "free-rotation",
    label: "Free Orbit",
    desc: "Drag to orbit the camera around the cube. Face buttons snap to view.",
    icon: <Camera size={18} />,
  },
  {
    key: "competitive",
    label: "Competitive",
    desc: "Fixed camera. Use face buttons or number keys to switch views.",
    icon: <Monitor size={18} />,
  },
];

const CATEGORY_ICONS: Record<SettingsCategory, React.ReactNode> = {
  General: <Settings size={15} />,
  Appearance: <Eye size={15} />,
  Camera: <Camera size={15} />,
  Controls: <Keyboard size={15} />,
  Cube: <Box size={15} />,
  Audio: <Volume2 size={15} />,
};

// ─── Premium Toggle Switch ───────────────────────────────────────────────────
function PremiumSwitch({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      className={`premium-switch ${checked ? "is-on" : "is-off"}`}
      onClick={() => onChange(!checked)}
    >
      <motion.div
        className="premium-switch-thumb"
        layout
        transition={{ type: "spring", stiffness: 600, damping: 34 }}
      />
    </button>
  );
}

// ─── Premium Slider ──────────────────────────────────────────────────────────
function PremiumSlider({
  min,
  max,
  step,
  value,
  onChange,
  label,
  formatValue,
  id,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (val: number) => void;
  label: string;
  formatValue?: (val: number) => string;
  id?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const displayVal = formatValue ? formatValue(value) : String(value);

  return (
    <div className="premium-slider-row">
      <div className="premium-slider-header">
        <span className="premium-slider-label">{label}</span>
        <span className="premium-slider-value">{displayVal}</span>
      </div>
      <div className="premium-slider-track">
        <div className="premium-slider-fill" style={{ width: `${pct}%` }} />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="premium-slider-input"
        />
      </div>
    </div>
  );
}

// ─── UI Scale Slider — premium redesign with tick marks ──────────────────────
const UI_SCALE_TICKS = [0.8, 0.9, 1.0, 1.1, 1.2];
const UI_SCALE_LABELS: Record<number, string> = { 0.8: "80%", 0.9: "90%", 1.0: "100%", 1.1: "110%", 1.2: "120%" };

function UiScaleSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  const min = 0.8;
  const max = 1.2;
  const pct = ((value - min) / (max - min)) * 100;
  const displayLabel = UI_SCALE_LABELS[Math.round(value * 10) / 10] ?? `${Math.round(value * 100)}%`;

  return (
    <div className="ui-scale-slider">
      <div className="ui-scale-header">
        <div className="ui-scale-title">
          <span className="premium-slider-label">UI Scale</span>
          <span className="ui-scale-badge">{displayLabel}</span>
        </div>
        {value !== 1.0 && (
          <button
            type="button"
            className="ui-scale-reset"
            onClick={() => onChange(1.0)}
            title="Reset to 100%"
            aria-label="Reset UI scale to 100%"
          >
            <RefreshCw size={11} />
            Reset
          </button>
        )}
      </div>

      {/* Track + thumb */}
      <div className="ui-scale-track-wrap">
        <div className="ui-scale-track">
          <div className="ui-scale-fill" style={{ width: `${pct}%` }} />
        </div>
        <input
          id="slider-ui-scale"
          type="range"
          min={min}
          max={max}
          step={0.1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="ui-scale-input"
          aria-label="UI Scale"
        />
        {/* Tick marks */}
        <div className="ui-scale-ticks">
          {UI_SCALE_TICKS.map((tick) => {
            const tickPct = ((tick - min) / (max - min)) * 100;
            const isActive = Math.abs(value - tick) < 0.05;
            return (
              <button
                key={tick}
                type="button"
                className={`ui-scale-tick ${isActive ? "active" : ""}`}
                style={{ left: `${tickPct}%` }}
                onClick={() => onChange(tick)}
                aria-label={`Set UI scale to ${UI_SCALE_LABELS[tick]}`}
              >
                <span className="ui-scale-tick-mark" />
                <span className="ui-scale-tick-label">{UI_SCALE_LABELS[tick]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Mini Cube Preview (Static Image) ───────────────────────────────
function MiniCubePreview({ cubeStyle }: { cubeStyle: CubeStyle }) {
  const imageUrl = `/assets/cube-styles/${cubeStyle}.webp`;
  const label = CUBE_STYLES.find((style) => style.key === cubeStyle)?.label ?? cubeStyle;

  return (
    <div className="sd2-cube-preview-3d">
      <img
        src={imageUrl}
        alt={`${label} CubeRanked cube style preview`}
        width={512}
        height={512}
        loading="lazy"
      />
    </div>
  );
}

// ─── Save Confirmation ───────────────────────────────────────────────────────
function SavedBadge({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="saved-badge"
          initial={{ opacity: 0, scale: 0.82, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -2 }}
          transition={{ type: "spring", stiffness: 400, damping: 26 }}
        >
          <Check size={11} />
          Saved
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Settings Dialog ────────────────────────────────────────────────────
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
  const [savedVisible, setSavedVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedTimerRef = useRef<number | null>(null);
  const isFirstRender = useRef(true);

  // Show "Saved" badge whenever settings change (but not on first render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSavedVisible(true);
    if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setSavedVisible(false), 1600);
  }, [settings]);

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
        className="settings-dialog settings-dialog-v2"
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 170, damping: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="sd2-header">
          <div className="sd2-header-left">
            <div className="sd2-header-icon">
              <Settings size={16} />
            </div>
            <div>
              <p className="sd2-header-eyebrow">Application</p>
              <h2 className="sd2-header-title">Settings</h2>
            </div>
          </div>
          <div className="sd2-header-right">
            <SavedBadge show={savedVisible} />
            <button
              type="button"
              className="sd2-close-btn"
              onClick={() => { audioManager.playButtonClick(); onClose(); }}
              aria-label="Close settings"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="sd2-body">
          {/* ── Sidebar nav ── */}
          <nav className="sd2-nav">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={`sd2-nav-item ${category === item ? "active" : ""}`}
                onClick={() => { audioManager.playButtonHover(); onCategory(item); }}
              >
                <span className="sd2-nav-icon">{CATEGORY_ICONS[item]}</span>
                <span className="sd2-nav-label">{item}</span>
              </button>
            ))}
          </nav>

          {/* ── Content panel ── */}
          <div className="sd2-content">
            <AnimatePresence mode="wait">
              <motion.div
                key={category}
                className="sd2-panel"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.16 }}
              >
                <h3 className="sd2-panel-title">{category}</h3>

                {/* ════ GENERAL ════ */}
                {category === "General" && (
                  <div className="sd2-scroll">
                    <div className="sd2-card">
                      <div className="sd2-card-header">
                        <span className="sd2-card-title">Default Camera Face</span>
                        <span className="sd2-card-desc">The first visible face when entering a solve</span>
                      </div>
                      <div className="sd2-face-grid">
                        {CAMERA_FACES.map((f) => (
                          <button
                            key={f.key}
                            type="button"
                            className={`sd2-face-chip ${settings.defaultCameraFace === f.key ? "active" : ""}`}
                            onClick={() => onSettings({ defaultCameraFace: f.key })}
                          >
                            <span
                              className="sd2-face-dot"
                              style={{ background: f.color }}
                            />
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="sd2-card">
                      <div className="sd2-card-header">
                        <span className="sd2-card-title">HUD</span>
                      </div>
                      <div className="sd2-row">
                        <div className="sd2-row-info">
                          <span className="sd2-row-label">FPS Counter</span>
                          <span className="sd2-row-desc">Show frames per second overlay</span>
                        </div>
                        <PremiumSwitch
                          checked={settings.showFpsCounter}
                          onChange={(v) => onSettings({ showFpsCounter: v })}
                          id="toggle-fps"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ════ APPEARANCE ════ */}
                {category === "Appearance" && (
                  <div className="sd2-scroll">
                    <div className="sd2-card">
                      <div className="sd2-card-header">
                        <span className="sd2-card-title">Theme</span>
                        <span className="sd2-card-desc">Interface color scheme</span>
                      </div>
                      <div className="sd2-theme-row">
                        <button
                          className={`sd2-theme-option ${settings.theme === "dark" ? "active" : ""}`}
                          onClick={() => { audioManager.playThemeSwitch(); onSettings({ theme: "dark" }); }}
                          type="button"
                        >
                          <div className="sd2-theme-preview sd2-theme-dark">
                            <div className="sd2-theme-preview-dot" />
                            <div className="sd2-theme-preview-bar" />
                            <div className="sd2-theme-preview-bar short" />
                          </div>
                          <Moon size={13} />
                          <span>Dark</span>
                          {settings.theme === "dark" && <Check size={11} className="sd2-theme-check" />}
                        </button>
                        <button
                          className={`sd2-theme-option ${settings.theme === "light" ? "active" : ""}`}
                          onClick={() => { audioManager.playThemeSwitch(); onSettings({ theme: "light" }); }}
                          type="button"
                        >
                          <div className="sd2-theme-preview sd2-theme-light">
                            <div className="sd2-theme-preview-dot" />
                            <div className="sd2-theme-preview-bar" />
                            <div className="sd2-theme-preview-bar short" />
                          </div>
                          <Sun size={13} />
                          <span>Light</span>
                          {settings.theme === "light" && <Check size={11} className="sd2-theme-check" />}
                        </button>
                      </div>
                    </div>

                    <div className="sd2-card">
                      <div className="sd2-card-header">
                        <span className="sd2-card-title">Display</span>
                      </div>
                      <UiScaleSlider
                        value={settings.uiScale}
                        onChange={(v) => onSettings({ uiScale: v })}
                      />
                      <div className="sd2-row" style={{ marginTop: "12px" }}>
                        <div className="sd2-row-info">
                          <span className="sd2-row-label">Reduced Motion</span>
                          <span className="sd2-row-desc">Minimize animations for accessibility</span>
                        </div>
                        <PremiumSwitch
                          checked={settings.reducedMotion}
                          onChange={(v) => onSettings({ reducedMotion: v })}
                          id="toggle-reduced-motion"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ════ CAMERA ════ */}
                {category === "Camera" && (
                  <div className="sd2-scroll">
                    <div className="sd2-card">
                      <div className="sd2-card-header">
                        <span className="sd2-card-title">Camera Mode</span>
                        <span className="sd2-card-desc">How you interact with the cube</span>
                      </div>
                      <div className="sd2-camera-cards">
                        {CAMERA_MODES.map((m) => (
                          <button
                            key={m.key}
                            type="button"
                            className={`sd2-camera-card ${settings.cameraMode === m.key ? "active" : ""}`}
                            onClick={() => onSettings({ cameraMode: m.key })}
                          >
                            <div className="sd2-camera-card-icon">{m.icon}</div>
                            <div className="sd2-camera-card-body">
                              <span className="sd2-camera-card-label">{m.label}</span>
                              <span className="sd2-camera-card-desc">{m.desc}</span>
                            </div>
                            {settings.cameraMode === m.key && (
                              <div className="sd2-camera-card-check">
                                <Check size={12} />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="sd2-card">
                      <div className="sd2-card-header">
                        <span className="sd2-card-title">Mouse Settings</span>
                      </div>
                      <div className="sd2-row">
                        <div className="sd2-row-info">
                          <span className="sd2-row-label">Invert Vertical Rotation</span>
                          <span className="sd2-row-desc">Flip up/down camera drag direction</span>
                        </div>
                        <PremiumSwitch
                          checked={settings.cameraInvertVertical}
                          onChange={(v) => onSettings({ cameraInvertVertical: v })}
                          id="toggle-invert-vertical"
                        />
                      </div>
                      <div style={{ marginTop: "16px" }}>
                        <PremiumSlider
                          id="slider-sensitivity"
                          label="Mouse Sensitivity"
                          min={0.1}
                          max={3.0}
                          step={0.1}
                          value={settings.cameraSensitivity}
                          onChange={(v) => onSettings({ cameraSensitivity: v })}
                          formatValue={(v) => `${v.toFixed(1)}×`}
                        />
                      </div>
                      <div style={{ marginTop: "12px" }}>
                        <PremiumSlider
                          id="slider-zoom-speed"
                          label="Zoom Speed"
                          min={0.1}
                          max={3.0}
                          step={0.1}
                          value={settings.cameraZoomSpeed}
                          onChange={(v) => onSettings({ cameraZoomSpeed: v })}
                          formatValue={(v) => `${v.toFixed(1)}×`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ════ CONTROLS ════ */}
                {category === "Controls" && (
                  <div className="sd2-scroll">
                    <div className="sd2-card">
                      <div className="sd2-card-header">
                        <span className="sd2-card-title">Shift Modifier</span>
                        <span className="sd2-card-desc">
                          Hold <kbd>Shift</kbd> + a move key for counter-clockwise rotation
                        </span>
                      </div>
                      <div className="sd2-examples">
                        <div className="sd2-example-chip"><kbd>R</kbd> <span>→ Clockwise</span></div>
                        <div className="sd2-example-chip"><kbd>Shift</kbd> + <kbd>R</kbd> <span>→ Counter-clockwise</span></div>
                      </div>
                    </div>

                    <div className="sd2-card">
                      <div className="sd2-card-header">
                        <span className="sd2-card-title">Camera Shortcuts</span>
                      </div>
                      <div className="sd2-shortcut-grid">
                        {[
                          { key: "1", label: "Front" },
                          { key: "2", label: "Right" },
                          { key: "3", label: "Back" },
                          { key: "4", label: "Left" },
                          { key: "5", label: "Top" },
                          { key: "6", label: "Bottom" },
                        ].map(({ key, label }) => (
                          <div key={key} className="sd2-shortcut-item">
                            <kbd>{key}</kbd>
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="sd2-card">
                      <div className="sd2-card-header">
                        <span className="sd2-card-title">HUD Options</span>
                      </div>
                      <div className="sd2-row">
                        <div className="sd2-row-info">
                          <span className="sd2-row-label">Keyboard Cheat Sheet</span>
                          <span className="sd2-row-desc">Show move key bindings in-game</span>
                        </div>
                        <PremiumSwitch
                          checked={settings.showKeyboardCheatSheet}
                          onChange={(v) => onSettings({ showKeyboardCheatSheet: v })}
                          id="toggle-cheatsheet"
                        />
                      </div>
                    </div>

                    <div className="sd2-card">
                      <div className="sd2-card-header">
                        <span className="sd2-card-title">Keyboard Rebinds</span>
                        <span className="sd2-card-desc">Click a key to reassign it</span>
                      </div>
                      <div className="sd2-rebind-grid">
                        {(["U", "R", "F", "D", "L", "B"] as Face[]).map((face) => {
                          const label = { U: "Up", R: "Right", F: "Front", D: "Down", L: "Left", B: "Back" }[face];
                          const boundKey = (settings.keybindings || DEFAULT_SETTINGS.keybindings)[face];
                          return (
                            <div key={face} className="sd2-rebind-row">
                              <span className="sd2-rebind-face">{label}</span>
                              <button
                                type="button"
                                className={`sd2-rebind-btn ${listeningFace === face ? "listening" : ""}`}
                                onClick={() => setListeningFace(face)}
                              >
                                {listeningFace === face ? "Press key…" : <kbd>{boundKey}</kbd>}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      {listeningFace && (
                        <p className="sd2-hint" style={{ marginTop: "10px" }}>
                          Press any key to bind, or <kbd>ESC</kbd> to cancel
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* ════ CUBE ════ */}
                {category === "Cube" && (
                  <div className="sd2-scroll">
                    <div className="sd2-card">
                      <div className="sd2-card-header">
                        <span className="sd2-card-title">Cube Style</span>
                        <span className="sd2-card-desc">Visual appearance of the cube</span>
                      </div>
                      <div className="sd2-cube-style-grid">
                        {CUBE_STYLES.map((s) => (
                          <button
                            key={s.key}
                            type="button"
                            className={`sd2-cube-style-card ${settings.cubeStyle === s.key ? "active" : ""}`}
                            onClick={() => onSettings({ cubeStyle: s.key })}
                          >
                            <MiniCubePreview cubeStyle={s.key} />
                            <span className="sd2-cube-style-label">{s.label}</span>
                            <span className="sd2-cube-style-desc">{s.desc}</span>
                            {settings.cubeStyle === s.key && (
                              <div className="sd2-cube-style-check">
                                <Check size={11} />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="sd2-card">
                      <div className="sd2-card-header">
                        <span className="sd2-card-title">Animation</span>
                      </div>
                      <PremiumSlider
                        id="slider-animation-speed"
                        label="Turn Animation Speed"
                        min={0.1}
                        max={0.45}
                        step={0.01}
                        value={settings.animationSpeed}
                        onChange={(v) => onSettings({ animationSpeed: v })}
                        formatValue={(v) => `${(v * 1000).toFixed(0)} ms`}
                      />
                    </div>
                  </div>
                )}

                {/* ════ AUDIO ════ */}
                {category === "Audio" && (
                  <div className="sd2-scroll">
                    <div className="sd2-card">
                      <div className="sd2-card-header">
                        <span className="sd2-card-title">Volume Levels</span>
                        <span className="sd2-card-desc">Adjust audio for each sound category</span>
                      </div>
                      <div className="sd2-audio-stack">
                        <PremiumSlider
                          id="slider-master-vol"
                          label="Master Volume"
                          min={0}
                          max={1}
                          step={0.05}
                          value={settings.audio.masterVolume}
                          onChange={(v) => setAudio({ masterVolume: v })}
                          formatValue={(v) => `${Math.round(v * 100)}%`}
                        />
                        <PremiumSlider
                          id="slider-sfx-vol"
                          label="Sound Effects"
                          min={0}
                          max={1}
                          step={0.05}
                          value={settings.audio.sfxVolume}
                          onChange={(v) => setAudio({ sfxVolume: v })}
                          formatValue={(v) => `${Math.round(v * 100)}%`}
                        />
                        <PremiumSlider
                          id="slider-ui-vol"
                          label="UI Sounds"
                          min={0}
                          max={1}
                          step={0.05}
                          value={settings.audio.uiVolume}
                          onChange={(v) => setAudio({ uiVolume: v })}
                          formatValue={(v) => `${Math.round(v * 100)}%`}
                        />
                        <PremiumSlider
                          id="slider-notif-vol"
                          label="Notifications"
                          min={0}
                          max={1}
                          step={0.05}
                          value={settings.audio.notificationVolume}
                          onChange={(v) => setAudio({ notificationVolume: v })}
                          formatValue={(v) => `${Math.round(v * 100)}%`}
                        />
                        <PremiumSlider
                          id="slider-music-vol"
                          label="Music"
                          min={0}
                          max={1}
                          step={0.05}
                          value={settings.audio.musicVolume}
                          onChange={(v) => setAudio({ musicVolume: v })}
                          formatValue={(v) => `${Math.round(v * 100)}%`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* ── Footer action row ── */}
            <div className="sd2-footer">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }}
              />
              <button type="button" className="sd2-footer-btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={13} /> Import
              </button>
              <button type="button" className="sd2-footer-btn" onClick={handleExport}>
                <Download size={13} /> Export
              </button>
              <button type="button" className="sd2-footer-btn danger" onClick={handleRestoreDefaults}>
                <RotateCcw size={13} /> Restore Defaults
              </button>
              {importError && <span className="sd2-footer-error">{importError}</span>}
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
