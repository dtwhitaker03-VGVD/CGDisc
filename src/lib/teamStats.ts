import type { Course, Round } from "../types";
import { coursePar, totalScore } from "./ratings";
import { courseForRound } from "./roundCourse";
import { computeHoleWins, teamPerHoleScores } from "./matchplay";

/** One team's result in one team round. A team is identified by who is on it. */
export interface TeamResult {
  /** Sorted player ids -- the team's identity, the same across rounds. */
  playerIds: string[];
  key: string;
  /** The team's score by the round's game type (shared, best ball, or total). */
  strokes: number;
  /** Strokes relative to par (par is scaled by team size for team total). */
  rel: number;
  /** Holes won, for match-play ("by holes") rounds. */
  holesWon: number;
}

export type TeamGameType = "scramble" | "bestBall" | "teamTotal";

export interface TeamMatchGame {
  roundId: string;
  date: string;
  createdAt: string;
  courseId: string;
  gameType: TeamGameType;
  method: "strokes" | "holes";
  /** The two sides, in the matchup's fixed order (a, b). */
  a: TeamResult;
  b: TeamResult;
  /** Who won: side a, side b, or neither. */
  winner: "a" | "b" | "tie";
}

/** Every time two particular teams have played each other. */
export interface Matchup {
  keyA: string;
  keyB: string;
  playerIdsA: string[];
  playerIdsB: string[];
  aWins: number;
  bWins: number;
  ties: number;
  /** Newest first. */
  games: TeamMatchGame[];
}

export interface TeamRecord {
  key: string;
  playerIds: string[];
  wins: number;
  losses: number;
  ties: number;
}

const teamKey = (ids: string[]) => ids.join("|");

/**
 * The teams in a finished team round with their results, or null when it
 * isn't a (complete) team round: no team assignments, fewer than two teams,
 * or a member's scores missing/unfinished.
 */
export function teamResultsForRound(round: Round, course: Course): TeamResult[] | null {
  if (!round.teamAssignments) return null;
  const played = courseForRound(course, round);
  const n = played.holes.length;
  // Legacy team rounds (no recorded game type) were scored as team total.
  const gameType: TeamGameType = round.teamGameType ?? "teamTotal";

  const byTeam = new Map<number, string[]>();
  for (const pid of round.playerIds) {
    const t = round.teamAssignments[pid];
    if (t === undefined) continue;
    (byTeam.get(t) ?? byTeam.set(t, []).get(t)!).push(pid);
  }
  if (byTeam.size < 2) return null;

  const teams: { ids: string[]; strokes: number; perHole: (number | undefined)[] }[] = [];
  for (const [, members] of [...byTeam.entries()].sort((x, y) => x[0] - y[0])) {
    for (const pid of members) {
      const s = round.scores[pid];
      if (!s || s.length !== n || s.some((v) => !Number.isFinite(v) || v <= 0)) return null;
    }
    const ids = [...members].sort();
    let strokes: number;
    if (gameType === "scramble") {
      strokes = totalScore(round.scores[ids[0]]);
    } else if (gameType === "bestBall") {
      strokes = played.holes.reduce(
        (sum, _h, i) => sum + Math.min(...ids.map((pid) => round.scores[pid][i])),
        0,
      );
    } else {
      strokes = ids.reduce((sum, pid) => sum + totalScore(round.scores[pid]), 0);
    }
    teams.push({ ids, strokes, perHole: teamPerHoleScores(gameType, ids, round.scores, n) });
  }

  const wins = computeHoleWins(
    n,
    teams.map((t) => ({ id: teamKey(t.ids), perHoleScores: t.perHole })),
  );
  const par = coursePar(played);
  return teams.map((t) => ({
    playerIds: t.ids,
    key: teamKey(t.ids),
    strokes: t.strokes,
    rel: t.strokes - par * (gameType === "teamTotal" ? t.ids.length : 1),
    holesWon: wins[teamKey(t.ids)].holesWon,
  }));
}

/** Head-to-head history for every pair of teams that has played each other. */
export function teamMatchups(rounds: Round[], coursesById: Map<string, Course>): Matchup[] {
  const byPair = new Map<string, Matchup>();
  for (const round of rounds) {
    const course = coursesById.get(round.courseId);
    if (!course) continue;
    const teams = teamResultsForRound(round, course);
    if (!teams) continue;
    const method = round.scoringMethod === "holes" && round.teamGameType !== "scramble" ? "holes" : "strokes";
    const gameType: TeamGameType = round.teamGameType ?? "teamTotal";
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        // Fixed order per pair so the same two teams always land in one matchup.
        const [x, y] = teams[i].key <= teams[j].key ? [teams[i], teams[j]] : [teams[j], teams[i]];
        const pairKey = `${x.key}#${y.key}`;
        const m =
          byPair.get(pairKey) ??
          {
            keyA: x.key,
            keyB: y.key,
            playerIdsA: x.playerIds,
            playerIdsB: y.playerIds,
            aWins: 0,
            bWins: 0,
            ties: 0,
            games: [],
          };
        // Match play: most holes wins. Otherwise: lowest score vs par wins.
        const diff = method === "holes" ? y.holesWon - x.holesWon : x.rel - y.rel;
        const winner = diff < 0 ? "a" : diff > 0 ? "b" : "tie";
        if (winner === "a") m.aWins += 1;
        else if (winner === "b") m.bWins += 1;
        else m.ties += 1;
        m.games.push({
          roundId: round.id,
          date: round.date,
          createdAt: round.createdAt,
          courseId: round.courseId,
          gameType,
          method,
          a: x,
          b: y,
          winner,
        });
        byPair.set(pairKey, m);
      }
    }
  }
  const out = [...byPair.values()];
  for (const m of out) {
    m.games.sort((p, q) =>
      p.date === q.date ? (p.createdAt < q.createdAt ? 1 : -1) : p.date < q.date ? 1 : -1,
    );
  }
  // Most recently played matchup first.
  return out.sort((p, q) => (p.games[0].date < q.games[0].date ? 1 : -1));
}

