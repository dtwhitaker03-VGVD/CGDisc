import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { roundRating, scoreToPar, totalScore } from "../lib/ratings";
import { Button, Card, PageHeader } from "../components/ui";

export function RoundDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { rounds, coursesById, playersById, updateRound, deleteRound } = useAppData();

  const round = useMemo(() => rounds.find((r) => r.id === id), [rounds, id]);
  const course = round ? coursesById.get(round.courseId) : undefined;

  // Edited locally first, committed on blur, so typing doesn't fight the
  // network round-trip / realtime refresh on every keystroke.
  const [draftScores, setDraftScores] = useState(round?.scores ?? {});
  useEffect(() => {
    if (round) setDraftScores(round.scores);
  }, [round]);

  if (!round || !course) {
    return (
      <div>
        <PageHeader title="Round not found" />
      </div>
    );
  }

  function setDraftScore(playerId: string, holeIndex: number, value: number) {
    setDraftScores((prev) => ({
      ...prev,
      [playerId]: prev[playerId].map((s, i) => (i === holeIndex ? Math.max(1, value) : s)),
    }));
  }

  function commitScore(playerId: string) {
    if (!round) return;
    if (draftScores[playerId] !== round.scores[playerId]) {
      void updateRound(round.id, { scores: { [playerId]: draftScores[playerId] } });
    }
  }

  async function handleDelete() {
    if (!round) return;
    if (confirm("Delete this round? This can't be undone.")) {
      await deleteRound(round.id);
      navigate("/rounds");
    }
  }

  return (
    <div>
      <PageHeader
        title={course.name}
        subtitle={round.date}
        action={
          round.handicapped ? (
            <span className="text-xs font-semibold text-green-700 bg-green-100 rounded-full px-2.5 py-1">
              Handicapped
            </span>
          ) : round.teamAssignments ? (
            <span className="text-xs font-semibold text-blue-700 bg-blue-100 rounded-full px-2.5 py-1">
              Team round
            </span>
          ) : undefined
        }
      />

      {round.handicapped && round.handicapAllowances && (
        <Card className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Net results
          </p>
          <div className="space-y-1.5">
            {round.playerIds
              .map((pid) => {
                const player = playersById.get(pid);
                const strokes = draftScores[pid];
                if (!player || !strokes) return null;
                const gross = totalScore(strokes);
                const allowance = round.handicapAllowances?.[pid] ?? 0;
                return { pid, player, gross, allowance, net: gross - allowance };
              })
              .filter((row): row is NonNullable<typeof row> => Boolean(row))
              .sort((a, b) => a.net - b.net)
              .map((row, i) => (
                <div key={row.pid} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-slate-400 w-4">{i + 1}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: row.player.color }}
                    />
                    <span className="font-medium text-slate-800">{row.player.name}</span>
                  </span>
                  <span className="tabular-nums text-slate-500">
                    {row.gross} − {row.allowance} ={" "}
                    <span className="font-semibold text-slate-900">{row.net}</span>
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}

      {round.teamAssignments && (
        <Card className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Team results
          </p>
          <div className="space-y-2">
            {Object.entries(
              round.playerIds.reduce<Record<number, string[]>>((acc, pid) => {
                const teamIndex = round.teamAssignments?.[pid] ?? 0;
                (acc[teamIndex] ??= []).push(pid);
                return acc;
              }, {}),
            )
              .map(([teamIndex, pids]) => ({
                teamIndex: Number(teamIndex),
                members: pids
                  .map((pid) => playersById.get(pid))
                  .filter((p): p is NonNullable<typeof p> => Boolean(p)),
                total: pids.reduce((sum, pid) => sum + totalScore(draftScores[pid] ?? []), 0),
              }))
              .sort((a, b) => a.total - b.total)
              .map((team, i) => (
                <div key={team.teamIndex} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-slate-400 w-4">{i + 1}</span>
                    <span className="font-medium text-slate-800">
                      Team {team.teamIndex + 1}{" "}
                      <span className="text-xs text-slate-400 font-normal">
                        ({team.members.map((m) => m.name).join(", ")})
                      </span>
                    </span>
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">{team.total}</span>
                </div>
              ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        {round.playerIds.map((pid) => {
          const player = playersById.get(pid);
          const strokes = draftScores[pid];
          if (!player || !strokes) return null;
          const rel = scoreToPar(strokes, course);
          return (
            <Card key={pid}>
              <p className="font-medium text-sm" style={{ color: player.color }}>
                {player.name}
              </p>
              <p className="text-xl font-bold tabular-nums">
                {totalScore(strokes)}{" "}
                <span className="text-sm font-medium text-slate-400">
                  ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                </span>
              </p>
              {!round.teamAssignments && (
                <p className="text-xs text-slate-400">Rating {roundRating(strokes, course)}</p>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mb-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs">
              <th className="text-left font-medium pb-2 sticky left-0 bg-white pr-2">Hole</th>
              {round.playerIds.map((pid) => (
                <th key={pid} className="font-medium pb-2 px-1 min-w-[56px]">
                  {playersById.get(pid)?.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {course.holes.map((hole, i) => (
              <tr key={hole.number} className="border-t border-slate-100">
                <td className="py-1.5 sticky left-0 bg-white pr-2 whitespace-nowrap">
                  {hole.number}{" "}
                  <span className="text-slate-400">
                    (par {hole.par}
                    {hole.distanceFt ? `, ${hole.distanceFt}ft` : ""})
                  </span>
                </td>
                {round.playerIds.map((pid) => (
                  <td key={pid} className="px-1 py-1.5 text-center">
                    <input
                      type="number"
                      className="w-12 rounded-lg border border-slate-200 text-center py-1"
                      value={draftScores[pid]?.[i] ?? hole.par}
                      onChange={(e) => setDraftScore(pid, i, Number(e.target.value) || hole.par)}
                      onBlur={() => commitScore(pid)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Button variant="danger" className="w-full" onClick={handleDelete}>
        Delete round
      </Button>
    </div>
  );
}
