import type { Round } from "../types";
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
