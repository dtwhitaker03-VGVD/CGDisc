import { Link, useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { courseHoleDetail, type HoleExtreme } from "../lib/stats";
import { HoleBreakdown } from "../components/HoleBreakdown";
import { Card, PageHeader } from "../components/ui";

/** Birdie (or better) green, par black, bogey (or worse) red. */
const vsParColor = (score: number, par: number) =>
  score < par ? "text-green-600" : score > par ? "text-red-600" : "text-slate-900";

export function HoleStatsPage() {
  const { courseId, holeNumber } = useParams();
  const { coursesById, playersById, rounds } = useAppData();
  const course = courseId ? coursesById.get(courseId) : undefined;
  const holeIndex = course ? course.holes.findIndex((h) => String(h.number) === holeNumber) : -1;

  if (!course || holeIndex < 0) {
    return (
      <div>
        <PageHeader title="Hole not found" />
      </div>
    );
  }

  const detail = courseHoleDetail(course, rounds, holeIndex);
  const { par } = detail;
  const prev = course.holes[holeIndex - 1];
  const next = course.holes[holeIndex + 1];

  const extreme = (label: string, e: HoleExtreme | null, tone: string) => (
    <div className="flex-1">
      <p className="text-xs text-slate-400">{label}</p>
      {e ? (
        <>
          <p className={`text-2xl font-bold tabular-nums ${tone}`}>{e.strokes}</p>
          <ul className="mt-1 space-y-0.5">
            {e.holders.slice(0, 4).map((h) => (
              <li key={h.playerId} className="text-sm">
                <Link to={`/round/${h.latestRoundId}`} className="text-slate-800 font-medium">
                  {playersById.get(h.playerId)?.name ?? "Someone"}
                </Link>
                <span className="text-[11px] text-slate-400">
                  {" "}
                  · {h.times > 1 ? `${h.times} times, latest ` : ""}
                  {h.latestDate}
                </span>
              </li>
            ))}
            {e.holders.length > 4 && (
              <li className="text-[11px] text-slate-400">+{e.holders.length - 4} more</li>
            )}
          </ul>
        </>
      ) : (
        <p className="text-2xl font-bold text-slate-300">—</p>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title={`Hole ${detail.holeNumber}`}
        subtitle={`${course.name} · par ${par}${detail.distanceFt ? ` · ${detail.distanceFt} ft` : ""}`}
        action={
          <Link
            to={`/stats/courses/${course.id}`}
            className="text-sm font-medium text-green-700 whitespace-nowrap"
          >
            ← Course
          </Link>
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-slate-400">Average</p>
            <p
              className={`text-xl font-bold tabular-nums ${
                detail.average === null ? "text-slate-300" : vsParColor(detail.average, par)
              }`}
            >
              {detail.average ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Difficulty</p>
            <p className="text-xl font-bold tabular-nums text-slate-900">
              {detail.handicapRank !== null ? `#${detail.handicapRank}` : "—"}
            </p>
            <p className="text-[11px] text-slate-400">1 = hardest</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Scores</p>
            <p className="text-xl font-bold tabular-nums text-slate-900">{detail.entries}</p>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Lowest and highest
        </p>
        <div className="flex gap-4">
          {extreme("Lowest", detail.lowest, detail.lowest ? vsParColor(detail.lowest.strokes, par) : "")}
          {extreme("Highest", detail.highest, detail.highest ? vsParColor(detail.highest.strokes, par) : "")}
        </div>
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Scoring breakdown
        </p>
        <HoleBreakdown counts={detail.counts} />
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          By player
        </p>
        {detail.byPlayer.length === 0 ? (
          <p className="text-sm text-slate-500">Nobody has played this hole yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs">
                <th className="text-left font-medium pb-2">Player</th>
                <th className="font-medium pb-2 text-center">Played</th>
                <th className="font-medium pb-2 text-center">Avg</th>
                <th className="font-medium pb-2 text-center">Best</th>
                <th className="font-medium pb-2 text-center">Worst</th>
              </tr>
            </thead>
            <tbody>
              {detail.byPlayer.map((p) => (
                <tr key={p.playerId} className="border-t border-slate-100">
                  <td className="py-1.5">
                    <Link to={`/stats/${p.playerId}`} className="text-slate-800 font-medium">
                      {playersById.get(p.playerId)?.name ?? "Someone"}
                    </Link>
                  </td>
                  <td className="py-1.5 text-center tabular-nums text-slate-600">{p.rounds}</td>
                  <td className={`py-1.5 text-center tabular-nums font-semibold ${vsParColor(p.average, par)}`}>
                    {p.average}
                  </td>
                  <td className={`py-1.5 text-center tabular-nums ${vsParColor(p.best, par)}`}>{p.best}</td>
                  <td className={`py-1.5 text-center tabular-nums ${vsParColor(p.worst, par)}`}>{p.worst}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="flex gap-2 mb-4">
        {prev ? (
          <Link
            to={`/stats/courses/${course.id}/hole/${prev.number}`}
            className="flex-1 text-center rounded-xl bg-slate-100 text-slate-700 font-medium py-2.5"
          >
            ← Hole {prev.number}
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        {next ? (
          <Link
            to={`/stats/courses/${course.id}/hole/${next.number}`}
            className="flex-1 text-center rounded-xl bg-slate-100 text-slate-700 font-medium py-2.5"
          >
            Hole {next.number} →
          </Link>
        ) : (
          <span className="flex-1" />
        )}
      </div>
      <p className="text-center text-[11px] text-slate-400">
        Scramble rounds aren't counted (the team shares one score).
      </p>
    </div>
  );
}
