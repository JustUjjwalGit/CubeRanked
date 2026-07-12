import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, LogOut, X, Moon, Sun, TrendingUp, Activity, Shield, Clock, Gamepad2, BarChart3, Medal, Swords, Home, Trophy, Star, Lock, Check, HelpCircle } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { getRankFromElo, getRankProgress } from "../../utils/ranks";
import { formatTime } from "../../utils/sessionStats";
import { getLocalReplays } from "../../utils/replay";
import { calculateLifetimeStats } from "../../utils/statsEngine";
import { fetchAchievements } from "../../api/achievements";
import { CATEGORY_LABELS, CATEGORY_ICONS, CATEGORY_ORDER } from "../achievements/achievement.types";
import type { UserProfile } from "../../api/auth";
import type { AchievementsData, AchievementCategory } from "../achievements/achievement.types";

type ProfileTab = "overview" | "statistics" | "achievements" | "history" | "settings";

const TABS: { key: ProfileTab; label: string; icon: typeof Home }[] = [
  { key: "overview", label: "Overview", icon: Home },
  { key: "statistics", label: "Statistics", icon: BarChart3 },
  { key: "achievements", label: "Achievements", icon: Medal },
  { key: "history", label: "History", icon: Swords },
  { key: "settings", label: "Settings", icon: Shield },
];

