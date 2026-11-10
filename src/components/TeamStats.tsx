import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import {
  teamLabel,
  teamView,
  type Matchup,
  type TeamGame,
  type TeamGameType,
  type TeamVsOpponent,
} from "../lib/teamStats";
import { Card } from "./ui";

const rel = (v: number) => (v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`);

const GAME_LABEL: Record<TeamGameType, string> = {
  scramble: "Scramble",
  bestBall: "Best ball",
  teamTotal: "Team total",
};

const OUTCOME = {
  win: { text: "Won", color: "text-green-600" },
  loss: { text: "Lost", color: "text-red-600" },
  tie: { text: "Tied", color: "text-slate-500" },
} as const;

function Record({ w, l, t }: { w: number; l: number; t: number }) {
  const color = w > l ? "text-green-600" : w < l ? "text-red-600" : "text-slate-900";
  return (
    <span className={`font-bold tabular-nums ${color}`}>
      {w}-{l}-{t}
    </span>
  );
}

/** One team's stats: overall record, by course, and against each opponent it has played. */
export function TeamStatsView({ teamKey, matchups }: { teamKey: string; matchups: Matchup[] }) {
  const { coursesById, playersById } = useAppData();
  const view = teamView(teamKey, matchups);
  const games = view.wins + view.losses + view.ties;
  const label = (ids: string[]) => teamLabel(ids, playersById);

  return (
    <div className="space-y-3">
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">Record (W-L-T)</p>
          <p className="text-2xl">
            <Record w={view.wins} l={view.losses} t={view.ties} />
          </p>
        </div>
        <p className="text-sm text-slate-400">
          {games} {games === 1 ? "game" : "games"}
        </p>
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
          By course
        </p>
        <ul className="divide-y divide-slate-100">
          {view.byCourse.map((c) => {
            const best = (Object.keys(GAME_LABEL) as TeamGameType[])
              .filter((t) => c.best[t])
              .map((t) => `${GAME_LABEL[t]} ${rel(c.best[t]!.rel)} (${c.best[t]!.strokes})`);
            return (
              <li key={c.courseId} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800 text-sm">
                    {coursesById.get(c.courseId)?.name ?? "Course"}
                  </span>
                  <span className="text-sm">
                    <Record w={c.wins} l={c.losses} t={c.ties} />
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {c.games} {c.games === 1 ? "game" : "games"}
                  {best.length > 0 && ` · Best: ${best.join(" · ")}`}
                </p>
              </li>
            );
          })}
        </ul>
      </Card>

      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 pt-1">
        Versus other teams
      </p>
      {view.vs.map((o) => (
        <OpponentCard key={o.opponentKey} opponent={o} label={label} />
      ))}
    </div>
  );
}

function OpponentCard({
  opponent: o,
  label,
}: {
  opponent: TeamVsOpponent;
  label: (ids: string[]) => string;
}) {
  const { coursesById } = useAppData();
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-800">vs {label(o.opponentIds)}</span>
        <span className="text-xl">
          <Record w={o.wins} l={o.losses} t={o.ties} />
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mt-0.5">
        {o.games.length} {o.games.length === 1 ? "game" : "games"} · last played {o.games[0].date}
      </p>
      <details className="mt-1.5">
        <summary className="text-sm font-medium text-green-700 cursor-pointer">Match history</summary>
        <ul className="divide-y divide-slate-100 mt-1">
          {o.games.map((g) => (
            <li key={g.roundId}>
              <Link to={`/round/${g.roundId}`} className="block py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-sm font-semibold ${OUTCOME[g.outcome].color}`}>
                    {OUTCOME[g.outcome].text}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">{g.date}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {coursesById.get(g.courseId)?.name ?? "Course"} · {GAME_LABEL[g.gameType]}
                  {g.method === "holes" ? " · By holes" : ""} · {scoreText(g)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

/** This team's score first, then the opponent's. */
function scoreText(g: TeamGame) {
  return g.method === "holes"
    ? `${g.mine.holesWon}–${g.theirs.holesWon} holes`
    : `${g.mine.strokes} (${rel(g.mine.rel)}) – ${g.theirs.strokes} (${rel(g.theirs.rel)})`;
}
