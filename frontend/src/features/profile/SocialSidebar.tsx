import { useState, type FormEvent, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, UserPlus, Check, Trash2, Play, Search, Clock } from "lucide-react";
import { socketManager } from "../../network/socketManager";
import type { SocketDebugSnapshot } from "../../network/socketTypes";

interface SocialSidebarProps {
  snapshot: SocketDebugSnapshot;
  onClose: () => void;
}

const activityColors: Record<string, string> = {
  match: "#f59e0b",
  queue: "#818cf8",
  practice: "#10b981",
  online: "#22c55e",
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

function FriendSkeleton() {
  return (
    <div className="social-skeleton">
      <div className="social-skeleton-avatar" />
      <div className="social-skeleton-lines">
        <div className="social-skeleton-name" />
        <div className="social-skeleton-status" />
      </div>
    </div>
  );
}

export default function SocialSidebar({ snapshot, onClose }: SocialSidebarProps) {
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "recent" | "privacy">("friends");
  const [addUsername, setAddUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 400);
    return () => clearTimeout(t);
  }, []);

  const friends = snapshot.friends || [];
  const requests = snapshot.friendRequests || [];
  const recents = snapshot.recentOpponents || [];

  const handleAddFriendSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!addUsername.trim()) return;
    setAdding(true);
    setFeedback(null);
    socketManager.sendFriendRequest(addUsername.trim());
    setTimeout(() => {
      setAdding(false);
      setAddUsername("");
      setFeedback({ type: "success", message: `Friend request sent to ${addUsername}` });
      setTimeout(() => setFeedback(null), 3000);
    }, 600);
  };

  const tabs: Array<{ key: typeof activeTab; label: string; badge?: number }> = [
    { key: "friends", label: "Friends", badge: friends.length },
    { key: "requests", label: "Requests", badge: requests.length },
    { key: "recent", label: "Recents" },
    { key: "privacy", label: "Privacy" },
  ];

  return (
    <motion.aside
      className="social-sidebar"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
    >
      {/* Header */}
      <div className="social-header">
        <div className="social-header-left">
          <div className="social-header-icon">
            <Users size={18} />
          </div>
          <h2>Social</h2>
        </div>
        <button type="button" onClick={onClose} className="social-close-btn" aria-label="Close social">
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="social-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`social-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="social-tab-badge">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="social-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === "friends" && (
              <>
                {/* Search / Add Friend */}
                <form className="social-search-form" onSubmit={handleAddFriendSubmit}>
                  <Search size={14} className="social-search-icon" />
                  <input
                    className="social-search-input"
                    value={addUsername}
                    onChange={(e) => setAddUsername(e.target.value)}
                    placeholder="Add friend by username"
                  />
                  <button type="submit" className="social-search-btn" disabled={adding || !addUsername.trim()}>
                    <UserPlus size={14} />
                  </button>
                </form>

                {feedback && (
                  <div className={`social-feedback ${feedback.type}`}>
                    {feedback.message}
                  </div>
                )}

                {/* Friends List */}
                <div className="social-list">
                  {!loaded ? (
                    <>
                      <FriendSkeleton />
                      <FriendSkeleton />
                      <FriendSkeleton />
                    </>
                  ) : friends.length === 0 ? (
                    <div className="social-empty">
                      <Users size={24} className="social-empty-icon" />
                      <p>No friends yet</p>
                      <span>Add friends to race together</span>
                    </div>
                  ) : (
                    friends.map((friend: any, i: number) => (
                      <motion.div
                        key={friend.id}
                        className="social-friend-card"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.25 }}
                      >
                        <div className="social-friend-avatar">
                          {friend.avatar
                            ? <img src={friend.avatar} alt="" />
                            : <span>{friend.username.slice(0, 2).toUpperCase()}</span>
                          }
                          <span
                            className="social-presence-dot"
                            style={{
                              background: friend.online
                                ? activityColors[friend.activity] || "#22c55e"
                                : "#475569",
                            }}
                          />
                        </div>
                        <div className="social-friend-info">
                          <span className="social-friend-name">{friend.username}</span>
                          <span
                            className="social-friend-status"
                            style={{
                              color: friend.online
                                ? (activityColors[friend.activity] || "#64748b")
                                : "#475569",
                            }}
                          >
                            {friend.online ? formatActivity(friend.activity) : "Offline"}
                          </span>
                        </div>
                        <div className="social-friend-actions">
                          {friend.online && (
                            <button
                              type="button"
                              className="social-action-btn primary"
                              title="Invite to Private Room"
                              onClick={() => {
                                if (snapshot.roomState) {
                                  socketManager.sendDirectInvite(friend.id, "private-room", snapshot.roomState.code);
                                } else {
                                  socketManager.joinRoom("");
                                }
                              }}
                            >
                              <Play size={12} fill="currentColor" />
                            </button>
                          )}
                          <button
                            type="button"
                            className="social-action-btn danger"
                            title="Remove Friend"
                            onClick={() => socketManager.removeFriend(friend.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </>
            )}

            {activeTab === "requests" && (
              <div className="social-list">
                {requests.length === 0 ? (
                  <div className="social-empty">
                    <UserPlus size={24} className="social-empty-icon" />
                    <p>No pending requests</p>
                    <span>Friend requests will appear here</span>
                  </div>
                ) : (
                  requests.map((req: any) => (
                    <div key={req.fromId} className="social-friend-card">
                      <div className="social-friend-avatar">
                        {req.fromAvatar
                          ? <img src={req.fromAvatar} alt="" />
                          : <span>{req.fromUsername.slice(0, 2).toUpperCase()}</span>
                        }
                      </div>
                      <div className="social-friend-info">
                        <span className="social-friend-name">{req.fromUsername}</span>
                        <span className="social-friend-status" style={{ color: "#64748b" }}>Wants to be friends</span>
                      </div>
                      <div className="social-friend-actions">
                        <button
                          type="button"
                          className="social-action-btn success"
                          title="Accept"
                          onClick={() => socketManager.respondFriendRequest(req.fromId, true)}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          className="social-action-btn danger"
                          title="Decline"
                          onClick={() => socketManager.respondFriendRequest(req.fromId, false)}
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
              <div className="social-list">
                {recents.length === 0 ? (
                  <div className="social-empty">
                    <Clock size={24} className="social-empty-icon" />
                    <p>No recent opponents</p>
                    <span>Play matchmade races to track them</span>
                  </div>
                ) : (
                  recents.map((recent: any) => (
                    <div key={recent.userId} className="social-friend-card">
                      <div className="social-friend-avatar">
                        {recent.avatar
                          ? <img src={recent.avatar} alt="" />
                          : <span>{recent.username.slice(0, 2).toUpperCase()}</span>
                        }
                      </div>
                      <div className="social-friend-info">
                        <span className="social-friend-name">{recent.username}</span>
                        <span className="social-friend-status" style={{ color: "#64748b" }}>
                          Played {new Date(recent.playedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="social-friend-actions">
                        <button
                          type="button"
                          className="social-action-btn neutral"
                          onClick={() => socketManager.sendFriendRequest(recent.username)}
                          title="Add Friend"
                        >
                          <UserPlus size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "privacy" && (
              <div className="social-privacy">
                <h4>Privacy</h4>
                <label className="social-privacy-row">
                  <div className="social-privacy-info">
                    <span>Show Online Status</span>
                    <small>Let friends see when you&apos;re active</small>
                  </div>
                  <div className="social-toggle">
                    <input type="checkbox" defaultChecked />
                    <span className="social-toggle-track">
                      <span className="social-toggle-thumb" />
                    </span>
                  </div>
                </label>
                <label className="social-privacy-row">
                  <div className="social-privacy-info">
                    <span>Allow Friend Requests</span>
                    <small>Let others add you as a friend</small>
                  </div>
                  <div className="social-toggle">
                    <input type="checkbox" defaultChecked />
                    <span className="social-toggle-track">
                      <span className="social-toggle-thumb" />
                    </span>
                  </div>
                </label>
                <label className="social-privacy-row">
                  <div className="social-privacy-info">
                    <span>Allow Private Invites</span>
                    <small>Let friends invite you to lobbies</small>
                  </div>
                  <div className="social-toggle">
                    <input type="checkbox" defaultChecked />
                    <span className="social-toggle-track">
                      <span className="social-toggle-thumb" />
                    </span>
                  </div>
                </label>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
