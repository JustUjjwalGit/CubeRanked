import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Play, Copy, Share2, Tv, Send, Users } from "lucide-react";
import AppBackground from "../../components/AppBackground";
import { socketManager } from "../../network/socketManager";
import type { RoomState, RoomSettings, ChatMessage } from "../../network/socketTypes";

export default function PrivateLobbyScreen({
  roomState,
  roomError,
  clientId,
  onBack,
}: {
  roomState: RoomState | null;
  roomError: string | null;
  clientId: string | null;
  onBack: () => void;
}) {
  const [joinCode, setJoinCode] = useState("");
  const [chatText, setChatText] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [roomState?.chat]);

  const handleCreate = () => {
    socketManager.createRoom();
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    if (joinCode.trim().length === 6) {
      socketManager.joinRoom(joinCode.trim().toUpperCase());
    }
  };

  const handleSpectate = (e: FormEvent) => {
    e.preventDefault();
    if (joinCode.trim().length === 6) {
      socketManager.spectateRoom(joinCode.trim().toUpperCase());
    }
  };

  const handleSendChat = (e: FormEvent) => {
    e.preventDefault();
    if (chatText.trim()) {
      socketManager.sendRoomChat(chatText.trim());
      setChatText("");
    }
  };

  const handleSettingsChange = (update: Partial<RoomSettings>) => {
    socketManager.updateRoomSettings(update);
  };

  const handleCopyCode = () => {
    if (!roomState) return;
    navigator.clipboard.writeText(roomState.code).catch(() => undefined);
  };

  const handleCopyLink = () => {
    if (!roomState) return;
    const link = `${window.location.origin}${window.location.pathname}?room=${roomState.code}`;
    navigator.clipboard.writeText(link).catch(() => undefined);
  };

  const isHost = roomState?.host.clientId === clientId;
  const isGuest = roomState?.guest?.clientId === clientId;
  const isSpectator = roomState?.spectator?.clientId === clientId;

  const canStart = roomState && roomState.host.ready && roomState.guest?.ready && roomState.host.connected && roomState.guest.connected;

  if (!roomState) {
    return (
      <motion.section
        className="private-setup-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <AppBackground />

        <div className="setup-container">
          <header className="setup-header">
            <button type="button" className="back-btn" onClick={onBack}>
              <ChevronLeft size={16} />
              Back
            </button>
            <h2>Private Multiplayer</h2>
          </header>

          <div className="setup-card">
            <h3>Create a Room</h3>
            <p>Start a new private match lobby and invite your friends to race.</p>
            <button type="button" className="create-room-btn" onClick={handleCreate}>
              <Play size={16} />
              Create Room
            </button>

            <div className="divider"><span>OR</span></div>

            <h3>Join Room</h3>
            <form onSubmit={handleJoin} className="join-form">
              <input
                type="text"
                placeholder="Enter 6-char code (e.g. A7K9XM)"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="code-input"
              />
              <div className="join-actions">
                <button type="submit" disabled={joinCode.trim().length !== 6} className="join-btn">
                  Join as Player
                </button>
                <button type="button" onClick={handleSpectate} disabled={joinCode.trim().length !== 6} className="spectate-btn">
                  <Tv size={16} />
                  Spectate
                </button>
              </div>
            </form>

            {roomError && (
              <div className="room-error-alert">
                {roomError}
              </div>
            )}
          </div>
        </div>
      </motion.section>
    );
  }

  const hostWins = roomState.scores[roomState.host.clientId] || 0;
  const guestWins = roomState.guest ? (roomState.scores[roomState.guest.clientId] || 0) : 0;

  return (
    <motion.section
      className="private-lobby-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <AppBackground />

      <div className="lobby-container">
        <header className="lobby-header">
          <button type="button" className="back-btn" onClick={() => socketManager.leaveRoom()}>
            <ChevronLeft size={16} />
            Leave Room
          </button>
          <div className="lobby-title">
            <span>Room Code</span>
            <h2>{roomState.code}</h2>
          </div>
          <div className="invite-actions">
            <button type="button" onClick={handleCopyCode} className="action-chip">
              <Copy size={14} />
              Copy Code
            </button>
            <button type="button" onClick={handleCopyLink} className="action-chip">
              <Share2 size={14} />
              Copy Link
            </button>
          </div>
        </header>

        <div className="lobby-grid">
          <div className="lobby-players-panel">
            <h3>Lobby Players</h3>
            <div className="players-list">
              <div className={`lobby-player-card ${roomState.host.connected ? "online" : "offline"}`}>
                <div className="player-avatar">
                  {roomState.host.avatar ? (
                    <img src={roomState.host.avatar} alt="" />
                  ) : (
                    roomState.host.username.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="player-info">
                  <div className="name-row">
                    <strong>{roomState.host.username}</strong>
                    <span className="role-tag">Host</span>
                  </div>
                  <span className="ping-text">{roomState.host.connected ? `Ping: ${roomState.host.pingMs ?? "--"}ms` : "Disconnected"}</span>
                </div>
                <div className={`ready-badge ${roomState.host.ready ? "ready" : "not-ready"}`}>
                  {roomState.host.ready ? "READY" : "NOT READY"}
                </div>
              </div>

              {roomState.guest ? (
                <div className={`lobby-player-card ${roomState.guest.connected ? "online" : "offline"}`}>
                  <div className="player-avatar">
                    {roomState.guest.avatar ? (
                      <img src={roomState.guest.avatar} alt="" />
                    ) : (
                      roomState.guest.username.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="player-info">
                    <div className="name-row">
                      <strong>{roomState.guest.username}</strong>
                      <span className="role-tag">Guest</span>
                    </div>
                    <span className="ping-text">{roomState.guest.connected ? `Ping: ${roomState.guest.pingMs ?? "--"}ms` : "Disconnected"}</span>
                  </div>
                  <div className={`ready-badge ${roomState.guest.ready ? "ready" : "not-ready"}`}>
                    {roomState.guest.ready ? "READY" : "NOT READY"}
                  </div>
                </div>
              ) : (
                <div className="lobby-player-card empty">
                  <Users size={20} />
                  <span>Waiting for guest...</span>
                </div>
              )}

              {roomState.spectator ? (
                <div className="lobby-player-card spectator">
                  <div className="player-avatar">
                    {roomState.spectator.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="player-info">
                    <div className="name-row">
                      <strong>{roomState.spectator.username}</strong>
                      <span className="role-tag spec">Spectator</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="lobby-score-board">
              <h4>Series Score</h4>
              <div className="scores-row">
                <div className="score-block">
                  <span className="player-label">Host</span>
                  <span className="score-num">{hostWins}</span>
                </div>
                <div className="score-divider">:</div>
                <div className="score-block">
                  <span className="player-label">Guest</span>
                  <span className="score-num">{guestWins}</span>
                </div>
              </div>
              <div className="best-of-target">
                First to {Math.ceil(roomState.settings.bestOf / 2)} wins (Best of {roomState.settings.bestOf})
              </div>
            </div>
          </div>

          <div className="lobby-details-panel">
            <div className="lobby-settings-card">
              <h3>Match Settings</h3>
              <div className="settings-grid">
                <label className="select-row">
                  <span>Puzzle</span>
                  <select disabled value="3x3">
                    <option value="3x3">3x3</option>
                  </select>
                </label>
                <label className="select-row">
                  <span>Game Type</span>
                  <select disabled value="race">
                    <option value="race">Race</option>
                  </select>
                </label>
                <label className="switch-row compact">
                  <span>Inspection (15s)</span>
                  <input
                    type="checkbox"
                    checked={roomState.settings.inspectionEnabled}
                    disabled={!isHost}
                    onChange={(e) => handleSettingsChange({ inspectionEnabled: e.target.checked })}
                  />
                </label>
                <label className="select-row">
                  <span>Series Length</span>
                  <select
                    value={roomState.settings.bestOf}
                    disabled={!isHost}
                    onChange={(e) => handleSettingsChange({ bestOf: Number(e.target.value) as 1 | 3 | 5 })}
                  >
                    <option value={1}>Best of 1 (Single)</option>
                    <option value={3}>Best of 3</option>
                    <option value={5}>Best of 5</option>
                  </select>
                </label>
                <label className="select-row">
                  <span>Scramble Visibility</span>
                  <select
                    value={roomState.settings.scrambleVisibility}
                    disabled={!isHost}
                    onChange={(e) => handleSettingsChange({ scrambleVisibility: e.target.value as "hidden" | "visible" })}
                  >
                    <option value="hidden">Hidden during race</option>
                    <option value="visible">Visible (Practice Mode)</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="lobby-chat-card">
              <h3>Lobby Chat</h3>
              <div className="chat-messages-box">
                {roomState.chat.map((msg: ChatMessage) => {
                  const isSys = msg.senderName === "System";
                  return (
                    <div key={msg.id} className={`chat-line ${isSys ? "system" : ""}`}>
                      {!isSys && <span className="chat-sender">{msg.senderName}:</span>}
                      <span className="chat-text">{msg.text}</span>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendChat} className="chat-input-form">
                <input
                  type="text"
                  placeholder="Type a message..."
                  maxLength={140}
                  value={chatText}
                  disabled={isSpectator}
                  onChange={(e) => setChatText(e.target.value)}
                />
                <button type="submit" disabled={!chatText.trim() || isSpectator}>
                  <Send size={14} />
                </button>
              </form>
            </div>
          </div>
        </div>

        <footer className="lobby-footer">
          {roomState.status === "finished" ? (
            <div className="series-finished-banner">
              <h3>
                🏆 Series Won by{" "}
                {roomState.winnerClientId === roomState.host.clientId
                  ? roomState.host.username
                  : roomState.guest?.username}
                !
              </h3>
              {isHost && (
                <button type="button" className="reset-series-btn" onClick={() => socketManager.resetRoomSeries()}>
                  Reset Series
                </button>
              )}
            </div>
          ) : (
            <div className="action-row">
              {isSpectator ? (
                <div className="spec-wait-msg">
                  Watching match... Waiting for host to start.
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className={`ready-toggle-btn ${
                      (isHost ? roomState.host.ready : roomState.guest?.ready) ? "is-ready" : ""
                    }`}
                    onClick={() => socketManager.toggleRoomReady()}
                  >
                    {(isHost ? roomState.host.ready : roomState.guest?.ready) ? "Cancel Ready" : "Press Ready"}
                  </button>

                  {isHost && (
                    <button
                      type="button"
                      className="start-match-btn"
                      disabled={!canStart}
                      onClick={() => socketManager.startRoomMatch()}
                    >
                      Start Match
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </footer>
      </div>
    </motion.section>
  );
}
