import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  LogOut,
  User,
  Users,
  Settings,
  Gamepad2,
  Trophy,
  Tv,
  GraduationCap,
} from "lucide-react";
import AppBackground from "../../components/AppBackground";
import SocialSidebar from "../profile/SocialSidebar";
import { connectionLabel } from "../../utils/helpers";
import type { SocketConnectionState, SocketDebugSnapshot } from "../../network/socketTypes";
import type { UserProfile } from "../../api/auth";

const VERSION = "v0.3.0";

export default function HomeScreen({
  connectionState,
  onlineCount,
  authMode,
  user,
  onSettings,
  onLogin,
  onGuest,
  onProfile,
  onLogout,
  onPractice,
  onBotRace,
  onRanked,
  onPrivate,
  onLearn,
  socketSnapshot,
}: {
  connectionState: SocketConnectionState;
  onlineCount: number;
  authMode: "loading" | "guest" | "authenticated";
  user: UserProfile | null;
  onSettings: () => void;
  onLogin: () => void;
  onGuest: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onPractice: () => void;
  onBotRace: () => void;
  onRanked: () => void;
  onPrivate: () => void;
  onLearn: () => void;
  socketSnapshot: SocketDebugSnapshot;
}) {
  const [socialOpen, setSocialOpen] = useState(false);
  return (
    <motion.section
      className="home-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <AppBackground />
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
        <motion.div
          className="brand-orbit"
          animate={{ rotate: 360 }}
          transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <header className="home-topbar-new">
        <div className="launcher-brand-new">
          <img src="/logos/CubeRankedLogosFull.png" alt="CubeRanked" style={{ height: "42px", width: "auto", objectFit: "contain" }} />
        </div>

        <div className="top-right-actions">
          <div className={`connection-pill connection-${connectionState}`}>
            <span />
            {connectionLabel(connectionState)}
          </div>
          <div className="online-count-badge">
            <span className="pulse-dot" />
            {onlineCount.toLocaleString()} Online
          </div>

          {authMode !== "loading" && (
            <button
              type="button"
              className="social-toggle-btn"
              onClick={() => setSocialOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 14px",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(148, 163, 184, 0.16)",
                color: "#e2e8f0",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 150ms ease",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
                e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.16)";
              }}
            >
              <Users size={15} />
              <span>Social</span>
              {socketSnapshot.friendRequests.length > 0 && (
                <span style={{
                  display: "grid",
                  placeItems: "center",
                  minWidth: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  padding: "0 4px",
                }}>
                  {socketSnapshot.friendRequests.length}
                </span>
              )}
            </button>
          )}

          
          {authMode === "authenticated" && user ? (
            <div className="user-profile-widget">
              <button type="button" className="profile-chip-btn" onClick={onProfile}>
                {user.avatar ? (
                  <img src={user.avatar} alt="" />
                ) : (
                  <span>{user.username.slice(0, 2).toUpperCase()}</span>
                )}
                <strong>{user.username}</strong>
              </button>
              <button type="button" className="logout-icon-btn" onClick={onLogout} title="Logout">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <button type="button" className="auth-btn login" onClick={onLogin}>
                Sign In with Google
              </button>
              <button type="button" className="auth-btn guest" onClick={onGuest}>
                <User size={14} /> Guest
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="lobby-modes-container">
        <div className="lobby-modes-header">
          <span>Select Game Mode</span>
          <h1>LOBBY</h1>
        </div>
        
        <div className="lobby-modes-grid">
          <button type="button" className="lobby-mode-card" onClick={onPractice}>
            <div className="mode-card-icon-wrap icon-practice">
              <Gamepad2 size={28} />
            </div>
            <div className="mode-card-info">
              <h3>Practice</h3>
              <p>Offline 3x3 trainer & scramble stats</p>
            </div>
            <div className="mode-card-status select-text">
              Enter Mode
            </div>
          </button>

          <button type="button" className="lobby-mode-card" onClick={onBotRace}>
            <div className="mode-card-icon-wrap icon-bot">
              <Tv size={28} />
            </div>
            <div className="mode-card-info">
              <h3>Bot Race</h3>
              <p>Race a human-like AI speedcuber</p>
            </div>
            <div className="mode-card-status select-text">
              Enter Mode
            </div>
          </button>

          <button type="button" className="lobby-mode-card" onClick={onRanked}>
            <div className="mode-card-icon-wrap icon-ranked">
              <Trophy size={28} />
            </div>
            <div className="mode-card-info">
              <h3>Ranked</h3>
              <p>Matchmake against live opponents online</p>
            </div>
            <div className="mode-card-status select-text">
              Find Match
            </div>
          </button>

          <button type="button" className="lobby-mode-card" onClick={onPrivate}>
            <div className="mode-card-icon-wrap icon-private">
              <Users size={28} />
            </div>
            <div className="mode-card-info">
              <h3>Private Room</h3>
              <p>Create or join custom multiplayer lobby</p>
            </div>
            <div className="mode-card-status select-text">
              Join Room
            </div>
          </button>

          <button type="button" className="lobby-mode-card learn-featured-card" onClick={onLearn} style={{ gridColumn: "span 2" }}>
            <div className="mode-card-icon-wrap icon-learn">
              <GraduationCap size={28} />
            </div>
            <div className="mode-card-info">
              <div className="featured-badge">Academy</div>
              <h3>Learn</h3>
              <p>Master Rubik's Cube notation and interactive beginner-to-advanced lessons</p>
            </div>
            <div className="mode-card-status select-text">
              Enter Academy
            </div>
          </button>
        </div>
      </div>

      <footer className="home-footer-new">
        <div className="footer-left">
          <span>Client Version {VERSION}</span>
        </div>
        <div className="footer-right">
          <button type="button" className="footer-settings-btn" onClick={onSettings}>
            <Settings size={16} />
            Settings
          </button>
        </div>
      </footer>

      <AnimatePresence>
        {socialOpen && (
          <SocialSidebar
            snapshot={socketSnapshot}
            onClose={() => setSocialOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}
