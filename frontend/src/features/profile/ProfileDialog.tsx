import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, LogOut, X, Moon, Sun } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { getRankFromRating } from "../../utils/ranks";
import { formatTime } from "../../utils/sessionStats";
import { getLocalReplays } from "../../utils/replay";
import { calculateLifetimeStats } from "../../utils/statsEngine";
import type { UserProfile } from "../../api/auth";

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
  const rankInfo = getRankFromRating(ratingVal, user.placementMatchesPlayed != null && user.placementMatchesPlayed < 5);
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
                  void auth.startOAuth("google");
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
          </div>
        </div>

        <h3 style={{ fontSize: "0.88rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#60a5fa", margin: "20px 0 10px 0", fontWeight: 800 }}>
          Player Statistics
        </h3>
        <div className="profile-stats-grid" style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "10px",
          marginBottom: "24px",
        }}>
          <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "14px", padding: "12px", position: "relative" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Rank Badge</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
              <Award size={18} style={{ color: rankInfo.color }} />
              <strong style={{ fontSize: "1.1rem", color: "#f1f5f9", fontWeight: 800 }}>{rankInfo.tier}</strong>
            </div>
          </div>

          <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "14px", padding: "12px" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Elo Rating</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "6px" }}>
              <strong style={{ fontSize: "1.1rem", color: "#f1f5f9", fontWeight: 800 }}>{ratingVal} ELO</strong>
              <small style={{ fontSize: "0.7rem", color: "#64748b" }}>Peak: {user.peakRating ?? ratingVal}</small>
            </div>
          </div>

          <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "14px", padding: "12px" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Games (W/L)</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "6px" }}>
              <strong style={{ fontSize: "1.1rem", color: "#f1f5f9", fontWeight: 800 }}>{user.gamesPlayed}</strong>
              <small style={{ fontSize: "0.7rem", color: "#64748b" }}>{user.wins}W - {user.losses}L ({winRate}%)</small>
            </div>
          </div>

          <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "14px", padding: "12px" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Practice PB</span>
            <div style={{ marginTop: "6px" }}>
              <strong style={{ fontSize: "1.1rem", color: "#818cf8", fontWeight: 800 }}>
                {stats.pbMs ? formatTime(stats.pbMs) : "-"}
              </strong>
            </div>
          </div>

          <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "14px", padding: "12px" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Average TPS</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "6px" }}>
              <strong style={{ fontSize: "1.1rem", color: "#10b981", fontWeight: 800 }}>{stats.avgTps} t/s</strong>
              <small style={{ fontSize: "0.7rem", color: "#64748b" }}>Max: {stats.fastestTps}</small>
            </div>
          </div>

          <div style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: "14px", padding: "12px" }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Bot Race W/L</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "6px" }}>
              <strong style={{ fontSize: "1.1rem", color: "#f1f5f9", fontWeight: 800 }}>{user.botWins + user.botLosses}</strong>
              <small style={{ fontSize: "0.7rem", color: "#64748b" }}>{user.botWins}W - {user.botLosses}L</small>
            </div>
          </div>
        </div>

        <div className="auth-fields">
          <label>
            <span>Username</span>
            <input value={draft.username} disabled={isGuest} placeholder={isGuest ? auth.guestUsername : "Your username"} onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))} />
          </label>
          <label>
            <span>Avatar URL</span>
            <input value={draft.avatar} disabled={isGuest} placeholder={isGuest ? "Google URL (Locked)" : "https://domain.com/image.png"} onChange={(event) => setDraft((current) => ({ ...current, avatar: event.target.value }))} />
          </label>
          <label>
            <span>Country Code / Name</span>
            <input value={draft.country} disabled={isGuest} placeholder={isGuest ? "US / IN / GB (Locked)" : "US / IN / GB / Canada"} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))} />
          </label>
          <label>
            <span>Favorite Mode</span>
            <input value={draft.favoriteMode} disabled={isGuest} placeholder={isGuest ? "Practice (Locked)" : "Practice / Ranked"} onChange={(event) => setDraft((current) => ({ ...current, favoriteMode: event.target.value }))} />
          </label>
          <label>
            <span>Bio</span>
            <textarea value={draft.bio} disabled={isGuest} placeholder={isGuest ? "Sign in to customize bio..." : "Add your cuber description..."} onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))} maxLength={220} />
          </label>
        </div>

        <div className="profile-private-history">
          <h3 style={{ fontSize: "0.88rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#60a5fa", margin: "24px 0 10px 0", fontWeight: 800 }}>
            Private Match History
          </h3>
          {privateHistory.length === 0 ? (
            <p className="no-history-text" style={{ color: "#475569", fontSize: "0.82rem", fontStyle: "italic", margin: "4px 0" }}>No private matches played yet.</p>
          ) : (
            <div className="history-list">
              {privateHistory.map((item: any) => (
                <div key={item.id} className="history-item">
                  <div className="history-meta">
                    <strong>vs {item.opponent}</strong>
                    <span>{new Date(item.date).toLocaleDateString()}</span>
                  </div>
                  <div className="history-stats">
                    <span className="time-badge">{item.timeMs ? formatTime(item.timeMs) : "DNF"}</span>
                    <span className={`winner-badge ${item.winner === "You" ? "win" : "loss"}`}>
                      {item.winner === "You" ? "WON" : "LOST"}
                    </span>
                    <small className="replay-tag">{item.replayId}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="theme-toggle-container">
          <button
            className={`premium-theme-toggle ${draft.theme === "dark" ? "is-dark" : "is-light"}`}
            onClick={() => setDraft((current) => ({ ...current, theme: current.theme === "dark" ? "light" : "dark" }))}
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
          <button type="button" className="profile-logout" onClick={onLogout}>
            <LogOut size={16} aria-hidden="true" />
            Logout
          </button>
        )}
      </motion.section>
    </motion.div>
  );
}
