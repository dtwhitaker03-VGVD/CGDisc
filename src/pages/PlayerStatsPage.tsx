import { Link, useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import {
  coursePar,
  computeHandicap,
  playerDifferentials,
  roundRating,
  scoreToPar,
  totalScore,
} from "../lib/ratings";
import {
  computeScoreStats,
  playerHoleCounts,
  playerHoleCountsByCourse,
  playerTotalsByCourse,
  type HoleCounts,
  type ScoreStats,
} from "../lib/stats";
import { RatingChart } from "../components/RatingChart";
import { Card, PageHeader } from "../components/ui";
import type { Course } from "../types";

function relToPar(total: number, par: number): string {
  const rel = total - par;
  return rel === 0 ? "E" : rel > 0 ? `+${rel}` : `${rel}`;
}

export function PlayerStatsPage() {
  const { id } = useParams();
  const { players, rounds, coursesById } = useAppData();
  const player = players.find((p) => p.id === id);

  if (!player) {
    return (
      <div>
        <PageHeader title="Player not found" />
      </div>
    );
  }

  const playerRounds = rounds
    .filter((r) => r.playerIds.includes(player.id) && coursesById.has(r.courseId))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const chartPoints = playerRounds
    .filter((r) => !r.teamAssignments)
    .map((r) => ({
      date: r.date,
      rating: roundRating(r.scores[player.id], coursesById.get(r.courseId)!),
    }));

  const diffs = playerDifferentials(player.id, rounds, coursesById);
  const handicap = computeHandicap(diffs);

  const totalsByCourse = playerTotalsByCourse(player.id, rounds);
  const courseStatRows = [...totalsByCourse.entries()]
    .map(([courseId, totals]) => {
      const course = coursesById.get(courseId);
      const stats = computeScoreStats(totals);
      if (!course || !stats) return null;
      return { course, stats };
    })
    .filter((row): row is { course: Course; stats: ScoreStats } => Boolean(row))
    .sort((a, b) => a.course.name.localeCompare(b.course.name));

  const lifetimeHoleCounts = playerHoleCounts(player.id, rounds, coursesById);
  const holeCountsByCourse = playerHoleCountsByCourse(player.id, rounds, coursesById);
  const courseHoleCountRows = [...holeCountsByCourse.entries()]
    .map(([courseId, counts]) => {
      const course = coursesById.get(courseId);
      if (!course) return null;
      return { course, counts };
    })
    .filter((row): row is { course: Course; counts: HoleCounts } => Boolean(row))
    .sort((a, b) => a.course.name.localeCompare(b.course.name));

  return (
    <div>
      <PageHeader
        title={player.name}
        subtitle={player.isSelf ? "You" : "Friend"}
      />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card>
          <p className="text-xs text-slate-400 mb-1">Handicap</p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: player.color }}>
            {handicap === null ? "—" : handicap > 0 ? `+${handicap}` : handicap}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-400 mb-1">Rounds logged</p>
          <p className="text-2xl font-bold tabular-nums">{playerRounds.length}</p>
        </Card>
      </div>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Rating trend
        </p>
        <RatingChart points={chartPoints} color={player.color} />
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Lifetime hole scores
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl font-bold tabular-nums">{lifetimeHoleCounts.aces}</p>
            <p className="text-[11px] text-slate-400">Aces</p>
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums text-green-600">
              {lifetimeHoleCounts.birdies}
            </p>
            <p className="text-[11px] text-slate-400">Birdies</p>
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums">{lifetimeHoleCounts.pars}</p>
            <p className="text-[11px] text-slate-400">Pars</p>
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums text-amber-600">
              {lifetimeHoleCounts.bogeys}
            </p>
            <p className="text-[11px] text-slate-400">Bogeys</p>
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums text-red-600">
              {lifetimeHoleCounts.doubleBogeys}
            </p>
            <p className="text-[11px] text-slate-400">Double bogeys</p>
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums text-red-700">
              {lifetimeHoleCounts.triplePlusBogeys}
            </p>
            <p className="text-[11px] text-slate-400">Triple+ bogeys</p>
          </div>
        </div>
        <p className="text-center text-[11px] text-slate-400 mt-3">
          {lifetimeHoleCounts.holesPlayed} holes played
        </p>
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          By course (hole scores)
        </p>
        {courseHoleCountRows.length === 0 ? (
          <p className="text-sm text-slate-500">No rounds logged yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {courseHoleCountRows.map(({ course, counts }) => (
              <li key={course.id}>
                <Link to={`/stats/course/${course.id}`} className="block py-2.5">
                  <p className="font-medium text-slate-800 text-sm mb-1">{course.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    <span className="text-slate-500">{counts.aces} Ace</span>
                    <span className="text-green-600">{counts.birdies} Birdie</span>
                    <span className="text-slate-500">{counts.pars} Par</span>
                    <span className="text-amber-600">{counts.bogeys} Bogey</span>
                    <span className="text-red-600">{counts.doubleBogeys} Dbl</span>
                    <span className="text-red-700">{counts.triplePlusBogeys} Tpl+</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          By course (low / avg / high)
        </p>
        {courseStatRows.length === 0 ? (
          <p className="text-sm text-slate-500">No rounds logged yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {courseStatRows.map(({ course, stats }) => {
              const par = coursePar(course);
              return (
                <li key={course.id}>
                  <Link
                    to={`/stats/course/${course.id}`}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{course.name}</p>
                      <p className="text-[11px] text-slate-400">{stats.rounds} rounds</p>
                    </div>
                    <p className="text-sm tabular-nums text-right">
                      <span className="text-green-600 font-semibold">
                        {stats.low} ({relToPar(stats.low, par)})
                      </span>
                      {" / "}
                      <span className="text-slate-900 font-semibold">{stats.average}</span>
                      {" / "}
                      <span className="text-red-600 font-semibold">
                        {stats.high} ({relToPar(stats.high, par)})
                      </span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Round history
        </p>
        {playerRounds.length === 0 ? (
          <p className="text-sm text-slate-500">No rounds yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...playerRounds].reverse().map((r) => {
              const course = coursesById.get(r.courseId)!;
              const strokes = r.scores[player.id];
              const rel = scoreToPar(strokes, course);
              return (
                <li key={r.id}>
                  <Link to={`/round/${r.id}`} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{course.name}</p>
                      <p className="text-xs text-slate-400">{r.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums text-sm">
                        {totalScore(strokes)} ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {r.teamAssignments ? "Team round" : `Rating ${roundRating(strokes, course)}`}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
