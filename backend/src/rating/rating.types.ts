export interface RatingState {
  userId: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  streak: number;
  peakRating: number;
  seasonRating: number;
  updatedAt: Date;
}

export interface MatchRatingUpdate {
  matchId: string;
  userId: string;
  oldRating: number;
  newRating: number;
  ratingChange: number;
  oldSeasonRating: number;
  newSeasonRating: number;
  seasonRatingChange: number;
  newStreak: number;
  createdAt: Date;
}
