import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { coursePar } from "../lib/ratings";
import {
  computeScoreStats,
  courseHoleAverages,
  courseTopScores,
  courseTotalsByPlayer,
  rankCourseHoleHandicaps,
} from "../lib/stats";
import { Button, Card, PageHeader } from "../components/ui";
import type { Player } from "../types";

function relToPar(total: number, par: number): string {
  const rel = total - par;
  return rel === 0 ? "E" : rel > 0 ? `+${rel}` : `${rel}`;
}

export function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { courses, players, playersById, rounds, deleteCourse } = useAppData();
  const course = courses.find((c) => c.id === id);

  if (!course) {
    return (
      <div>
        <PageHeader title="Course not found" />
      </div>
    );
  }

  const par = coursePar(course);
  const hasAnyDistance = course.holes.some((h) => h.distanceFt);
  const totalDistance = course.holes.reduce((s, h) => s + (h.distanceFt ?? 0), 0);
  const holeHandicaps = rankCourseHoleHandicaps(courseHoleAverages(course, rounds));

  const totalsByPlayer = courseTotalsByPlayer(course.id, rounds);
  const overall = computeScoreStats([...totalsByPlayer.values()].flat());

  // The record and top 5 only count individually-scored rounds (not
  // scramble, where the whole team shares one score) -- see courseTopScores.
  const topScores = courseTopScores(course.id, rounds, 5);
  const recordEntry = topScores[0];
  const recordHolderNames = recordEntry
    ? [...new Set(topScores.filter((e) => e.total === recordEntry.total).map((e) => e.playerId))]
        .map((pid) => playersById.get(pid)?.name)
        .filter((name): name is string => Boolean(name))
    : [];

  const playerRows = [...totalsByPlayer.entries()]
    .map(([playerId, totals]) => {
      const player = players.find((p) => p.id === playerId);
      const stats = computeScoreStats(totals);
      if (!player || !stats) return null;
      return { player, stats };
    })
    .filter((row): row is { player: Player; stats: NonNullable<typeof overall> } => Boolean(row))
    .sort((a, b) => a.stats.average - b.stats.average);

  async function handleDelete() {
    if (!course) return;
    if (confirm(`Delete "${course.name}"? This also deletes any rounds played there.`)) {
      await deleteCourse(course.id);
      navigate("/courses");
    }
  }

  return (
    <div>
      <PageHeader title={course.name} subtitle={course.location} />

      <Card className="mb-4 overflow-x-auto">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
          Holes
        </p>
        <p className="text-xs text-slate-400 mb-2">
          {course.holes.length} holes · par {par}
          {hasAnyDistance ? ` · ${totalDistance.toLocaleString()} ft` : ""}
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs">
              <th className="text-left font-medium pb-2">Hole</th>
              <th className="font-medium pb-2 text-center">Yardage</th>
              <th className="font-medium pb-2 text-center">Avg</th>
              <th className="font-medium pb-2 text-center">Handicap</th>
            </tr>
          </thead>
          <tbody>
            {holeHandicaps.map((h) => (
              <tr key={h.holeNumber} className="border-t border-slate-100">
                <td className="py-1.5 whitespace-nowrap">
                  #{h.holeNumber} <span className="text-slate-400">(par {h.par})</span>
                </td>
                <td className="py-1.5 text-center tabular-nums text-slate-600">
                  {h.distanceFt ? `${h.distanceFt}ft` : "—"}
                </td>
                <td className="py-1.5 text-center tabular-nums text-slate-900 font-semibold">
                  {h.average ?? "—"}
                </td>
                <td className="py-1.5 text-center tabular-nums font-semibold">
                  {h.handicapRank ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Course record
        </p>
        {overall ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-slate-400">Low</p>
                <p className="text-xl font-bold text-green-600 tabular-nums">
                  {recordEntry?.total ?? overall.low}
                </p>
                <p className="text-xs text-slate-400">
                  {relToPar(recordEntry?.total ?? overall.low, par)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Average</p>
                <p className="text-xl font-bold text-slate-900 tabular-nums">{overall.average}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">High</p>
                <p className="text-xl font-bold text-red-600 tabular-nums">{overall.high}</p>
                <p className="text-xs text-slate-400">{relToPar(overall.high, par)}</p>
              </div>
            </div>
            {recordHolderNames.length > 0 && (
              <p className="text-center text-sm text-slate-600 mt-2">
                Held by <span className="font-semibold">{recordHolderNames.join(" & ")}</span>
              </p>
            )}
            <p className="text-center text-[11px] text-slate-400 mt-1">
              {overall.rounds} rounds logged
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">No rounds logged here yet.</p>
        )}
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Top 5 scores
        </p>
        {topScores.length === 0 ? (
          <p className="text-sm text-slate-500">No individually-scored rounds logged here yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {topScores.map((entry, i) => {
              const player = playersById.get(entry.playerId);
              if (!player) return null;
              return (
                <li key={`${entry.roundId}-${entry.playerId}`}>
                  <Link
                    to={`/round/${entry.roundId}`}
                    className="flex items-center justify-between py-2.5"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-slate-400 w-4">{i + 1}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: player.color }}
                      />
                      <span className="font-medium text-slate-800 text-sm">{player.name}</span>
                    </span>
                    <span className="text-right">
                      <span className="font-semibold tabular-nums text-sm">{entry.total}</span>{" "}
                      <span className="text-xs text-slate-400">
                        ({relToPar(entry.total, par)})
                      </span>
                      <span className="block text-[11px] text-slate-400">{entry.date}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mb-4">
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
                      <span className="text-slate-900 font-semibold">{stats.average}</span>
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

      <Button variant="danger" className="w-full" onClick={handleDelete}>
        Delete course
      </Button>
    </div>
  );
}
