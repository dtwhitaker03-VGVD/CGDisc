import type { Course, Round } from "../types";
import { courseForRound } from "./roundCourse";

/** Under par on this many holes in a row is a hot streak (🔥). */
export const HOT_STREAK_MIN = 3;

const underPar = (strokes: number | undefined, par: number) =>
  strokes !== undefined && strokes > 0 && strokes < par;

/** How many holes in a row, counting back from `endIndex`, were under par. */
function runEndingAt(strokes: number[], holes: Course["holes"], endIndex: number): number {
  let run = 0;
  for (let i = endIndex; i >= 0 && underPar(strokes[i], holes[i]?.par ?? 0); i--) run++;
  return run;
}

/**
 * A player's hot streak while a round is being scored: the holes in a row
 * under par up to the hole they're on. Scores start at par, so a hole that
 * sits at par may just not be entered yet -- it keeps the streak from the
 * holes before it alive, and only a worse score ends it.
 */
export function liveHotStreak(
  strokes: number[] | undefined,
  holes: Course["holes"],
  activeHoleIndex: number,
): number {
  if (!strokes) return 0;
  const current = strokes[activeHoleIndex];
  const par = holes[activeHoleIndex]?.par ?? 0;
  if (underPar(current, par)) return runEndingAt(strokes, holes, activeHoleIndex);
  if (current !== undefined && current > par) return 0;
  return runEndingAt(strokes, holes, activeHoleIndex - 1);
}

export interface HotStreak {
  /** Holes under par in a row. */
  length: number;
  /** First and last hole numbers of the streak. */
  startHole: number;
  endHole: number;
  /** Strokes on each hole of the streak. */
  strokes: number[];
  courseId: string;
  roundId: string;
  date: string;
}

/**
 * A player's longest run of holes under par, across every round (par as
 * played that round). Ties go to the most recent. Scramble rounds are left
 * out (the team's score isn't the player's), as are holes recorded as 0.
 */
export function bestHotStreak(
  playerId: string,
  rounds: Round[],
  coursesById: Map<string, Course>,
): HotStreak | null {
  let best: HotStreak | null = null;
  for (const round of rounds) {
    if (round.teamGameType === "scramble") continue;
    const strokes = round.scores[playerId];
    const base = coursesById.get(round.courseId);
    if (!strokes || !base) continue;
    const holes = courseForRound(base, round).holes;
    let run = 0;
    for (let i = 0; i <= strokes.length; i++) {
      if (i < strokes.length && i < holes.length && underPar(strokes[i], holes[i].par)) {
        run++;
        continue;
      }
      if (run > 0 && (!best || run > best.length || (run === best.length && round.date > best.date))) {
        best = {
          length: run,
          startHole: holes[i - run].number,
          endHole: holes[i - 1].number,
          strokes: strokes.slice(i - run, i),
          courseId: round.courseId,
          roundId: round.id,
          date: round.date,
        };
      }
      run = 0;
    }
  }
  return best;
}
