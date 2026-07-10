export interface RoomPlayer {
  clientId: string;
  socketId: string;
  username: string;
  avatar: string | null;
  ready: boolean;
  connected: boolean;
  pingMs: number | null;
}

export interface RoomSettings {
  puzzle: "3x3";
  gameType: "race";
  inspectionEnabled: boolean;
  bestOf: 1 | 3 | 5;
  scrambleVisibility: "hidden" | "visible";
  botFill: boolean;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface RoomState {
  code: string;
  roomId: string;
  host: RoomPlayer;
  guest: RoomPlayer | null;
  spectator: RoomPlayer | null;
  settings: RoomSettings;
  status: "lobby" | "match" | "finished";
  currentMatchId: string | null;
  scores: Record<string, number>;
  chat: ChatMessage[];
  winnerClientId: string | null;
}
