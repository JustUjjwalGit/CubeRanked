import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, UserPlus, UserMinus, ShieldAlert, Check, Trash2, Play, Tv, Lock, Globe, RefreshCcw } from "lucide-react";
import { socketManager } from "../../network/socketManager";
import type { SocketDebugSnapshot } from "../../network/socketTypes";

interface SocialSidebarProps {
  snapshot: SocketDebugSnapshot;
  onClose: () => void;
}

export default function SocialSidebar({ snapshot, onClose }: SocialSidebarProps) {
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "recent" | "privacy">("friends");
  const [addUsername, setAddUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const friends = snapshot.friends || [];
  const requests = snapshot.friendRequests || [];
  const recents = snapshot.recentOpponents || [];

  const handleAddFriendSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!addUsername.trim()) return;

    setAdding(true);
    setFeedback(null);

    // Call socket emitter
    socketManager.sendFriendRequest(addUsername.trim());
    
    // Set feedback timeout / sync
    setTimeout(() => {
      setAdding(false);
      setAddUsername("");
      setFeedback({ type: "success", message: `Friend request sent to ${addUsername}` });
      setTimeout(() => setFeedback(null), 3000);
    }, 600);
  };

  const formatActivity = (act: string) => {
    switch (act) {
      case "practice": return "In Practice";
      case "queue": return "In Ranked Queue";
      case "match": return "In Match";
      case "online": return "Online";
      default: return "Offline";
    }
  };

  const getActivityColor = (act: string) => {
    switch (act) {
      case "match": return "#f59e0b"; // amber
      case "queue": return "#818cf8"; // indigo
      case "practice": return "#10b981"; // emerald
      case "online": return "#22c55e"; // green
      default: return "#64748b"; // slate
    }
  };

  return (
    <motion.aside
      className="social-sidebar"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(360px, 92vw)",
        background: "rgba(9, 11, 18, 0.95)",
        backdropFilter: "blur(24px)",
        borderLeft: "1px solid rgba(148, 163, 184, 0.16)",
        zIndex: 8500,
        display: "flex",
        flexDirection: "column",
        boxShadow: "-10px 0 40px rgba(0, 0, 0, 0.5)",
      }}
    >
      {/* Header */}
      <div style={{ padding: "20px", borderBottom: "1px solid rgba(148, 163, 184, 0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Users size={20} style={{ color: "#60a5fa" }} />
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "#f1f5f9" }}>Social Dashboard</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(148,163,184,0.12)",
            borderRadius: "8px",
            width: "32px",
            height: "32px",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            color: "#94a3b8",
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
        {(["friends", "requests", "recent", "privacy"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "12px 0",
              background: activeTab === tab ? "rgba(99,102,241,0.1)" : "transparent",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid #6366f1" : "2px solid transparent",
              color: activeTab === tab ? "#f1f5f9" : "#64748b",
              fontSize: "0.78rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              cursor: "pointer",
              transition: "all 160ms ease",
            }}
          >
            {tab === "friends" ? `Friends (${friends.length})` :
             tab === "requests" ? `Requests (${requests.length})` :
             tab === "recent" ? `Recents` : "Privacy"}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {activeTab === "friends" && (
          <>
            {/* Add Friend Form */}
            <form onSubmit={handleAddFriendSubmit} style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <input
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                placeholder="Enter friend's username"
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(148,163,184,0.16)",
                  borderRadius: "10px",
                  padding: "0 12px",
                  height: "36px",
                  color: "#f1f5f9",
                  fontSize: "0.82rem",
                }}
              />
              <button
                type="submit"
                disabled={adding}
                style={{
                  background: "#4f46e5",
                  border: "none",
                  borderRadius: "10px",
                  width: "36px",
                  height: "36px",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  color: "#fff",
                }}
              >
                <UserPlus size={16} />
              </button>
            </form>

            {feedback && (
              <div style={{
                fontSize: "0.76rem",
                color: feedback.type === "success" ? "#34d399" : "#fca5a5",
                background: feedback.type === "success" ? "rgba(52,211,153,0.1)" : "rgba(252,165,165,0.1)",
                padding: "8px 12px",
                borderRadius: "8px",
                border: `1px solid ${feedback.type === "success" ? "rgba(52,211,153,0.2)" : "rgba(252,165,165,0.2)"}`,
              }}>
                {feedback.message}
              </div>
            )}

            {/* Friends List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {friends.length === 0 ? (
                <div style={{ textAlign: "center", color: "#475569", fontSize: "0.8rem", padding: "30px 0" }}>
                  Your friends list is currently empty.
                </div>
              ) : (
                friends.map((friend: any) => (
                  <div key={friend.id} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(148,163,184,0.08)",
                    borderRadius: "14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "10px",
                        background: "rgba(99,102,241,0.2)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "0.8rem",
                        fontWeight: 800,
                        color: "#a5b4fc",
                        position: "relative",
                        overflow: "hidden",
                      }}>
                        {friend.avatar ? <img src={friend.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : friend.username.slice(0, 2).toUpperCase()}
                        <span style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: friend.online ? getActivityColor(friend.activity) : "#64748b",
                          border: "1px solid #090b12",
                        }} />
                      </div>
                      <div>
                        <strong style={{ display: "block", fontSize: "0.84rem", color: "#f1f5f9" }}>{friend.username}</strong>
                        <span style={{ fontSize: "0.72rem", color: friend.online ? getActivityColor(friend.activity) : "#64748b", fontWeight: 700 }}>
                          {friend.online ? formatActivity(friend.activity) : "Offline"}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      {/* Invite Button (Only if friend is online) */}
                      {friend.online && (
                        <button
                          type="button"
                          title="Invite to Private Room"
                          onClick={() => {
                            if (snapshot.roomState) {
                              socketManager.sendDirectInvite(friend.id, "private-room", snapshot.roomState.code);
                            } else {
                              // Auto join/create private lobby
                              socketManager.joinRoom("");
                            }
                          }}
                          style={{
                            background: "rgba(99,102,241,0.15)",
                            border: "1px solid rgba(99,102,241,0.3)",
                            borderRadius: "8px",
                            width: "28px",
                            height: "28px",
                            display: "grid",
                            placeItems: "center",
                            cursor: "pointer",
                            color: "#818cf8",
                          }}
                        >
                          <Play size={12} fill="#818cf8" />
                        </button>
                      )}

                      <button
                        type="button"
                        title="Remove Friend"
                        onClick={() => socketManager.removeFriend(friend.id)}
                        style={{
                          background: "rgba(239,68,68,0.1)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          borderRadius: "8px",
                          width: "28px",
                          height: "28px",
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer",
                          color: "#ef4444",
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === "requests" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {requests.length === 0 ? (
              <div style={{ textAlign: "center", color: "#475569", fontSize: "0.8rem", padding: "30px 0" }}>
                No pending friend requests.
              </div>
            ) : (
              requests.map((req: any) => (
                <div key={req.fromId} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(148,163,184,0.08)",
                  borderRadius: "14px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "10px",
                      background: "rgba(99,102,241,0.2)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "0.8rem",
                      fontWeight: 800,
                      color: "#a5b4fc",
                    }}>
                      {req.fromAvatar ? <img src={req.fromAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : req.fromUsername.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ display: "block", fontSize: "0.84rem", color: "#f1f5f9" }}>{req.fromUsername}</strong>
                      <span style={{ fontSize: "0.72rem", color: "#64748b" }}>wants to add you</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => socketManager.respondFriendRequest(req.fromId, true)}
                      style={{
                        background: "#10b981",
                        border: "none",
                        borderRadius: "8px",
                        width: "28px",
                        height: "28px",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                        color: "#fff",
                      }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => socketManager.respondFriendRequest(req.fromId, false)}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(148,163,184,0.15)",
                        borderRadius: "8px",
                        width: "28px",
                        height: "28px",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                        color: "#94a3b8",
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "recent" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {recents.length === 0 ? (
              <div style={{ textAlign: "center", color: "#475569", fontSize: "0.8rem", padding: "30px 0" }}>
                No recent opponents found. Play matchmade races to track them here!
              </div>
            ) : (
              recents.map((recent: any) => (
                <div key={recent.userId} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(148,163,184,0.08)",
                  borderRadius: "14px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "10px",
                      background: "rgba(99,102,241,0.2)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "0.8rem",
                      fontWeight: 800,
                      color: "#a5b4fc",
                    }}>
                      {recent.avatar ? <img src={recent.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : recent.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ display: "block", fontSize: "0.84rem", color: "#f1f5f9" }}>{recent.username}</strong>
                      <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                        Played {new Date(recent.playedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => socketManager.sendFriendRequest(recent.username)}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(148,163,184,0.16)",
                      borderRadius: "8px",
                      width: "28px",
                      height: "28px",
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      color: "#cbd5e1",
                    }}
                  >
                    <UserPlus size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "privacy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", textAlign: "left" }}>
            <h4 style={{ fontSize: "0.85rem", color: "#f1f5f9", margin: "0 0 10px 0", fontWeight: 800 }}>Privacy Permissions</h4>
            
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div>
                <span style={{ display: "block", fontSize: "0.84rem", color: "#cbd5e1", fontWeight: 700 }}>Show Online Status</span>
                <small style={{ color: "#64748b", fontSize: "0.74rem" }}>Allows friends to see when you are active.</small>
              </div>
              <input type="checkbox" defaultChecked style={{ width: "16px", height: "16px", cursor: "pointer" }} />
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div>
                <span style={{ display: "block", fontSize: "0.84rem", color: "#cbd5e1", fontWeight: 700 }}>Allow Friend Requests</span>
                <small style={{ color: "#64748b", fontSize: "0.74rem" }}>Enables other cubers to add you as a friend.</small>
              </div>
              <input type="checkbox" defaultChecked style={{ width: "16px", height: "16px", cursor: "pointer" }} />
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div>
                <span style={{ display: "block", fontSize: "0.84rem", color: "#cbd5e1", fontWeight: 700 }}>Allow Private Invites</span>
                <small style={{ color: "#64748b", fontSize: "0.74rem" }}>Enables direct lobby race invites from friends.</small>
              </div>
              <input type="checkbox" defaultChecked style={{ width: "16px", height: "16px", cursor: "pointer" }} />
            </label>
          </div>
        )}

      </div>
    </motion.aside>
  );
}
