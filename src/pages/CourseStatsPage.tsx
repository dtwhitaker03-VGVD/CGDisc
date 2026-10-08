import { Link, useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { coursePar } from "../lib/ratings";
import { computeScoreStats, courseTotalsByPlayer } from "../lib/stats";
import { Card, PageHeader } from "../components/ui";
import type { Player } from "../types";

function relToPar(total: number, par: number): string {
  const rel = total - par;
  return rel === 0 ? "E" : rel > 0 ? `+${rel}` : `${rel}`;
}

export function CourseStatsPage() {
  const { id } = useParams();
  const { courses, players, rounds } = useAppData();
  const course = courses.find((c) => c.id === id);

  if (!course) {
    return (
      <div>
        <PageHeader title="Course not found" />
      </div>
    );
  }

  const par = coursePar(course);
  const totalsByPlayer = courseTotalsByPlayer(course.id, rounds);
  const overall = computeScoreStats([...totalsByPlayer.values()].flat());

  const playerRows = [...totalsByPlayer.entries()]
    .map(([playerId, totals]) => {
      const player = players.find((p) => p.id === playerId);
      const stats = computeScoreStats(totals);
      if (!player || !stats) return null;
      return { player, stats };
    })
    .filter((row): row is { player: Player; stats: NonNullable<typeof overall> } => Boolean(row))
    .sort((a, b) => a.stats.average - b.stats.average);

  return (
    <div>
      <PageHeader title={course.name} subtitle={`${course.holes.length} holes · par ${par}`} />

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Course record
        </p>
        {overall ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-slate-400">Low</p>
                <p className="text-xl font-bold text-green-600 tabular-nums">{overall.low}</p>
                <p className="text-xs text-slate-400">{relToPar(overall.low, par)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Average</p>
                <p className="text-xl font-bold text-amber-600 tabular-nums">{overall.average}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">High</p>
                <p className="text-xl font-bold text-red-600 tabular-nums">{overall.high}</p>
                <p className="text-xs text-slate-400">{relToPar(overall.high, par)}</p>
              </div>
            </div>
            <p className="text-center text-[11px] text-slate-400 mt-2">
              {overall.rounds} rounds logged
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">No rounds logged here yet.</p>
        )}
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          By player (low / avg / high)
        </p>
        {playerRows.length === 0 ? (
          <p className="text-sm text-slate-500">No rounds logged here yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {playerRows.map(({ player, stats }) => (
              <li key={player.id}>
                <Link
                  to={`/stats/${player.id}`}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: player.color }}
                    />
                    <span className="font-medium text-slate-800 text-sm">{player.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums">
                      <span className="text-green-600 font-semibold">{stats.low}</span>
                      {" / "}
                      <span className="text-amber-600 font-semibold">{stats.average}</span>
                      {" / "}
                      <span className="text-red-600 font-semibold">{stats.high}</span>
                    </p>
                    <p className="text-[11px] text-slate-400">{stats.rounds} rounds</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
