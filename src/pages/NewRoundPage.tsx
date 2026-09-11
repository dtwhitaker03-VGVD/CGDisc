import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { scoreToPar } from "../lib/ratings";
import { ScoreStepper } from "../components/ScoreStepper";
import { Button, Card, EmptyState, LinkButton, PageHeader, inputClass } from "../components/ui";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function NewRoundPage() {
  const navigate = useNavigate();
  const { courses, players, addPlayer, addRound } = useAppData();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [playerIds, setPlayerIds] = useState<string[]>(
    players.filter((p) => p.isSelf).map((p) => p.id),
  );
  const [newFriendName, setNewFriendName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [scores, setScores] = useState<Record<string, number[]>>({});
  const [activeHoleIndex, setActiveHoleIndex] = useState(0);

  const course = useMemo(() => courses.find((c) => c.id === courseId) ?? null, [courses, courseId]);

  function togglePlayer(id: string) {
    setPlayerIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function handleAddFriend() {
    if (!newFriendName.trim()) return;
    const player = addPlayer(newFriendName.trim());
    setPlayerIds((prev) => [...prev, player.id]);
    setNewFriendName("");
  }

  function goToScoring() {
    if (!course || playerIds.length === 0) return;
    const initial: Record<string, number[]> = {};
    for (const pid of playerIds) {
      initial[pid] = course.holes.map((h) => h.par);
    }
    setScores(initial);
    setActiveHoleIndex(0);
    setStep(3);
  }

  function setHoleScore(playerId: string, holeIndex: number, value: number) {
    setScores((prev) => ({
      ...prev,
      [playerId]: prev[playerId].map((s, i) => (i === holeIndex ? value : s)),
    }));
  }

  function handleSave() {
    if (!course) return;
    const round = addRound({ courseId: course.id, date, playerIds, scores });
    navigate(`/round/${round.id}`);
  }

  if (courses.length === 0) {
    return (
      <div>
        <PageHeader title="New round" />
        <EmptyState
          icon="🗺️"
          title="Add a course first"
          subtitle="You'll need at least one local course before logging a round."
          action={<LinkButton to="/courses/new">Add a course</LinkButton>}
        />
      </div>
    );
  }

  if (step === 1) {
    return (
      <div>
        <PageHeader title="New round" subtitle="Step 1 of 3 · Choose a course" />
        <div className="space-y-2 mb-4">
          {courses.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCourseId(c.id)}
              className="block w-full text-left"
            >
              <Card
                className={courseId === c.id ? "border-green-600 ring-2 ring-green-100" : ""}
              >
                <p className="font-semibold text-slate-900">{c.name}</p>
                <p className="text-sm text-slate-400">{c.holes.length} holes</p>
              </Card>
            </button>
          ))}
        </div>
        <Button className="w-full" disabled={!courseId} onClick={() => setStep(2)}>
          Next: pick players
        </Button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div>
        <PageHeader title="New round" subtitle="Step 2 of 3 · Who's playing?" />

        {players.length === 0 && (
          <p className="text-sm text-slate-500 mb-3">Add players below, starting with yourself.</p>
        )}

        <div className="space-y-2 mb-4">
          {players.map((p) => (
            <button key={p.id} type="button" onClick={() => togglePlayer(p.id)} className="block w-full text-left">
              <Card
                className={`flex items-center gap-3 ${
                  playerIds.includes(p.id) ? "border-green-600 ring-2 ring-green-100" : ""
                }`}
              >
                <input type="checkbox" readOnly checked={playerIds.includes(p.id)} className="w-4 h-4" />
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="font-medium text-slate-800">
                  {p.name}
                  {p.isSelf ? " (you)" : ""}
                </span>
              </Card>
            </button>
          ))}
        </div>

        <Card className="mb-4 flex gap-2">
          <input
            className={inputClass}
            placeholder="Add a friend by name"
            value={newFriendName}
            onChange={(e) => setNewFriendName(e.target.value)}
          />
          <Button variant="secondary" onClick={handleAddFriend} disabled={!newFriendName.trim()}>
            Add
          </Button>
        </Card>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>
            Back
          </Button>
          <Button className="flex-1" disabled={playerIds.length === 0} onClick={goToScoring}>
            Next: scores
          </Button>
        </div>
      </div>
    );
  }

  if (!course) return null;

  const hole = course.holes[activeHoleIndex];
  const isFirstHole = activeHoleIndex === 0;
  const isLastHole = activeHoleIndex === course.holes.length - 1;

  function goToHole(index: number) {
    setActiveHoleIndex(Math.max(0, Math.min(course!.holes.length - 1, index)));
  }

  return (
    <div>
      <PageHeader title="New round" subtitle={`Step 3 of 3 · ${course.name}`} />

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4">
        {course.holes.map((h, i) => (
          <button
            key={h.number}
            type="button"
            onClick={() => goToHole(i)}
            className={`shrink-0 w-9 h-9 rounded-full text-sm font-semibold ${
              i === activeHoleIndex ? "bg-green-700 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {h.number}
          </button>
        ))}
      </div>

      <Card className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-lg text-slate-900">Hole {hole.number}</p>
          <p className="text-sm text-slate-400">
            Par {hole.par}
            {hole.distanceFt ? ` · ${hole.distanceFt} ft` : ""}
          </p>
        </div>
        <p className="text-sm text-slate-400">
          {activeHoleIndex + 1} of {course.holes.length}
        </p>
      </Card>

      <div className="space-y-2 mb-4">
        {playerIds.map((pid) => {
          const player = players.find((p) => p.id === pid);
          const playerScores = scores[pid];
          if (!player || !playerScores) return null;
          const total = playerScores.reduce((s, v) => s + v, 0);
          const rel = scoreToPar(playerScores, course);
          return (
            <Card key={pid} className="flex items-center justify-between py-2.5">
              <div>
                <p className="font-semibold text-slate-800 flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: player.color }}
                  />
                  {player.name}
                </p>
                <p className="text-xs text-slate-400">
                  Total {total} ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                </p>
              </div>
              <ScoreStepper
                value={playerScores[activeHoleIndex] ?? hole.par}
                par={hole.par}
                onChange={(v) => setHoleScore(pid, activeHoleIndex, v)}
              />
            </Card>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => (isFirstHole ? setStep(2) : goToHole(activeHoleIndex - 1))}
        >
          {isFirstHole ? "Back" : "Previous hole"}
        </Button>
        <Button
          className="flex-1"
          onClick={() => (isLastHole ? handleSave() : goToHole(activeHoleIndex + 1))}
        >
          {isLastHole ? "Save round" : "Next hole"}
        </Button>
      </div>
    </div>
  );
}
