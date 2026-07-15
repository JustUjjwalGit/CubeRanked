import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Gamepad2, Wifi, Settings } from "lucide-react";
import CubeScene from "../../components/cube/CubeScene";
import CompactTimer from "../../components/CompactTimer";
import OpponentPanel from "../../components/OpponentPanel";
import KeyboardCheatSheet from "../../components/KeyboardCheatSheet";
import CountdownOverlay from "../../components/CountdownOverlay";
import ReadyOverlay from "../../components/ReadyOverlay";
import InspectionOverlay from "../../components/InspectionOverlay";
import SolvedOverlay from "../../components/SolvedOverlay";
import FpsCounter from "../../components/FpsCounter";
import { connectionLabel } from "../../utils/helpers";
import { socketManager } from "../../network/socketManager";
import type { RaceOpponentSnapshot, AnimatedCubeState } from "../../utils/botRace";
import type { GameStage, GameMode } from "../../state/gameStateMachine";
import type { SessionSettings } from "../../utils/sessionStats";
import type { Penalty } from "../../utils/scramble";
import type { SocketConnectionState } from "../../network/socketTypes";

type PlayableStage = Extract<GameStage, "COUNTDOWN" | "READY" | "INSPECTION" | "PLAYING" | "SOLVED" | "RESULT">;

interface BotRaceStats {
  wins: number;
  losses: number;
}

export default function PracticeScreen({
  stage,
  mode,
  elapsedMs,
  inspectionRemaining,
  penalty,
  settings,
  connectionState,
  pingMs,
  opponent,
  opponentCube,
  botRaceStats,
  countdownValue,
  onOpponentFrame,
  onHome,
  onSettings,
  effectiveInspectionEnabled,
}: {
  stage: PlayableStage;
  mode: GameMode;
  elapsedMs: number;
  inspectionRemaining: number;
  penalty: Penalty;
  settings: SessionSettings;
  connectionState: SocketConnectionState;
  pingMs: number | null;
  opponent: RaceOpponentSnapshot | null;
  opponentCube: AnimatedCubeState | null;
  botRaceStats: BotRaceStats;
  countdownValue: string;
  onOpponentFrame: (deltaSeconds: number) => void;
  onHome: () => void;
  onSettings: () => void;
  effectiveInspectionEnabled: boolean;
}) {
  const showFocusOnly = stage === "COUNTDOWN" || stage === "INSPECTION" || stage === "PLAYING" || stage === "SOLVED";
  const isBotRaceMode = mode === "bot-race";
  const isRankedMode = mode === "ranked";

  return (
    <motion.section
      className={`practice-screen stage-${stage.toLowerCase()} mode-${mode}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <CubeScene 
        theme={settings.theme}
        cameraMode={settings.cameraMode}
        cubeStyle={settings.cubeStyle}
        reducedMotion={settings.reducedMotion}
      />

      {settings.showFpsCounter ? <FpsCounter /> : null}

      <div className="match-frame">
        {!showFocusOnly ? (
          <button type="button" className="back-button" onClick={onHome}>
            <ChevronLeft size={18} aria-hidden="true" />
            Home
          </button>
        ) : null}

        <div className="match-meta">
          <div className="mode-pill">
            <Gamepad2 size={16} aria-hidden="true" />
            {mode === "private"
              ? (socketManager.getSnapshot().roomState?.spectator?.clientId === socketManager.getSnapshot().clientId ? "Spectating" : "Private Match")
              : isRankedMode ? "Ranked" : isBotRaceMode ? "Bot Race" : "Practice"}
          </div>
          <div className="connection-pill practice">
            <Wifi size={15} aria-hidden="true" />
            {connectionLabel(connectionState)}
          </div>
          <div className="ping-pill">Ping: {pingMs === null ? "--" : pingMs} ms</div>
        </div>

        <div className="top-right-cluster">
          <CompactTimer
            stage={stage}
            elapsedMs={elapsedMs}
            inspectionRemaining={inspectionRemaining}
            penalty={penalty}
          />
          {!isRankedMode && (stage === "READY" || stage === "COUNTDOWN") ? (
            <button type="button" className="gear-button" onClick={onSettings} aria-label="Practice settings">
              <Settings size={19} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {opponent && opponentCube ? (
          <OpponentPanel
            opponent={opponent}
            opponentCube={opponentCube}
            theme={settings.theme}
            stats={botRaceStats}
            onFrame={onOpponentFrame}
          />
        ) : null}

        {settings.showKeyboardCheatSheet && (mode === "practice" || mode === "ranked" || mode === "bot-race" || mode === "private") ? (
          <KeyboardCheatSheet settings={settings} />
        ) : null}
      </div>

      <AnimatePresence>
        {stage === "COUNTDOWN" ? (
          <CountdownOverlay value={countdownValue} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {stage === "READY" ? (
          <ReadyOverlay
            inspectionEnabled={effectiveInspectionEnabled}
            isSpectator={mode === "private" && socketManager.getSnapshot().roomState?.spectator?.clientId === socketManager.getSnapshot().clientId}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {stage === "INSPECTION" ? (
          <InspectionOverlay inspectionRemaining={inspectionRemaining} penalty={penalty} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {stage === "SOLVED" ? (
          <SolvedOverlay />
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
