import type { Course, Round } from "../types";

export const DEFAULT_POINTS_PER_THROW = 10;

export function coursePar(course: Course): number {
  return course.holes.reduce((sum, h) => sum + h.par, 0);
}

export function totalScore(strokes: number[]): number {
  return strokes.reduce((sum, s) => sum + (Number.isFinite(s) ? s : 0), 0);
}

export function scoreToPar(strokes: number[], course: Course): number {
  return totalScore(strokes) - coursePar(course);
}

/**
 * Estimated round rating, in the same rough neighborhood as PDGA-style ratings
 * (roughly 700-1050 for typical recreational-to-pro play). This is a self-consistent
 * approximation for personal tracking, not an official PDGA rating: it has no access
 * to PDGA's course propagator data, so it instead anchors "1000" to a course's
 * configurable ratingBasis score and scales by pointsPerThrow.
 */
export function roundRating(strokes: number[], course: Course): number {
  const total = totalScore(strokes);
  const raw = 1000 - (total - course.ratingBasis) * course.pointsPerThrow;
  return Math.round(raw);
}

export interface Differential {
  roundId: string;
  date: string;
  courseId: string;
  value: number; // total - ratingBasis; lower (more negative) is better
}

/**
 * How many of the best (lowest) differentials to average, based on how many
 * rounds are on record. Loosely modeled on golf's World Handicap System table,
 * adapted since disc golf has no equivalent official standard.
 */
function bestCountFor(n: number): number {
  if (n < 3) return 0;
  if (n <= 4) return 1;
  if (n <= 6) return 2;
  if (n <= 8) return 3;
  if (n <= 11) return 4;
  if (n <= 14) return 5;
  if (n <= 16) return 6;
  if (n <= 18) return 7;
  return 8;
}

const MAX_ROUNDS_CONSIDERED = 20;

/**
 * Estimated handicap: the average of a player's best recent differentials
 * (score minus each course's rating basis), most recent rounds first.
 * Returns null when there isn't enough history yet (fewer than 3 rounds).
 */
export function computeHandicap(differentials: Differential[]): number | null {
  const recent = [...differentials]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, MAX_ROUNDS_CONSIDERED);

  const count = bestCountFor(recent.length);
  if (count === 0) return null;

  const best = [...recent].sort((a, b) => a.value - b.value).slice(0, count);
  const avg = best.reduce((sum, d) => sum + d.value, 0) / best.length;
  return Math.round(avg * 10) / 10;
}

/**
 * Converts each player's handicap into bonus strokes for a head-to-head
 * round: the lowest handicap in the group plays scratch (0 strokes), and
 * everyone else gets the gap to that player, rounded to a whole stroke.
 * Strokes are applied evenly to the round total rather than allocated to
 * specific holes (this app doesn't track a per-hole difficulty ranking).
 */
export function computeHandicapAllowances(
  handicaps: Record<string, number>,
): Record<string, number> {
  const values = Object.values(handicaps);
  if (values.length === 0) return {};
  const lowest = Math.min(...values);
  return Object.fromEntries(
    Object.entries(handicaps).map(([playerId, h]) => [playerId, Math.round(h - lowest)]),
  );
}

export function playerDifferentials(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): Differential[] {
  const out: Differential[] = [];
  for (const round of rounds) {
    if (round.teamAssignments) continue; // team rounds don't count toward handicap/rating
    const strokes = round.scores[playerId];
    const course = coursesById.get(round.courseId);
    if (!strokes || !course || strokes.length === 0) continue;
    if (strokes.some((s) => !Number.isFinite(s) || s <= 0)) continue;
    out.push({
      roundId: round.id,
      date: round.date,
      courseId: round.courseId,
      value: totalScore(strokes) - course.ratingBasis,
    });
  }
  return out;
}
