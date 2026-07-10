export const APP_NAME = "CubeRanked";
export const APP_VERSION = "0.1.0";

export const RANK_TIERS = [
  { tier: "Unranked" as const, color: "#64748b", minRating: 0, maxRating: null, badge: "UR" },
  { tier: "Bronze" as const, color: "#b45309", minRating: 0, maxRating: 1199, badge: "BR" },
  { tier: "Silver" as const, color: "#94a3b8", minRating: 1200, maxRating: 1399, badge: "SV" },
  { tier: "Gold" as const, color: "#d97706", minRating: 1400, maxRating: 1599, badge: "GD" },
  { tier: "Platinum" as const, color: "#0d9488", minRating: 1600, maxRating: 1799, badge: "PL" },
  { tier: "Diamond" as const, color: "#2563eb", minRating: 1800, maxRating: 1999, badge: "DM" },
  { tier: "Master" as const, color: "#7c3aed", minRating: 2000, maxRating: 2199, badge: "MS" },
  { tier: "Legend" as const, color: "#e11d48", minRating: 2200, maxRating: null, badge: "LG" },
] as const;

export const DISCONNECT_GRACE_MS = 30_000;
export const COUNTDOWN_MS = 3_000;
export const MAX_HISTORY_SIZE = 120;
export const MAX_REPLAYS = 150;
export const MAX_CHAT_MESSAGES = 50;
export const PRACTICE_HISTORY_KEY = "cuberanked.practice.history";
export const SETTINGS_KEY = "cuberanked.practice.settings";
export const BEST_TIME_KEY = "cuberanked.practice.bestTimeMs";
export const BOT_STATS_KEY = "cuberanked.botRace.stats";
export const CLIENT_ID_KEY = "cuberanked.clientId";
export const ACCESS_TOKEN_KEY = "cuberanked.auth.accessToken";
export const REFRESH_TOKEN_KEY = "cuberanked.auth.refreshToken";
export const EXPIRES_AT_KEY = "cuberanked.auth.accessTokenExpiresAt";
