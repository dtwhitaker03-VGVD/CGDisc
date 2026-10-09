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
  /** Optional hole-layout map image (a full URL, or a path relative to the app's own origin). */
  mapImageUrl?: string;
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
   */
  teamAssignments?: Record<string, number>;
  /**
   * How a team round is scored, when teamAssignments is set:
   * - "scramble": the whole team shares one ball/score per hole. Doesn't
   *   count toward anyone's handicap or rating.
   * - "bestBall": each player plays (and is scored) individually; their
   *   score counts toward handicap/rating as normal. The team's score is
   *   the lowest among teammates on each hole.
   * - "teamTotal": each player plays (and is scored) individually, same as
   *   bestBall and counting toward handicap/rating the same way, but the
   *   team's score is the sum of teammates' scores rather than the low.
   * Older rounds saved before this existed have teamAssignments but no
   * teamGameType, and are treated like "scramble" for rating purposes
   * (excluded) to preserve their original behavior.
   */
  teamGameType?: "scramble" | "bestBall" | "teamTotal";
  /**
   * How the round's overall result is determined. Only meaningful for
   * straight (non-handicapped) individual rounds and team rounds --
   * handicapped rounds always score by strokes.
   * - "strokes" (default when unset): lowest total strokes wins, as always.
   * - "holes": match-play style -- whoever (or whichever team, scored per
   *   teamGameType) has the lowest score on a hole wins it; a tie between
   *   the lowest scorers halves the hole (nobody wins it). The result is
   *   each player's/team's hole-win count. Individual strokes are still
   *   recorded and still count toward handicap/rating as normal.
   */
  scoringMethod?: "strokes" | "holes";
  /**
   * playerId -> how many holes they played before leaving the round early.
   * Their recorded score through that many holes still counts (lifetime
   * hole stats, the saved scorecard), but the round is excluded from their
   * handicap/rating and from course low/avg/high stats since it isn't a
   * complete round to compare against full ones. Only straight and
   * handicapped individual rounds support this (not team rounds).
   */
  droppedPlayers?: Record<string, number>;
}
