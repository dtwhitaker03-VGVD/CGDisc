import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { teamMatchups, teamRecords, type Matchup, type TeamMatchGame } from "../lib/teamStats";
import { Card } from "./ui";

const rel = (v: number) => (v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`);

const GAME_LABEL = { scramble: "Scramble", bestBall: "Best ball", teamTotal: "Team total" } as const;

/** Team-vs-team running records, for the Stats page. */
export function TeamStats() {
  const { rounds, coursesById, playersById } = useAppData();
  const matchups = teamMatchups(rounds, coursesById);

  const teamName = (ids: string[]) => {
    const names = ids.map((id) => playersById.get(id)?.name ?? "Someone");
    return names.length <= 2
      ? names.join(" & ")
      : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
  };

  if (matchups.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-500">
          Play a team round to start tracking team vs. team records here.
        </p>
      </Card>
    );
  }

  const records = teamRecords(matchups);

  return (
    <div className="space-y-2">
      {matchups.map((m) => (
        <MatchupCard key={`${m.keyA}#${m.keyB}`} matchup={m} teamName={teamName} />
      ))}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
          Overall team records
        </p>
        <ul className="divide-y divide-slate-100">
          {records.map((t) => (
            <li key={t.key} className="flex items-center justify-between py-1.5 text-sm">
              <span className="font-medium text-slate-800">{teamName(t.playerIds)}</span>
              <span className="tabular-nums text-slate-600">
                <span className="font-semibold text-slate-900">
                  {t.wins}-{t.losses}-{t.ties}
                </span>
                <span className="text-[11px] text-slate-400">
                  {" "}
                  · {t.wins + t.losses + t.ties} {t.wins + t.losses + t.ties === 1 ? "match" : "matches"}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-400 mt-1">W-L-T against every team they've faced.</p>
      </Card>
    </div>
  );
}

function MatchupCard({
  matchup: m,
  teamName,
}: {
  matchup: Matchup;
  teamName: (ids: string[]) => string;
}) {
  const { coursesById } = useAppData();
  // Leader on top; a dead heat keeps the stored order.
  const flip = m.bWins > m.aWins;
  const top = flip
    ? { ids: m.playerIdsB, wins: m.bWins, side: "b" as const }
    : { ids: m.playerIdsA, wins: m.aWins, side: "a" as const };
  const bottom = flip
    ? { ids: m.playerIdsA, wins: m.aWins, side: "a" as const }
    : { ids: m.playerIdsB, wins: m.bWins, side: "b" as const };
  const lead = top.wins === bottom.wins ? null : top.side;
  const games = m.games.length;

  return (
    <Card>
      <div className="space-y-1">
        {[top, bottom].map((t) => (
          <div key={t.side} className="flex items-center justify-between gap-3">
            <span
              className={`text-sm ${lead === t.side ? "font-semibold text-slate-900" : "text-slate-600"}`}
            >
              {teamName(t.ids)}
            </span>
            <span
              className={`text-xl font-bold tabular-nums ${lead === t.side ? "text-green-600" : "text-slate-900"}`}
            >
              {t.wins}
            </span>
          </div>
        ))}
        {m.ties > 0 && (
          <div className="flex items-center justify-between gap-3 text-sm text-slate-400">
            <span>Tied</span>
            <span className="tabular-nums font-semibold">{m.ties}</span>
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-400 mt-2">
        {games} {games === 1 ? "match" : "matches"} · last played {m.games[0].date}
      </p>

      <details className="mt-1.5">
        <summary className="text-sm font-medium text-green-700 cursor-pointer">Match history</summary>
        <ul className="divide-y divide-slate-100 mt-1">
          {m.games.map((g) => (
            <li key={g.roundId}>
              <Link to={`/round/${g.roundId}`} className="block py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">
                    {resultText(g, teamName)}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">{g.date}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {coursesById.get(g.courseId)?.name ?? "Course"} · {GAME_LABEL[g.gameType]}
                  {g.method === "holes" ? " · By holes" : ""} · {scoreText(g, top.side)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function resultText(g: TeamMatchGame, teamName: (ids: string[]) => string) {
  if (g.winner === "tie") return "Tied";
  return `${teamName((g.winner === "a" ? g.a : g.b).playerIds)} won`;
}

/** Scores with the winner first (the card's leading team first on a tie). */
function scoreText(g: TeamMatchGame, topSide: "a" | "b") {
  const first = g.winner === "tie" ? topSide : g.winner;
  const [x, y] = first === "a" ? [g.a, g.b] : [g.b, g.a];
  return g.method === "holes"
    ? `${x.holesWon}–${y.holesWon} holes`
    : `${x.strokes} (${rel(x.rel)}) – ${y.strokes} (${rel(y.rel)})`;
}
