import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { X, Users, UserPlus, Check, Trash2, Play } from "lucide-react";
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
    socketManager.sendFriendRequest(addUsername.trim());
    setTimeout(() => {
      setAdding(false);
      setAddUsername("");
      setFeedback({ type: "success", message: `Friend request sent to ${addUsername}` });
      setTimeout(() => setFeedback(null), 3000);
    }, 600);
  };

  return (
    <motion.aside
      className="social-sidebar"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
    >
      <div className="social-sidebar-header">
        <div className="social-sidebar-heading">
          <Users size={20} />
          <h2>Social Dashboard</h2>
        </div>
        <button type="button" onClick={onClose} className="social-sidebar-close" aria-label="Close social">
          <X size={16} />
        </button>
      </div>

      <div className="social-sidebar-tabs">
        {(["friends", "requests", "recent", "privacy"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`social-sidebar-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "friends" ? `Friends (${friends.length})` :
             tab === "requests" ? `Requests (${requests.length})` :
             tab === "recent" ? "Recents" : "Privacy"}
          </button>
        ))}
      </div>

      <div className="social-sidebar-content">
        {activeTab === "friends" && (
          <>
            <form className="social-sidebar-add-form" onSubmit={handleAddFriendSubmit}>
              <input
                className="social-sidebar-input"
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                placeholder="Enter friend's username"
              />
              <button type="submit" className="social-sidebar-add-btn" disabled={adding}>
                <UserPlus size={16} />
              </button>
            </form>

            {feedback && (
              <div className={`social-sidebar-feedback ${feedback.type}`}>
                {feedback.message}
              </div>
            )}

            <div className="social-sidebar-list">
              {friends.length === 0 ? (
                <div className="social-sidebar-empty">Your friends list is currently empty.</div>
              ) : (
                friends.map((friend: any) => (
                  <div key={friend.id} className="social-sidebar-item">
                    <div className="social-sidebar-user">
                      <div className="social-sidebar-avatar">
                        {friend.avatar
                          ? <img src={friend.avatar} alt="" />
                          : friend.username.slice(0, 2).toUpperCase()
                        }
                        <span
                          className="social-sidebar-status-dot"
                          style={{ background: friend.online ? activityColors[friend.activity] || "#64748b" : "#64748b" }}
                        />
                      </div>
                      <div>
                        <span className="social-sidebar-name">{friend.username}</span>
                        <span
                          className="social-sidebar-activity"
                          style={{ color: friend.online ? (activityColors[friend.activity] || "#64748b") : "#64748b" }}
                        >
                          {friend.online ? formatActivity(friend.activity) : "Offline"}
                        </span>
                      </div>
                    </div>
                    <div className="social-sidebar-actions">
                      {friend.online && (
                        <button
                          type="button"
                          className="social-sidebar-icon-btn primary"
                          title="Invite to Private Room"
                          onClick={() => {
                            if (snapshot.roomState) {
                              socketManager.sendDirectInvite(friend.id, "private-room", snapshot.roomState.code);
                            } else {
                              socketManager.joinRoom("");
                            }
                          }}
                        >
                          <Play size={12} fill="#818cf8" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="social-sidebar-icon-btn danger"
                        title="Remove Friend"
                        onClick={() => socketManager.removeFriend(friend.id)}
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
          <div className="social-sidebar-list">
            {requests.length === 0 ? (
              <div className="social-sidebar-empty">No pending friend requests.</div>
            ) : (
              requests.map((req: any) => (
                <div key={req.fromId} className="social-sidebar-item">
                  <div className="social-sidebar-user">
                    <div className="social-sidebar-avatar">
                      {req.fromAvatar
                        ? <img src={req.fromAvatar} alt="" />
                        : req.fromUsername.slice(0, 2).toUpperCase()
                      }
                    </div>
                    <div>
                      <span className="social-sidebar-name">{req.fromUsername}</span>
                      <span className="social-sidebar-activity" style={{ color: "#64748b" }}>wants to add you</span>
                    </div>
                  </div>
                  <div className="social-sidebar-actions">
                    <button
                      type="button"
                      className="social-sidebar-icon-btn success"
                      onClick={() => socketManager.respondFriendRequest(req.fromId, true)}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      className="social-sidebar-icon-btn neutral"
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
          <div className="social-sidebar-list">
            {recents.length === 0 ? (
              <div className="social-sidebar-empty">
                No recent opponents found. Play matchmade races to track them here!
              </div>
            ) : (
              recents.map((recent: any) => (
                <div key={recent.userId} className="social-sidebar-item">
                  <div className="social-sidebar-user">
                    <div className="social-sidebar-avatar">
                      {recent.avatar
                        ? <img src={recent.avatar} alt="" />
                        : recent.username.slice(0, 2).toUpperCase()
                      }
                    </div>
                    <div>
                      <span className="social-sidebar-name">{recent.username}</span>
                      <span className="social-sidebar-activity" style={{ color: "#64748b" }}>
                        Played {new Date(recent.playedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="social-sidebar-actions">
                    <button
                      type="button"
                      className="social-sidebar-icon-btn neutral"
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
          <div className="social-sidebar-privacy">
            <h4>Privacy Permissions</h4>
            <label>
              <div>
                <span>Show Online Status</span>
                <small>Allows friends to see when you are active.</small>
              </div>
              <input type="checkbox" defaultChecked />
            </label>
            <label>
              <div>
                <span>Allow Friend Requests</span>
                <small>Enables other cubers to add you as a friend.</small>
              </div>
              <input type="checkbox" defaultChecked />
            </label>
            <label>
              <div>
                <span>Allow Private Invites</span>
                <small>Enables direct lobby race invites from friends.</small>
              </div>
              <input type="checkbox" defaultChecked />
            </label>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
