export interface Hole {
  number: number;
  par: number;
  distanceFt?: number;
}

export interface Course {
  id: string;
  name: string;
  location?: string;
  holes: Hole[];
  /** Total score that is treated as a "1000 rating" round on this course. Defaults to par. */
  ratingBasis: number;
  /** Estimated rating points gained/lost per throw relative to ratingBasis. */
  pointsPerThrow: number;
  createdAt: string;
}

export interface Player {
  id: string;
  name: string;
  isSelf?: boolean;
  /** True if this player has their own login (vs. a guest added by name only). */
  hasAccount?: boolean;
  color: string;
  createdAt: string;
}

export interface Round {
  id: string;
  courseId: string;
  date: string; // ISO date (yyyy-mm-dd)
  playerIds: string[];
  /** playerId -> strokes per hole, same length/order as course.holes at time of play */
  scores: Record<string, number[]>;
  notes?: string;
  createdAt: string;
  /** True if this round was played with handicap allowances applied. */
  handicapped?: boolean;
  /**
   * playerId -> bonus strokes for this round, locked in at round start from
   * each player's handicap at the time (relative to the lowest in the
   * group). Only present when handicapped is true.
   */
  handicapAllowances?: Record<string, number>;
  /**
   * playerId -> team index (0-based), when this was played as a team round.
   * Team rounds don't count toward anyone's handicap or rating history.
   */
  teamAssignments?: Record<string, number>;
}
