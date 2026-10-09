import type { Course, Round } from "../types";
import { totalScore } from "./ratings";

export interface ScoreStats {
  rounds: number;
  low: number;
  high: number;
  average: number;
}

function validRoundTotal(strokes: number[] | undefined): number | null {
  if (!strokes || strokes.length === 0) return null;
  if (strokes.some((s) => !Number.isFinite(s) || s <= 0)) return null;
  return totalScore(strokes);
}

export function computeScoreStats(totals: number[]): ScoreStats | null {
  if (totals.length === 0) return null;
  const sum = totals.reduce((s, v) => s + v, 0);
  return {
    rounds: totals.length,
    low: Math.min(...totals),
    high: Math.max(...totals),
    average: Math.round((sum / totals.length) * 10) / 10,
  };
}

/** Every player's score totals at a course, grouped by player id. */
export function courseTotalsByPlayer(courseId: string, rounds: Round[]): Map<string, number[]> {
  const byPlayer = new Map<string, number[]>();
  for (const round of rounds) {
    if (round.courseId !== courseId) continue;
    for (const playerId of round.playerIds) {
      const total = validRoundTotal(round.scores[playerId]);
      if (total === null) continue;
      const list = byPlayer.get(playerId) ?? [];
      list.push(total);
      byPlayer.set(playerId, list);
    }
  }
  return byPlayer;
}

/** A single player's score totals at each course, grouped by course id. */
export function playerTotalsByCourse(playerId: string, rounds: Round[]): Map<string, number[]> {
  const byCourse = new Map<string, number[]>();
  for (const round of rounds) {
    const total = validRoundTotal(round.scores[playerId]);
    if (total === null) continue;
    const list = byCourse.get(round.courseId) ?? [];
    list.push(total);
    byCourse.set(round.courseId, list);
  }
  return byCourse;
}

export interface HoleCounts {
  holesPlayed: number;
  aces: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  triplePlusBogeys: number;
}

function emptyHoleCounts(): HoleCounts {
  return {
    holesPlayed: 0,
    aces: 0,
    birdies: 0,
    pars: 0,
    bogeys: 0,
    doubleBogeys: 0,
    triplePlusBogeys: 0,
  };
}

/**
 * Classifies one hole's score relative to par and tallies it into counts.
 * A score of 1 is always an ace, regardless of par. Anything 2-or-more
 * under par that isn't an ace (an eagle or better) is counted as a birdie --
 * there's no separate eagle bucket, since they're rare enough on a casual
 * group's courses not to warrant their own category.
 */
function classifyHole(strokes: number, par: number, counts: HoleCounts): void {
  counts.holesPlayed += 1;
  if (strokes === 1) {
    counts.aces += 1;
    return;
  }
  const diff = strokes - par;
  if (diff <= -1) counts.birdies += 1;
  else if (diff === 0) counts.pars += 1;
  else if (diff === 1) counts.bogeys += 1;
  else if (diff === 2) counts.doubleBogeys += 1;
  else counts.triplePlusBogeys += 1;
}

function accumulateHoleCounts(strokes: number[], holes: Course["holes"], counts: HoleCounts): void {
  strokes.forEach((s, i) => {
    const hole = holes[i];
    if (hole) classifyHole(s, hole.par, counts);
  });
}

/** A player's lifetime hole-score counts (aces/birdies/pars/...) across every round. */
export function playerHoleCounts(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): HoleCounts {
  const counts = emptyHoleCounts();
  for (const round of rounds) {
    const strokes = round.scores[playerId];
    const course = coursesById.get(round.courseId);
    if (!course || validRoundTotal(strokes) === null) continue;
    accumulateHoleCounts(strokes!, course.holes, counts);
  }
  return counts;
}

/** A single player's hole-score counts at each course, grouped by course id. */
export function playerHoleCountsByCourse(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): Map<string, HoleCounts> {
  const byCourse = new Map<string, HoleCounts>();
  for (const round of rounds) {
    const strokes = round.scores[playerId];
    const course = coursesById.get(round.courseId);
    if (!course || validRoundTotal(strokes) === null) continue;
    const counts = byCourse.get(round.courseId) ?? emptyHoleCounts();
    accumulateHoleCounts(strokes!, course.holes, counts);
    byCourse.set(round.courseId, counts);
  }
  return byCourse;
}
