export type PlayerStatus = 'waiting' | 'playing' | 'idle';

export interface Player {
  id: string;
  name: string;
  teamName?: string;
  avatarUrl?: string; // Profile Picture
  matchesPlayed: number;
  wins: number;
  pointsScored: number;
  pointsAllowed: number;
  status: PlayerStatus;
  joinedAt: number;
  isApproved: boolean;
  homeGamesPlayed: number;
  timeAtTop: number;
  topSince: number | null;
}

export interface Match {
  id: string;
  playerAId: string;
  playerBId: string;
  scoreA: number;
  scoreB: number;
  winnerId?: string;
  momentPhotoUrl?: string; // Great Moments
  momentVideoUrl?: string; // Short Highlights
  momentCaption?: string;
  timestamp: number;
}
