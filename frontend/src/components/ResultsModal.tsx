import { motion } from "framer-motion";
import { BadgeCheck, Trophy, Play, RefreshCcw, Home as HomeIcon, Gamepad2 } from "lucide-react";
import { formatSolveTime, formatTime, type SolveRecord } from "../utils/sessionStats";
import { getRankFromRating } from "../utils/ranks";
import type { GameMode } from "../state/gameStateMachine";
import type { Penalty } from "../utils/scramble";

interface RaceResult {
  youTimeMs: number | null;
  botTimeMs: number | null;
  youMoveCount: number;
  botMoveCount: number;
  youTps: number;
  botTps: number;
  penalty: Penalty;
  winner: "you" | "bot";
  timeDifferenceMs: number | null;
  botName: string;
  botDifficulty: string;
}

interface MatchPlayerSnapshot {
  clientId: string;
  socketId: string;
  username: string;
  ready: boolean;
  connected: boolean;
  status: string;
  moveCount: number;
  finalTimeMs: number | null;
  tps: number;
  pingMs: number | null;
  disconnectDeadlineAt: number | null;
  playAgain: boolean;
}

interface RatingUpdate {
  clientId: string;
  previousRating: number;
  newRating: number;
  isPlacement: boolean;
  placementMatchesPlayed: number;
}

interface OnlineRaceResult {
  matchId: string;
  scrambleId: string;
  you: MatchPlayerSnapshot | null;
  opponent: MatchPlayerSnapshot | null;
  winnerClientId: string | null;
  loserClientId: string | null;
  timeDifferenceMs: number | null;
  ratingUpdates?: RatingUpdate[];
}

export default function ResultsModal({
  solve,
  raceResult,
  onlineResult,
  isPersonalBest,
  mode,
  onPracticeAgain,
  onNewScramble,
  onHome,
  onReplay,
}: {
  solve: SolveRecord | null;
  raceResult: RaceResult | null;
  onlineResult?: OnlineRaceResult | null;
  isPersonalBest: boolean;
  mode: GameMode;
  onPracticeAgain: () => void;
  onNewScramble: () => void;
  onHome: () => void;
  onReplay: () => void;
}) {
  const isRace = (mode === "bot-race" || mode === "ranked" || mode === "private") && raceResult;
  const isRankedRace = mode === "ranked" && raceResult;

  return (
    <motion.div
      className="modal-backdrop result-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        className="results-modal"
        initial={{ y: 26, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 26, opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 170, damping: 20 }}
      >
        <div className="result-kicker">
          <BadgeCheck size={17} aria-hidden="true" />
          {isRace ? "Race Complete" : "Solve Complete"}
        </div>
        <h2>{isRace ? (raceResult.winner === "you" ? "Victory" : "Defeat") : formatSolveTime(solve)}</h2>
        {isRace ? (
          <div className={raceResult.winner === "you" ? "personal-best" : "race-defeat"}>
            <Trophy size={16} aria-hidden="true" />
            {raceResult.winner === "you" ? "You Win" : `${raceResult.botName} Wins`}
          </div>
        ) : isPersonalBest ? (
          <div className="personal-best">
            <Trophy size={16} aria-hidden="true" />
            Personal Best
          </div>
        ) : null}

        {isRankedRace && onlineResult?.ratingUpdates ? (
          <div className="rating-updates-container">
            {onlineResult.ratingUpdates.filter(u => u.clientId === onlineResult.you?.clientId).map(update => {
              const diff = update.newRating - update.previousRating;
              const rank = getRankFromRating(update.newRating, update.isPlacement);
              return (
                <div key={update.clientId} className="rating-update-card">
                  <div className="rank-badge" style={{ borderColor: rank.color, color: rank.color }}>
                    {rank.badge}
                  </div>
                  <div className="rating-details">
                    <span className="tier-name" style={{ color: rank.color }}>{rank.tier}</span>
                    <div className="rating-numbers">
                      <span className="current-rating">{update.isPlacement ? "Unranked" : update.newRating}</span>
                      {!update.isPlacement && diff !== 0 && (
                        <span className={diff > 0 ? "rating-diff positive" : "rating-diff negative"}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      )}
                    </div>
                    {update.isPlacement && (
                      <div className="placement-progress">Placement: {update.placementMatchesPlayed}/5</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {isRace ? (
          <>
            <div className="race-result-board">
              <div className={raceResult.winner === "you" ? "winner" : ""}>
                <span>You</span>
                <strong>{formatTime(raceResult.youTimeMs)}</strong>
                <small>{raceResult.youMoveCount} moves / {raceResult.youTps.toFixed(2)} TPS</small>
              </div>
              <div className={raceResult.winner === "bot" ? "winner" : ""}>
                <span>{raceResult.botName}</span>
                <strong>{formatTime(raceResult.botTimeMs)}</strong>
                <small>{raceResult.botMoveCount} moves / {raceResult.botTps.toFixed(2)} TPS</small>
              </div>
            </div>
            <div className="result-grid">
              <div>
                <span>Difference</span>
                <strong>{formatTime(raceResult.timeDifferenceMs)}</strong>
              </div>
              <div>
                <span>{isRankedRace ? "Scramble ID" : "Difficulty"}</span>
                <strong>{raceResult.botDifficulty}</strong>
              </div>
              <div>
                <span>Penalty</span>
                <strong>{raceResult.penalty === "none" ? "None" : raceResult.penalty}</strong>
              </div>
            </div>
          </>
        ) : (
          <div className="result-grid">
            <div>
              <span>Moves</span>
              <strong>{solve?.moveCount ?? "-"}</strong>
            </div>
            <div>
              <span>TPS</span>
              <strong>{solve ? solve.tps.toFixed(2) : "-"}</strong>
            </div>
            <div>
              <span>Penalty</span>
              <strong>{solve?.penalty === "none" ? "None" : solve?.penalty ?? "-"}</strong>
            </div>
          </div>
        )}

        <div className="result-actions">
          <button type="button" className="primary" onClick={onPracticeAgain}>
            <Play size={16} aria-hidden="true" />
            {isRankedRace ? "Play Again" : isRace ? "Race Again" : "Practice Again"}
          </button>
          {!isRankedRace ? <button type="button" onClick={onNewScramble}>
            <RefreshCcw size={16} aria-hidden="true" />
            New Scramble
          </button> : null}
          <button type="button" onClick={onHome}>
            {mode === "private" ? (
              <>
                <Gamepad2 size={16} aria-hidden="true" />
                Exit to Lobby
              </>
            ) : (
              <>
                <HomeIcon size={16} aria-hidden="true" />
                Back to Home
              </>
            )}
          </button>
          <button type="button" disabled onClick={onReplay}>
            <Play size={16} aria-hidden="true" />
            Replay
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}
