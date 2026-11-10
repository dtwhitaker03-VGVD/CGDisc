import type { Course, Round } from "../types";
import { scoreToPar } from "./ratings";
import { courseForRound } from "./roundCourse";
import { isIndividuallyScored, validRoundTotal } from "./stats";
import { teamResultsForRound, type TeamGameType } from "./teamStats";

export type IndividualRecordType = "straight" | "handicapped" | "bestBall" | "teamTotal";

export const INDIVIDUAL_RECORD_LABEL: Record<IndividualRecordType, string> = {
  straight: "Straight up",
  handicapped: "Handicapped (net)",
  bestBall: "Best ball rounds",
  teamTotal: "Team total rounds",
};

export const TEAM_RECORD_LABEL: Record<TeamGameType, string> = {
  scramble: "Scramble",
  bestBall: "Best ball",
  teamTotal: "Team total",
};

export interface RecordHolder {
  /** One player for an individual record, the whole team for a team record. */
  playerIds: string[];
  roundId: string;
  date: string;
}

export interface RecordEntry {
  /** What the record is compared on: strokes vs par (net vs par for handicapped). */
  rel: number;
  /** Strokes of the record round (gross for handicapped, with `net` alongside). */
  strokes: number;
  net?: number;
  /** Everyone who has set this exact mark (ties share it). */
  holders: RecordHolder[];
}

export interface CourseRecords {
  courseId: string;
  individual: Partial<Record<IndividualRecordType, RecordEntry>>;
  team: Partial<Record<TeamGameType, RecordEntry>>;
}

function consider(
  into: Partial<Record<string, RecordEntry>>,
  key: string,
  candidate: { rel: number; strokes: number; net?: number },
  holder: RecordHolder,
) {
  const current = into[key];
  if (!current || candidate.rel < current.rel) {
    into[key] = { ...candidate, holders: [holder] };
  } else if (candidate.rel === current.rel) {
    current.holders.push(holder);
  }
}

/**
 * Each course's records by individual and by team, split by round type.
 * Individuals: lowest score in straight rounds, lowest net in handicapped
 * rounds, and lowest individual score within best-ball and team-total
 * rounds. Teams: lowest team score per game type. Partial rounds (a player
 * who left early or joined late) don't count. Compared by score vs par so
 * rounds played with a moved basket stay fair.
 */
export function courseRecords(rounds: Round[], coursesById: Map<string, Course>): CourseRecords[] {
  const byCourse = new Map<string, CourseRecords>();
  const entryFor = (courseId: string) =>
    byCourse.get(courseId) ??
    byCourse.set(courseId, { courseId, individual: {}, team: {} }).get(courseId)!;

  for (const round of rounds) {
    const baseCourse = coursesById.get(round.courseId);
    if (!baseCourse) continue;
    const course = courseForRound(baseCourse, round);
    const rec = entryFor(round.courseId);

    if (isIndividuallyScored(round)) {
      const type: IndividualRecordType = round.teamAssignments
        ? (round.teamGameType as "bestBall" | "teamTotal")
        : round.handicapped
          ? "handicapped"
          : "straight";
      for (const pid of round.playerIds) {
        if (round.droppedPlayers?.[pid] !== undefined) continue;
        const strokes = round.scores[pid];
        const total = validRoundTotal(strokes);
        if (total === null) continue;
        const rel = scoreToPar(strokes, course);
        const holder = { playerIds: [pid], roundId: round.id, date: round.date };
        if (type === "handicapped") {
          const allowance = round.handicapAllowances?.[pid];
          if (allowance === undefined) continue;
          consider(rec.individual, type, { rel: rel - allowance, strokes: total, net: total - allowance }, holder);
        } else {
          consider(rec.individual, type, { rel, strokes: total }, holder);
        }
      }
    }

    const teams = teamResultsForRound(round, baseCourse);
    if (teams) {
      const gameType: TeamGameType = round.teamGameType ?? "teamTotal";
      for (const t of teams) {
        consider(
          rec.team,
          gameType,
          { rel: t.rel, strokes: t.strokes },
          { playerIds: t.playerIds, roundId: round.id, date: round.date },
        );
      }
    }
  }

  return [...byCourse.values()]
    .filter((r) => Object.keys(r.individual).length > 0 || Object.keys(r.team).length > 0)
    .sort((a, b) =>
      (coursesById.get(a.courseId)?.name ?? "").localeCompare(coursesById.get(b.courseId)?.name ?? ""),
    );
}
