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

export interface AceEntry {
  /** The player who aced it, or the whole team for a scramble ace. */
  playerIds: string[];
  roundId: string;
  courseId: string;
  holeNumber: number;
  date: string;
}

/**
 * Every hole-in-one (a score of 1) across all rounds, newest first. In a
 * scramble the team shares one ball, so a scramble ace is listed once for
 * the whole team rather than once per teammate.
 */
export function allAces(rounds: Round[], coursesById: Map<string, Course>): AceEntry[] {
  const aces: (AceEntry & { createdAt: string; order: number })[] = [];
  for (const round of rounds) {
    const course = coursesById.get(round.courseId);
    const scramble = !!round.teamAssignments && !isIndividuallyScored(round);
    const groups: string[][] = [];
    if (scramble) {
      const byTeam = new Map<number, string[]>();
      for (const pid of round.playerIds) {
        const t = round.teamAssignments![pid];
        if (t === undefined) continue;
        (byTeam.get(t) ?? byTeam.set(t, []).get(t)!).push(pid);
      }
      groups.push(...[...byTeam.entries()].sort((a, b) => a[0] - b[0]).map(([, ids]) => ids));
    } else {
      groups.push(...round.playerIds.map((pid) => [pid]));
    }
    for (const ids of groups) {
      const strokes = ids.map((pid) => round.scores[pid]).find((s) => s && s.length > 0);
      strokes?.forEach((s, i) => {
        if (s !== 1) return;
        aces.push({
          playerIds: ids,
          roundId: round.id,
          courseId: round.courseId,
          holeNumber: course?.holes[i]?.number ?? i + 1,
          date: round.date,
          createdAt: round.createdAt,
          order: i,
        });
      });
    }
  }
  return aces
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || a.order - b.order,
    )
    .map(({ createdAt: _c, order: _o, ...ace }) => ace);
}
