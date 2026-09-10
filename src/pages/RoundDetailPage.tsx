import { useMemo } from "react";
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

  if (!round || !course) {
    return (
      <div>
        <PageHeader title="Round not found" />
      </div>
    );
  }

  function setScore(playerId: string, holeIndex: number, value: number) {
    if (!round) return;
    const updated = round.scores[playerId].map((s, i) => (i === holeIndex ? Math.max(1, value) : s));
    updateRound(round.id, { scores: { ...round.scores, [playerId]: updated } });
  }

  function handleDelete() {
    if (!round) return;
    if (confirm("Delete this round? This can't be undone.")) {
      deleteRound(round.id);
      navigate("/rounds");
    }
  }

  return (
    <div>
      <PageHeader title={course.name} subtitle={round.date} />

      <div className="grid grid-cols-2 gap-2 mb-4">
        {round.playerIds.map((pid) => {
          const player = playersById.get(pid);
          const strokes = round.scores[pid];
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
              <p className="text-xs text-slate-400">Rating {roundRating(strokes, course)}</p>
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
                  {hole.number} <span className="text-slate-400">(par {hole.par})</span>
                </td>
                {round.playerIds.map((pid) => (
                  <td key={pid} className="px-1 py-1.5 text-center">
                    <input
                      type="number"
                      className="w-12 rounded-lg border border-slate-200 text-center py-1"
                      value={round.scores[pid]?.[i] ?? hole.par}
                      onChange={(e) => setScore(pid, i, Number(e.target.value) || hole.par)}
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
