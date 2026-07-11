export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  country: string | null;
  bio: string;
  theme: "dark" | "light";
  favoriteMode: string;
  status: "online" | "offline";
  joinDate: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  botWins: number;
  botLosses: number;
  bestTimeMs: number | null;
  averageTimeMs: number | null;
  settings: Record<string, unknown>;
  statistics: UserStatistics;
  rating?: number;
  peakRating?: number;
  peakElo?: number;
  streak?: number;
  seasonRating?: number;
  seasonPeak?: number;
  globalPeak?: number;
  glicko?: GlickoState;
  placementMatchesPlayed?: number;
  winRate?: number;
}

export interface UserStatistics {
  gamesPlayed: number;
  wins: number;
  losses: number;
  botWins: number;
  botLosses: number;
  bestTimeMs: number | null;
  averageTimeMs: number | null;
  practiceHistory: unknown[];
}

export interface GlickoState {
  rating: number;
  rd: number;
  vol: number;
}

export interface AuthSession {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

export interface FriendEntry {
  id: string;
  username: string;
  avatar: string | null;
  online: boolean;
  activity: string;
  rating: number;
  peakRating: number;
  favoriteMode: string;
}

export interface FriendRequestEntry {
  id: string;
  fromId: string;
  fromUsername: string;
  fromAvatar: string | null;
  createdAt: string;
}

export interface RecentPlayerEntry {
  id: string;
  username: string;
  avatar: string | null;
  playedAt: string;
}
