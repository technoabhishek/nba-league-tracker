export type PlayerStatus = 'waiting' | 'playing' | 'idle';

export interface Player {
  id: string;
  name: string;
  matchesPlayed: number;
  wins: number;
  status: PlayerStatus;
  joinedAt: number;
}

export interface Match {
  id: string;
  playerAId: string;
  playerBId: string;
  winnerId?: string;
  timestamp: number;
}