export default function ProfileDialog({
  user,
  onClose,
  onSave,
  onLogout,
}: {
  user: UserProfile;
  onClose: () => void;
  onSave: (patch: Partial<Pick<UserProfile, "username" | "avatar" | "country" | "bio" | "theme" | "favoriteMode">>) => Promise<void>;
  onLogout: () => void;
}) {
  const isGuest = user.id === "guest";
  const auth = useAuth();
  const [tab, setTab] = useState<ProfileTab>("overview");
  const [draft, setDraft] = useState({
    username: user.username,
    avatar: user.avatar ?? "",
    country: user.country ?? "",
    bio: user.bio,
    theme: user.theme,
    favoriteMode: user.favoriteMode,
  });
  const [privateHistory, setPrivateHistory] = useState<any[]>([]);

  useEffect(() => {
    try {
      const hist = JSON.parse(localStorage.getItem("cuberanked.private_history") || "[]");
      setPrivateHistory(hist);
    } catch {
      // ignore
    }
  }, []);

  const originalKey = JSON.stringify({
    username: user.username,
    avatar: user.avatar ?? "",
    country: user.country ?? "",
    bio: user.bio,
    theme: user.theme,
    favoriteMode: user.favoriteMode,
  });
  const draftKey = JSON.stringify(draft);

  useEffect(() => {
    if (isGuest || draftKey === originalKey) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void onSave({
        ...draft,
        avatar: draft.avatar.trim() || null,
        country: draft.country.trim() || null,
      });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [draft, draftKey, onSave, originalKey, isGuest]);

  const ratingVal = user.rating ?? 1200;
  const inPlacement = user.placementMatchesPlayed != null && user.placementMatchesPlayed < 10;
  const rankInfo = getRankFromElo(ratingVal, inPlacement);
  const rankProgress = !inPlacement ? getRankProgress(ratingVal, false) : null;
  const winRate = user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0;

  const localReplays = getLocalReplays();
  const stats = calculateLifetimeStats(localReplays);

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section
        className="profile-dialog"
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 170, damping: 20 }}
      >
        <div className="modal-head">
          <div>
            <span>{isGuest ? "Temporary Profile" : "Profile"}</span>
            <h2>{user.username}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close profile">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {isGuest ? (
          <div className="guest-upgrade-banner" style={{
            background: "linear-gradient(135deg, rgba(67, 56, 202, 0.2) 0%, rgba(99, 102, 241, 0.1) 100%)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "20px",
            textAlign: "center",
          }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#f1f5f9", fontWeight: 800 }}>Upgrade to persistent profile</h4>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.4 }}>
              Register or sign in with Google to save your competitive Elo rating, match history, and unlock custom profiles. Your local practice statistics will automatically merge!
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                className="ranked-gate-btn google"
                onClick={() => {
                  onClose();
                  void auth.loginWithGoogle();
                }}
                style={{ width: "auto", minHeight: "36px", padding: "0 16px", fontSize: "0.8rem" }}
              >
                Sign Up with Google
              </button>
              <button
                type="button"
                className="ranked-gate-btn email"
                onClick={() => {
                  onClose();
                  auth.dismissFirstVisit();
                  onLogout();
                }}
                style={{ width: "auto", minHeight: "36px", padding: "0 16px", fontSize: "0.8rem", background: "rgba(255,255,255,0.06)" }}
              >
                Sign Up with Email
              </button>
            </div>
          </div>
        ) : null}

        {/* Profile Summary Header */}
        <div className="profile-summary">
          <div className="profile-avatar">{user.avatar ? <img src={user.avatar} alt="" /> : user.username.slice(0, 2).toUpperCase()}</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <strong style={{ color: "#22c55e", fontSize: "0.95rem" }}>{user.status === "online" ? "● Online" : "○ Offline"}</strong>
              {user.country ? (
                <span title={user.country} style={{ fontSize: "14px", cursor: "help" }}>
                  🏳️ {user.country}
                </span>
              ) : null}
            </div>
            <span>Joined {new Date(user.joinDate).toLocaleDateString()}</span>
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
              {user.gamesPlayed} matches · {user.wins}W {user.losses}L · {winRate}% WR
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="profile-tabs" style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.04)", borderRadius: "14px", padding: "4px", marginBottom: "20px", overflow: "auto" }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "none",
                  background: tab === t.key ? "rgba(99,102,241,0.2)" : "transparent",
                  color: tab === t.key ? "#818cf8" : "#94a3b8",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {tab === "overview" && (
              <OverviewTab user={user} rankInfo={rankInfo} rankProgress={rankProgress} inPlacement={inPlacement} ratingVal={ratingVal} winRate={winRate} stats={stats} />
            )}
            {tab === "statistics" && (
              <StatisticsTab user={user} stats={stats} inPlacement={inPlacement} />
            )}
            {tab === "achievements" && (
              <AchievementsTab />
            )}
            {tab === "history" && (
              <HistoryTab privateHistory={privateHistory} />
            )}
            {tab === "settings" && (
              <SettingsTab draft={draft} setDraft={setDraft} isGuest={isGuest} auth={auth} user={user} onLogout={onLogout} />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
}

function OverviewTab({ user, rankInfo, rankProgress, inPlacement, ratingVal, winRate, stats }: {
  user: UserProfile;
  rankInfo: ReturnType<typeof getRankFromElo>;
  rankProgress: ReturnType<typeof getRankProgress> | null;
  inPlacement: boolean;
  ratingVal: number;
  winRate: number;
  stats: ReturnType<typeof calculateLifetimeStats>;
}) {
  return (
    <div>
      {/* Rank Card */}
      <div className="profile-rank-card" style={{
        background: `linear-gradient(135deg, ${rankInfo.color}22 0%, rgba(15,23,42,0.8) 100%)`,
        border: `1px solid ${rankInfo.color}44`,
        borderRadius: "18px", padding: "24px", marginBottom: "16px",
        display: "flex", alignItems: "center", gap: "20px",
      }}>
        <div className="rank-badge" style={{
          width: "72px", height: "72px", borderWidth: "3px",
          borderColor: rankInfo.color, color: rankInfo.color,
          fontSize: "1.8rem", flexShrink: 0,
          boxShadow: `0 0 30px ${rankInfo.color}44`,
        }}>
          {rankInfo.badge}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 900, color: rankInfo.color, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            {inPlacement ? "Unranked" : `${rankInfo.tier}${rankInfo.division ? ` ${rankInfo.division}` : ""}`}
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#f8fafc", fontVariantNumeric: "tabular-nums", marginTop: "2px" }}>
            {inPlacement ? `${Math.min(user.placementMatchesPlayed ?? 0, 10)}/10 Placements` : `${ratingVal} ELO`}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, marginTop: "2px" }}>
            Peak: {user.peakElo ?? user.peakRating ?? ratingVal} ELO
            {user.streak && user.streak > 0 ? ` · 🔥 ${user.streak} win streak` : ""}
          </div>
        </div>
      </div>

      {/* Rank Progress Bar */}
      {rankProgress && rankProgress.nextRank && (
        <div style={{ marginBottom: "16px", padding: "0 4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#64748b", fontWeight: 700, marginBottom: "6px" }}>
            <span>{rankProgress.rank.badge}</span>
            <span>{rankProgress.nextRank.badge}</span>
          </div>
          <div className="rank-progress-track" style={{ height: "8px" }}>
            <div className="rank-progress-fill" style={{ width: `${Math.round(rankProgress.progress * 100)}%`, background: rankInfo.color }} />
          </div>
          <div style={{ textAlign: "center", fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, marginTop: "4px" }}>
            {rankProgress.eloWithinRank} / {rankProgress.eloRequiredForNext} ELO to {rankProgress.nextRank.tier}{rankProgress.nextRank.division ? ` ${rankProgress.nextRank.division}` : ""}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <h3 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#60a5fa", margin: "0 0 10px 0", fontWeight: 800 }}>
        <Activity size={14} style={{ display: "inline", marginRight: "6px" }} />
        Quick Stats
      </h3>
      <div className="profile-stats-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: "10px",
        marginBottom: "16px",
      }}>
        <StatCard label="Games" value={String(user.gamesPlayed)} sub={`${user.wins}W ${user.losses}L`} />
        <StatCard label="Win Rate" value={`${winRate}%`} color={winRate >= 50 ? "#34d399" : "#f87171"} />
        <StatCard label="Best Time" value={stats.pbMs ? formatTime(stats.pbMs) : "-"} />
        <StatCard label="Avg TPS" value={stats.avgTps} sub={`Max: ${stats.fastestTps}`} color="#10b981" />
        <StatCard label="Bot Race" value={String(user.botWins + user.botLosses)} sub={`${user.botWins}W ${user.botLosses}L`} />
        <StatCard label="Streak" value={user.streak ? `🔥 ${user.streak}` : "-"} color={user.streak && user.streak > 0 ? "#fbbf24" : undefined} />
      </div>

      {/* Bio */}
      {user.bio && (
        <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.04)", borderRadius: "14px", marginBottom: "16px" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.5 }}>{user.bio}</p>
        </div>
      )}

      {/* Season Peak */}
      {user.seasonPeak && user.seasonPeak !== ratingVal && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "rgba(251,191,36,0.08)", borderRadius: "12px", border: "1px solid rgba(251,191,36,0.2)" }}>
          <Star size={16} style={{ color: "#fbbf24" }} />
          <span style={{ fontSize: "0.78rem", color: "#fbbf24", fontWeight: 700 }}>
            Season Peak: {user.seasonPeak} ELO
          </span>
        </div>
      )}
    </div>
  );
}

