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
}
