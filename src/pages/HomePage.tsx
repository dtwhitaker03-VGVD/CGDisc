import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { computeHandicap, playerDifferentials, roundRating, scoreToPar } from "../lib/ratings";
import { Card, EmptyState, LinkButton, PageHeader } from "../components/ui";

export function HomePage() {
  const { players, rounds, courses, coursesById } = useAppData();

  const standings = players
    .map((p) => {
      const diffs = playerDifferentials(p.id, rounds, coursesById);
      return { player: p, handicap: computeHandicap(diffs), roundsPlayed: diffs.length };
    })
    .sort((a, b) => {
      if (a.handicap === null && b.handicap === null) return 0;
      if (a.handicap === null) return 1;
      if (b.handicap === null) return -1;
      return a.handicap - b.handicap;
    });

  const lastRound = [...rounds].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const lastCourse = lastRound ? coursesById.get(lastRound.courseId) : undefined;

  return (
    <div>
      <PageHeader title="CGDisc" subtitle="Your disc golf rounds, ratings & handicaps" />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <LinkButton to="/round/new">🥏 New round</LinkButton>
        <LinkButton to="/courses/new" variant="secondary">
          + Add course
        </LinkButton>
      </div>

      {lastRound && lastCourse && (
        <Card className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Last round
          </p>
          <Link to={`/round/${lastRound.id}`} className="block">
            <p className="font-semibold text-slate-900">{lastCourse.name}</p>
            <p className="text-sm text-slate-500">{lastRound.date}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {lastRound.playerIds.map((pid) => {
                const strokes = lastRound.scores[pid];
                const player = players.find((p) => p.id === pid);
                if (!strokes || !player) return null;
                const rel = scoreToPar(strokes, lastCourse);
                const rating = roundRating(strokes, lastCourse);
                return (
                  <div key={pid} className="text-sm">
                    <span className="font-medium" style={{ color: player.color }}>
                      {player.name}
                    </span>{" "}
                    <span className="tabular-nums">
                      {rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel}
                    </span>{" "}
                    <span className="text-slate-400">· rating {rating}</span>
                  </div>
                );
              })}
            </div>
          </Link>
        </Card>
      )}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Handicap leaderboard
        </p>
        {players.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No players yet"
            subtitle="Add yourself and your friends to start tracking handicaps."
            action={<LinkButton to="/players">Add players</LinkButton>}
          />
        ) : rounds.length === 0 ? (
          <p className="text-sm text-slate-500">
            Play a round to see ratings and handicaps here.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {standings.map(({ player, handicap, roundsPlayed }, i) => (
              <li key={player.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm text-slate-400 w-4">{i + 1}</span>
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="font-medium text-slate-800">
                    {player.name}
                    {player.isSelf ? " (you)" : ""}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">
                    {handicap === null ? "—" : handicap > 0 ? `+${handicap}` : handicap}
                  </div>
                  <div className="text-[11px] text-slate-400">{roundsPlayed} rounds</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {rounds.length > 0 && (
        <p className="text-center text-sm mt-4">
          <Link to="/rounds" className="text-green-700 font-medium">
            View all rounds →
          </Link>
        </p>
      )}

      {courses.length === 0 && (
        <p className="text-center text-sm text-slate-400 mt-6">
          Tip: add your local courses first so rounds are quick to log.
        </p>
      )}
    </div>
  );
}