function StatisticsTab({ user, stats, inPlacement }: {
  user: UserProfile;
  stats: ReturnType<typeof calculateLifetimeStats>;
  inPlacement: boolean;
}) {
  const winRate = user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0;
  const botWinRate = user.botWins + user.botLosses > 0 ? Math.round((user.botWins / (user.botWins + user.botLosses)) * 100) : 0;

  return (
    <div>
      <h3 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#60a5fa", margin: "0 0 12px 0", fontWeight: 800 }}>
        <BarChart3 size={14} style={{ display: "inline", marginRight: "6px" }} />
        Detailed Statistics
      </h3>

      <div className="profile-stats-detailed" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <DetailedStatCard icon={<Trophy size={16} />} label="Ranked Elo" value={inPlacement ? "Placements" : String(user.rating ?? "-")} sub={`Peak: ${user.peakElo ?? user.peakRating ?? "-"}`} />
        <DetailedStatCard icon={<Swords size={16} />} label="Ranked Matches" value={String(user.gamesPlayed)} sub={`${user.wins}W · ${user.losses}L`} />
        <DetailedStatCard icon={<TrendingUp size={16} />} label="Win Rate" value={`${winRate}%`} color={winRate >= 50 ? "#34d399" : "#f87171"} />
        <DetailedStatCard icon={<Activity size={16} />} label="Win Streak" value={user.streak ? String(user.streak) : "0"} color={user.streak && user.streak > 0 ? "#fbbf24" : undefined} />
        <DetailedStatCard icon={<Clock size={16} />} label="Best Time" value={stats.pbMs ? formatTime(stats.pbMs) : "-"} />
        <DetailedStatCard icon={<Clock size={16} />} label="Avg Time" value={stats.avgMs ? formatTime(stats.avgMs) : "-"} />
        <DetailedStatCard icon={<Gamepad2 size={16} />} label="Bot Matches" value={String(user.botWins + user.botLosses)} sub={`${user.botWins}W · ${user.botLosses}L`} />
        <DetailedStatCard icon={<Gamepad2 size={16} />} label="Bot Win Rate" value={`${botWinRate}%`} color={botWinRate >= 50 ? "#34d399" : "#f87171"} />
        <DetailedStatCard icon={<BarChart3 size={16} />} label="Avg TPS" value={stats.avgTps} sub={`Best: ${stats.fastestTps}`} />
        <DetailedStatCard icon={<Medal size={16} />} label="Total Solves" value={String(stats.totalSolves)} />
      </div>

      {/* Season Info */}
      {!inPlacement && (
        <div style={{ marginTop: "16px", padding: "14px", background: "rgba(255,255,255,0.04)", borderRadius: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Current Season</span>
            <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{new Date().toISOString().slice(0, 7)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Season Elo</div>
              <div style={{ fontSize: "1.1rem", color: "#f8fafc", fontWeight: 800 }}>{user.seasonRating ?? user.rating ?? 1200}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Season Peak</div>
              <div style={{ fontSize: "1.1rem", color: "#fbbf24", fontWeight: 800 }}>{user.seasonPeak ?? user.rating ?? 1200}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600 }}>Global Peak</div>
              <div style={{ fontSize: "1.1rem", color: "#818cf8", fontWeight: 800 }}>{user.globalPeak ?? user.rating ?? 1200}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AchievementsTab() {
  const [data, setData] = useState<AchievementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<AchievementCategory>("BEGINNER");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAchievements()
      .then((d) => { if (active) { setData(d); setLoading(false); } })
      .catch(() => { if (active) { setLoading(false); } });
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => {
    if (!data) return [];
    const cats = new Set(data.achievements.map((a) => a.category));
    return Array.from(cats).sort((a, b) => CATEGORY_ORDER[a] - CATEGORY_ORDER[b]);
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.achievements
      .filter((a) => a.category === selectedCat && !(a.hidden && !data.progress.find((p) => p.achievementId === a.id)?.unlockedAt))
      .sort((a, b) => a.order - b.order);
  }, [data, selectedCat]);

  const catProgress = useMemo(() => {
    if (!data) return new Map();
    const map = new Map<AchievementCategory, { unlocked: number; total: number; pts: number; totalPts: number }>();
    for (const cat of categories) {
      const items = data.achievements.filter((a) => a.category === cat);
      const unlocked = items.filter((a) => data.progress.find((p) => p.achievementId === a.id)?.unlockedAt).length;
      const pts = items.filter((a) => data.progress.find((p) => p.achievementId === a.id)?.unlockedAt).reduce((s, a) => s + a.points, 0);
      const totalPts = items.reduce((s, a) => s + a.points, 0);
      map.set(cat, { unlocked, total: items.length, pts, totalPts });
    }
    return map;
  }, [data, categories]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: "40px", color: "#64748b", fontWeight: 600 }}>Loading achievements...</div>;
  }

  if (!data) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <Medal size={40} style={{ color: "#6366f1", marginBottom: "12px", opacity: 0.6 }} />
        <p style={{ color: "#64748b", fontSize: "0.9rem", fontWeight: 700, margin: "0 0 4px 0" }}>Sign in to track achievements</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <h3 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#60a5fa", margin: 0, fontWeight: 800 }}>
          <Medal size={14} style={{ display: "inline", marginRight: "6px" }} />
          Achievements
        </h3>
        <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>
          {data.earnedPoints} / {data.totalPoints} pts
        </span>
      </div>

      {/* Category tabs */}
      <div style={{ display: "flex", gap: "4px", overflow: "auto", marginBottom: "12px", paddingBottom: "4px" }}>
        {categories.map((cat) => {
          const prog = catProgress.get(cat);
          const pct = prog && prog.total > 0 ? Math.round((prog.unlocked / prog.total) * 100) : 0;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCat(cat)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 12px", borderRadius: "10px", border: "none",
                background: selectedCat === cat ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                color: selectedCat === cat ? "#818cf8" : "#94a3b8",
                fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
                whiteSpace: "nowrap", transition: "all 0.15s",
                flexShrink: 0,
              }}
            >
              <span>{CATEGORY_ICONS[cat]}</span>
              <span>{CATEGORY_LABELS[cat]}</span>
              <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>{pct}%</span>
            </button>
          );
        })}
      </div>

      {/* Achievement grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {filtered.map((ach) => {
          const entry = data.progress.find((p) => p.achievementId === ach.id);
          const unlocked = entry?.unlockedAt != null;
          const rarityColors: Record<string, string> = {
            common: "#94a3b8", rare: "#60a5fa", epic: "#a78bfa", legendary: "#facc15",
          };
          const color = rarityColors[ach.rarity] ?? "#94a3b8";
          return (
            <div
              key={ach.id}
              style={{
                padding: "12px", borderRadius: "14px",
                background: unlocked ? `${color}11` : "rgba(255,255,255,0.03)",
                border: `1px solid ${unlocked ? `${color}44` : "rgba(148,163,184,0.1)"}`,
                transition: "all 0.2s",
                opacity: unlocked ? 1 : 0.6,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.1rem",
                  background: unlocked ? `${color}22` : "rgba(255,255,255,0.05)",
                  border: `1px solid ${unlocked ? `${color}33` : "rgba(148,163,184,0.15)"}`,
                }}>
                  {unlocked ? (ICON_MAP[ach.icon] ?? "★") : <Lock size={14} style={{ color: "#475569" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 800, color: unlocked ? "#f1f5f9" : "#64748b" }}>
                      {unlocked ? ach.name : "???"}
                    </span>
                    <span style={{
                      fontSize: "0.6rem", fontWeight: 700, padding: "1px 6px", borderRadius: "6px",
                      color, background: `${color}18`, textTransform: "uppercase",
                    }}>
                      {ach.rarity}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "0.68rem", color: "#64748b", lineHeight: 1.3 }}>
                    {unlocked ? ach.description : "???"}
                  </p>
                  {entry && !unlocked && entry.progress > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <div style={{ height: "4px", borderRadius: "4px", background: "rgba(148,163,184,0.15)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.round(entry.progress * 100)}%`, borderRadius: "4px", background: color, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: 600, marginTop: "2px", display: "block" }}>
                        {Math.round(entry.progressValue)}/{entry.progressTarget}
                      </span>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: "0.6rem", color: "#475569", fontWeight: 700, whiteSpace: "nowrap" }}>
                  +{ach.points}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "30px", color: "#475569", fontSize: "0.82rem", fontStyle: "italic" }}>
          No achievements in this category.
        </div>
      )}
    </div>
  );
}

const ICON_MAP: Record<string, string> = {
  "cube": "🧊", "stopwatch": "⏱️", "lightning": "⚡", "bolt": "⚡",
  "cube-stack": "📦", "layers": "📚", "zap": "⚡", "flame": "🔥",
  "gold-bolt": "⚡", "trophy": "🏆", "fire-trophy": "🔥",
  "bronze-medal": "🥉", "silver-medal": "🥈", "gold-medal": "🥇",
  "user-plus": "➕", "handshake": "🤝", "eye": "👁️", "cake": "🎂",
  "moon": "🌙", "phoenix": "🦅", "google": "G",
};

function HistoryTab({ privateHistory }: { privateHistory: any[] }) {
  return (
    <div>
      <h3 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#60a5fa", margin: "0 0 12px 0", fontWeight: 800 }}>
        <Swords size={14} style={{ display: "inline", marginRight: "6px" }} />
        Recent Matches
      </h3>
      {privateHistory.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 20px" }}>
          <Swords size={32} style={{ color: "#475569", marginBottom: "8px", opacity: 0.5 }} />
          <p style={{ color: "#475569", fontSize: "0.82rem", fontStyle: "italic", margin: 0 }}>No matches played yet.</p>
          <p style={{ color: "#394150", fontSize: "0.75rem", margin: "4px 0 0 0" }}>Ranked match history will appear here after your first match.</p>
        </div>
      ) : (
        <div className="history-list" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {privateHistory.map((item: any) => (
            <div key={item.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 14px", background: "rgba(255,255,255,0.04)", borderRadius: "14px",
            }}>
              <div>
                <strong style={{ color: "#f1f5f9", fontSize: "0.85rem" }}>vs {item.opponent}</strong>
                <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600, marginTop: "2px" }}>
                  {new Date(item.date).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#f1f5f9", fontVariantNumeric: "tabular-nums" }}>
                  {item.timeMs ? formatTime(item.timeMs) : "DNF"}
                </span>
                <span style={{
                  padding: "3px 10px", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 800,
                  background: item.winner === "You" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
                  color: item.winner === "You" ? "#34d399" : "#f87171",
                }}>
                  {item.winner === "You" ? "WON" : "LOST"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab({ draft, setDraft, isGuest, auth, user, onLogout }: {
  draft: any;
  setDraft: (fn: (prev: any) => any) => void;
  isGuest: boolean;
  auth: any;
  user: UserProfile;
  onLogout: () => void;
}) {
  return (
    <div>
      <h3 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#60a5fa", margin: "0 0 12px 0", fontWeight: 800 }}>
        <Shield size={14} style={{ display: "inline", marginRight: "6px" }} />
        Profile Settings
      </h3>

      <div className="auth-fields" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <label>
          <span>Username</span>
          <input value={draft.username} disabled={isGuest} placeholder={isGuest ? auth.guestUsername : "Your username"} onChange={(event) => setDraft((current: any) => ({ ...current, username: event.target.value }))} />
        </label>
        <label>
          <span>Avatar URL</span>
          <input value={draft.avatar} disabled={isGuest} placeholder={isGuest ? "Google URL (Locked)" : "https://domain.com/image.png"} onChange={(event) => setDraft((current: any) => ({ ...current, avatar: event.target.value }))} />
        </label>
        <label>
          <span>Country Code / Name</span>
          <input value={draft.country} disabled={isGuest} placeholder={isGuest ? "US / IN / GB (Locked)" : "US / IN / GB / Canada"} onChange={(event) => setDraft((current: any) => ({ ...current, country: event.target.value }))} />
        </label>
        <label>
          <span>Favorite Mode</span>
          <input value={draft.favoriteMode} disabled={isGuest} placeholder={isGuest ? "Practice (Locked)" : "Practice / Ranked"} onChange={(event) => setDraft((current: any) => ({ ...current, favoriteMode: event.target.value }))} />
        </label>
        <label>
          <span>Bio</span>
          <textarea value={draft.bio} disabled={isGuest} placeholder={isGuest ? "Sign in to customize bio..." : "Add your cuber description..."} onChange={(event) => setDraft((current: any) => ({ ...current, bio: event.target.value }))} maxLength={220} />
        </label>
      </div>

      {/* Theme Toggle */}
      <div className="theme-toggle-container" style={{ marginTop: "16px" }}>
        <button
          className={`premium-theme-toggle ${draft.theme === "dark" ? "is-dark" : "is-light"}`}
          onClick={() => setDraft((current: any) => ({ ...current, theme: current.theme === "dark" ? "light" : "dark" }))}
          aria-label="Toggle theme"
        >
          <motion.div
            className="theme-toggle-orb"
            layout
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {draft.theme === "dark" ? (
              <Moon size={14} className="theme-icon-dark" />
            ) : (
              <Sun size={14} className="theme-icon-light" />
            )}
          </motion.div>
          <div className="theme-toggle-bg" />
        </button>
      </div>

      {!isGuest && (
        <button type="button" className="profile-logout" onClick={onLogout} style={{ marginTop: "16px" }}>
          <LogOut size={16} aria-hidden="true" />
          Logout
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "14px", padding: "12px" }}>
      <span style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "6px" }}>
        <strong style={{ fontSize: "1rem", color: color ?? "#f1f5f9", fontWeight: 800 }}>{value}</strong>
        {sub && <small style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 600 }}>{sub}</small>}
      </div>
    </div>
  );
}

function DetailedStatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", background: "rgba(255,255,255,0.04)", borderRadius: "14px", border: "1px solid rgba(148,163,184,0.1)" }}>
      <div style={{ color: "#6366f1", display: "flex" }}>{icon}</div>
      <div>
        <div style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontSize: "1rem", fontWeight: 800, color: color ?? "#f1f5f9", fontVariantNumeric: "tabular-nums" }}>{value}</div>
        {sub && <div style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}
