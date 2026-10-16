import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { useAuth } from "../store/AuthContext";
import { scoreToPar, totalScore } from "../lib/ratings";
import { roundTags } from "../lib/roundTags";
import { Card, EmptyState, LinkButton, PageHeader } from "../components/ui";
import { LegacyImportCard } from "../components/LegacyImportCard";
import { IosInstallHint } from "../components/IosInstallHint";

const RECENT_ROUNDS = 5;
const MAX_PLAYERS_SHOWN = 4;

export function HomePage() {
  const { players, playersById, rounds, courses, coursesById } = useAppData();
  const { session, signOut } = useAuth();

  // Newest first; rounds logged the same day fall back to when they were saved.
  const recentRounds = [...rounds]
    .filter((r) => coursesById.has(r.courseId))
    .sort((a, b) =>
      a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1,
    )
    .slice(0, RECENT_ROUNDS);

  return (
    <div>
      <PageHeader
        title="CGDisc"
        subtitle="Your disc golf rounds, ratings & handicaps"
        action={
          <button
            type="button"
            onClick={() => signOut()}
            className="text-xs text-slate-400 underline"
            title={session?.user.email}
          >
            Sign out
          </button>
        }
      />

      <IosInstallHint />
      <LegacyImportCard />

      <LinkButton to="/round/new" className="text-lg py-5 mb-2">
        🥏 New round
      </LinkButton>
      <p className="text-center text-sm mb-4">
        <Link to="/courses/new" className="text-slate-500 font-medium">
          + Add course
        </Link>
      </p>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
          Recent rounds
        </p>
        {players.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No players yet"
            subtitle="Add your friends to start tracking rounds together."
            action={<LinkButton to="/players">Add players</LinkButton>}
          />
        ) : recentRounds.length === 0 ? (
          <p className="text-sm text-slate-500">Play a round to see activity here.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentRounds.map((round) => {
              const course = coursesById.get(round.courseId)!;
              const results = round.playerIds
                .map((pid) => {
                  const player = playersById.get(pid);
                  const strokes = round.scores[pid];
                  if (!player || !strokes) return null;
                  const droppedAt = round.droppedPlayers?.[pid];
                  return {
                    player,
                    total: totalScore(strokes),
                    rel: scoreToPar(strokes, course, droppedAt),
                    droppedAt,
                  };
                })
                .filter((r): r is NonNullable<typeof r> => Boolean(r))
                .sort((a, b) => a.rel - b.rel);
              const shown = results.slice(0, MAX_PLAYERS_SHOWN);
              return (
                <li key={round.id}>
                  <Link to={`/round/${round.id}`} className="block py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold text-slate-900 text-sm">{course.name}</p>
                      <p className="text-xs text-slate-400 shrink-0">{round.date}</p>
                    </div>
                    <p className="text-[11px] text-slate-400">{roundTags(round)}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                      {shown.map(({ player, total, rel, droppedAt }) => (
                        <span key={player.id}>
                          <span className="font-medium" style={{ color: player.color }}>
                            {player.name}
                          </span>{" "}
                          <span className="tabular-nums text-slate-600">
                            {total} ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                          </span>
                          {droppedAt !== undefined && (
                            <span className="text-amber-600 text-xs"> · left h{droppedAt}</span>
                          )}
                        </span>
                      ))}
                      {results.length > shown.length && (
                        <span className="text-slate-400">+{results.length - shown.length} more</span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
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