/** Each team's overall record against everyone it has faced. */
export function teamRecords(matchups: Matchup[]): TeamRecord[] {
  const byTeam = new Map<string, TeamRecord>();
  const rec = (key: string, ids: string[]) =>
    byTeam.get(key) ?? byTeam.set(key, { key, playerIds: ids, wins: 0, losses: 0, ties: 0 }).get(key)!;
  for (const m of matchups) {
    const a = rec(m.keyA, m.playerIdsA);
    const b = rec(m.keyB, m.playerIdsB);
    a.wins += m.aWins;
    a.losses += m.bWins;
    a.ties += m.ties;
    b.wins += m.bWins;
    b.losses += m.aWins;
    b.ties += m.ties;
  }
  return [...byTeam.values()].sort((p, q) => {
    const gp = p.wins + p.losses + p.ties;
    const gq = q.wins + q.losses + q.ties;
    const wp = gp ? (p.wins + p.ties / 2) / gp : 0;
    const wq = gq ? (q.wins + q.ties / 2) / gq : 0;
    return wq - wp || gq - gp;
  });
}

/** First word of a name: "David Whitaker" -> "David". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** A team's label by first names, e.g. David and Shea -> "David Shea". */
export function teamLabel(
  playerIds: string[],
  playersById: Map<string, { name: string }>,
): string {
  return playerIds.map((id) => firstName(playersById.get(id)?.name ?? "Someone")).join(" ");
}

/** One game from a single team's point of view. */
export interface TeamGame {
  roundId: string;
  date: string;
  createdAt: string;
  courseId: string;
  gameType: TeamGameType;
  method: "strokes" | "holes";
  mine: TeamResult;
  theirs: TeamResult;
  outcome: "win" | "loss" | "tie";
}

export interface TeamVsOpponent {
  opponentKey: string;
  opponentIds: string[];
  wins: number;
  losses: number;
  ties: number;
  /** Newest first. */
  games: TeamGame[];
}

export interface TeamCourseStat {
  courseId: string;
  wins: number;
  losses: number;
  ties: number;
  games: number;
  /** This team's best (lowest vs par) score at the course for each game type. */
  best: Partial<Record<TeamGameType, { strokes: number; rel: number }>>;
}

export interface TeamView {
  wins: number;
  losses: number;
  ties: number;
  vs: TeamVsOpponent[];
  byCourse: TeamCourseStat[];
}

/** Everything about one team: record, record per course, and record against each opponent. */
export function teamView(teamKeyValue: string, matchups: Matchup[]): TeamView {
  const vs: TeamVsOpponent[] = [];
  const byCourse = new Map<string, TeamCourseStat>();
  const view: TeamView = { wins: 0, losses: 0, ties: 0, vs, byCourse: [] };

  for (const m of matchups) {
    if (m.keyA !== teamKeyValue && m.keyB !== teamKeyValue) continue;
    const iAmA = m.keyA === teamKeyValue;
    const opp: TeamVsOpponent = {
      opponentKey: iAmA ? m.keyB : m.keyA,
      opponentIds: iAmA ? m.playerIdsB : m.playerIdsA,
      wins: iAmA ? m.aWins : m.bWins,
      losses: iAmA ? m.bWins : m.aWins,
      ties: m.ties,
      games: m.games.map((g) => {
        const mine = iAmA ? g.a : g.b;
        const theirs = iAmA ? g.b : g.a;
        const outcome =
          g.winner === "tie" ? "tie" : (g.winner === "a") === iAmA ? "win" : "loss";
        return {
          roundId: g.roundId,
          date: g.date,
          createdAt: g.createdAt,
          courseId: g.courseId,
          gameType: g.gameType,
          method: g.method,
          mine,
          theirs,
          outcome,
        } satisfies TeamGame;
      }),
    };
    vs.push(opp);
    view.wins += opp.wins;
    view.losses += opp.losses;
    view.ties += opp.ties;

    for (const g of opp.games) {
      const c =
        byCourse.get(g.courseId) ??
        byCourse
          .set(g.courseId, { courseId: g.courseId, wins: 0, losses: 0, ties: 0, games: 0, best: {} })
          .get(g.courseId)!;
      c.games += 1;
      if (g.outcome === "win") c.wins += 1;
      else if (g.outcome === "loss") c.losses += 1;
      else c.ties += 1;
      const best = c.best[g.gameType];
      if (!best || g.mine.rel < best.rel) {
        c.best[g.gameType] = { strokes: g.mine.strokes, rel: g.mine.rel };
      }
    }
  }

  view.byCourse = [...byCourse.values()];
  // Most-played opponents first, then the most recently met.
  view.vs.sort(
    (p, q) => q.games.length - p.games.length || (p.games[0].date < q.games[0].date ? 1 : -1),
  );
  return view;
}
