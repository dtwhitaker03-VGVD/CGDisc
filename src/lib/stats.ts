import type { Course, Round } from "../types";
import { scoreToPar, totalScore } from "./ratings";

export interface ScoreStats {
  rounds: number;
  low: number;
  high: number;
  average: number;
}

export function validRoundTotal(strokes: number[] | undefined): number | null {
  if (!strokes || strokes.length === 0) return null;
  if (strokes.some((s) => !Number.isFinite(s) || s <= 0)) return null;
  return totalScore(strokes);
}

/** A round whose individual player scores are a personal result worth
 * attributing to them -- true for straight/handicapped rounds and for
 * bestBall/teamTotal team rounds, false for scramble (and legacy team
 * rounds with no recorded game type), where the whole team shares one
 * score. Mirrors playerDifferentials' handicap/rating exclusion. */
function isIndividuallyScored(round: Round): boolean {
  if (!round.teamAssignments) return true;
  return round.teamGameType === "bestBall" || round.teamGameType === "teamTotal";
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
      if (round.droppedPlayers?.[playerId] !== undefined) continue;
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
    if (round.droppedPlayers?.[playerId] !== undefined) continue;
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

export interface CourseScoreEntry {
  playerId: string;
  roundId: string;
  date: string;
  total: number;
}

/**
 * The best (lowest) individual round totals ever recorded at a course,
 * across every player, best first. Excludes scramble rounds (the whole
 * team shares one score, not a personal result) and rounds a player left
 * early (a partial round isn't a fair comparison against a full one).
 */
export function courseTopScores(
  courseId: string,
  rounds: Round[],
  limit = 5,
): CourseScoreEntry[] {
  const entries: CourseScoreEntry[] = [];
  for (const round of rounds) {
    if (round.courseId !== courseId || !isIndividuallyScored(round)) continue;
    for (const playerId of round.playerIds) {
      if (round.droppedPlayers?.[playerId] !== undefined) continue;
      const total = validRoundTotal(round.scores[playerId]);
      if (total === null) continue;
      entries.push({ playerId, roundId: round.id, date: round.date, total });
    }
  }
  return entries.sort((a, b) => a.total - b.total).slice(0, limit);
}

export interface CourseRelStat {
  courseId: string;
  avgRelToPar: number;
  roundsPlayed: number;
}

/**
 * A player's average score relative to par at each course they've played,
 * best (most negative) first. Excludes scramble rounds, same reasoning as
 * courseTopScores. Unlike raw totals, relative-to-par is comparable even
 * for a round a player left early (scoreToPar is given the holes they
 * actually played), so those still count here.
 */
export function playerCourseRelToPar(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): CourseRelStat[] {
  const byCourse = new Map<string, { sum: number; count: number }>();
  for (const round of rounds) {
    if (!isIndividuallyScored(round)) continue;
    const strokes = round.scores[playerId];
    const course = coursesById.get(round.courseId);
    if (!course || validRoundTotal(strokes) === null) continue;
    const rel = scoreToPar(strokes!, course, round.droppedPlayers?.[playerId]);
    const entry = byCourse.get(round.courseId) ?? { sum: 0, count: 0 };
    entry.sum += rel;
    entry.count += 1;
    byCourse.set(round.courseId, entry);
  }
  return [...byCourse.entries()]
    .map(([courseId, { sum, count }]) => ({
      courseId,
      avgRelToPar: Math.round((sum / count) * 10) / 10,
      roundsPlayed: count,
    }))
    .sort((a, b) => a.avgRelToPar - b.avgRelToPar);
}

export interface HoleRelStat {
  courseId: string;
  holeNumber: number;
  par: number;
  distanceFt?: number;
  avgRelToPar: number;
  roundsPlayed: number;
}

/** A hole needs at least this many recorded rounds before it can count as
 * a player's best/worst hole at a course -- otherwise a single lucky (or
 * unlucky) throw on an otherwise-unplayed hole would misleadingly win the
 * title. */
const MIN_ROUNDS_FOR_HOLE_SUPERLATIVE = 3;

interface HoleAggregate {
  courseId: string;
  holeIndex: number;
  sum: number;
  count: number;
}

/** Every hole (course + hole number) a player has ever recorded a score
 * on, with the running total and count needed to average them. */
function aggregatePlayerHoles(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): Map<string, HoleAggregate> {
  const byHole = new Map<string, HoleAggregate>();
  for (const round of rounds) {
    const strokes = round.scores[playerId];
    const course = coursesById.get(round.courseId);
    if (!course || !strokes) continue;
    strokes.forEach((s, i) => {
      if (!Number.isFinite(s) || s <= 0) return;
      const hole = course.holes[i];
      if (!hole) return;
      const key = `${round.courseId}#${i}`;
      const entry = byHole.get(key) ?? { courseId: round.courseId, holeIndex: i, sum: 0, count: 0 };
      entry.sum += s - hole.par;
      entry.count += 1;
      byHole.set(key, entry);
    });
  }
  return byHole;
}

/** Picks one hole per course out of the aggregates, per isBetter (true
 * when candidate should replace current), requiring at least
 * MIN_ROUNDS_FOR_HOLE_SUPERLATIVE recorded rounds to qualify. */
function pickHolePerCourse(
  byHole: Map<string, HoleAggregate>,
  coursesById: Map<string, Course>,
  isBetter: (candidate: HoleRelStat, current: HoleRelStat) => boolean,
): Map<string, HoleRelStat> {
  const pickedByCourse = new Map<string, HoleRelStat>();
  for (const { courseId, holeIndex, sum, count } of byHole.values()) {
    if (count < MIN_ROUNDS_FOR_HOLE_SUPERLATIVE) continue;
    const course = coursesById.get(courseId);
    const hole = course?.holes[holeIndex];
    if (!course || !hole) continue;
    const candidate: HoleRelStat = {
      courseId,
      holeNumber: hole.number,
      par: hole.par,
      distanceFt: hole.distanceFt,
      avgRelToPar: Math.round((sum / count) * 10) / 10,
      roundsPlayed: count,
    };
    const current = pickedByCourse.get(courseId);
    if (!current || isBetter(candidate, current)) pickedByCourse.set(courseId, candidate);
  }
  return pickedByCourse;
}

/** Ties are broken by the longer hole, since that's the more impressive
 * result in either direction (best or worst). */
function longerHoleWinsTie(candidate: HoleRelStat, current: HoleRelStat): boolean {
  return (candidate.distanceFt ?? -1) > (current.distanceFt ?? -1);
}

/**
 * For each course a player has played, the single hole they've scored
 * best on average, relative to par, across every round they've played it
 * there -- including scramble (same precedent as the ace/birdie/etc.
 * counts: a hole is a hole) and rounds left early (every hole actually
 * played is real). Only holes with at least MIN_ROUNDS_FOR_HOLE_SUPERLATIVE
 * recorded scores qualify.
 */
export function playerBestHolesByCourse(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): Map<string, HoleRelStat> {
  const byHole = aggregatePlayerHoles(playerId, rounds, coursesById);
  return pickHolePerCourse(
    byHole,
    coursesById,
    (candidate, current) =>
      candidate.avgRelToPar < current.avgRelToPar ||
      (candidate.avgRelToPar === current.avgRelToPar && longerHoleWinsTie(candidate, current)),
  );
}

/** Same as playerBestHolesByCourse, but the hole they've scored worst on
 * average instead. */
export function playerWorstHolesByCourse(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): Map<string, HoleRelStat> {
  const byHole = aggregatePlayerHoles(playerId, rounds, coursesById);
  return pickHolePerCourse(
    byHole,
    coursesById,
    (candidate, current) =>
      candidate.avgRelToPar > current.avgRelToPar ||
      (candidate.avgRelToPar === current.avgRelToPar && longerHoleWinsTie(candidate, current)),
  );
}
