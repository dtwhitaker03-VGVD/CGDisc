import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import {
  computeHandicap,
  computeHandicapAllowances,
  playerDifferentials,
  scoreToPar,
} from "../lib/ratings";
import { ScoreStepper } from "../components/ScoreStepper";
import { Button, Card, EmptyState, LinkButton, PageHeader, inputClass } from "../components/ui";
import type { Player } from "../types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function NewRoundPage() {
  const navigate = useNavigate();
  const { courses, players, rounds, coursesById, addPlayer, addRound } = useAppData();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [newFriendName, setNewFriendName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [scores, setScores] = useState<Record<string, number[]>>({});
  const [activeHoleIndex, setActiveHoleIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [roundMode, setRoundMode] = useState<"straight" | "handicapped" | "team">("straight");
  const [teamOf, setTeamOf] = useState<Record<string, number>>({});
  const [teamCount, setTeamCount] = useState(2);

  const preselectedSelf = useRef(false);
  useEffect(() => {
    if (preselectedSelf.current) return;
    const self = players.find((p) => p.isSelf);
    if (self) {
      setPlayerIds((prev) => (prev.includes(self.id) ? prev : [...prev, self.id]));
      preselectedSelf.current = true;
    }
  }, [players]);

  const course = useMemo(() => courses.find((c) => c.id === courseId) ?? null, [courses, courseId]);

  const handicapByPlayer = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const pid of playerIds) {
      map[pid] = computeHandicap(playerDifferentials(pid, rounds, coursesById));
    }
    return map;
  }, [playerIds, rounds, coursesById]);

  const missingHandicapPlayers: Player[] = playerIds
    .filter((pid) => handicapByPlayer[pid] === null)
    .map((pid) => players.find((p) => p.id === pid))
    .filter((p): p is Player => Boolean(p));

  const canPlayHandicapped = playerIds.length >= 2 && missingHandicapPlayers.length === 0;

  const allowances = useMemo(() => {
    if (!canPlayHandicapped) return {};
    const handicaps = Object.fromEntries(
      playerIds.map((pid) => [pid, handicapByPlayer[pid] as number]),
    );
    return computeHandicapAllowances(handicaps);
  }, [canPlayHandicapped, playerIds, handicapByPlayer]);

  useEffect(() => {
    if (!canPlayHandicapped && roundMode === "handicapped") setRoundMode("straight");
  }, [canPlayHandicapped, roundMode]);

  // Auto-assign any player who doesn't have a team yet, round-robin, so
  // switching to team mode (or adding a player) doesn't require manually
  // placing everyone before you can proceed.
  useEffect(() => {
    if (roundMode !== "team") return;
    setTeamOf((prev) => {
      let changed = false;
      const next = { ...prev };
      playerIds.forEach((pid, i) => {
        if (next[pid] === undefined) {
          next[pid] = i % teamCount;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [roundMode, playerIds, teamCount]);

  function togglePlayer(id: string) {
    setPlayerIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleAddFriend() {
    if (!newFriendName.trim()) return;
    const player = await addPlayer(newFriendName.trim());
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

  async function handleSave() {
    if (!course) return;
    setSaving(true);
    try {
      const handicapped = roundMode === "handicapped";
      const isTeam = roundMode === "team";
      const round = await addRound({
        courseId: course.id,
        date,
        playerIds,
        scores,
        handicapped,
        handicapAllowances: handicapped ? allowances : undefined,
        teamAssignments: isTeam
          ? Object.fromEntries(playerIds.map((pid) => [pid, teamOf[pid] ?? 0]))
          : undefined,
      });
      navigate(`/round/${round.id}`);
    } finally {
      setSaving(false);
    }
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

        {playerIds.length >= 2 && (
          <Card className="mb-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Round type</p>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setRoundMode("straight")}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                  roundMode === "straight" ? "bg-green-700 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                Straight up
              </button>
              <button
                type="button"
                onClick={() => canPlayHandicapped && setRoundMode("handicapped")}
                disabled={!canPlayHandicapped}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-40 ${
                  roundMode === "handicapped" ? "bg-green-700 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                Handicapped
              </button>
              <button
                type="button"
                onClick={() => setRoundMode("team")}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                  roundMode === "team" ? "bg-green-700 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                Team
              </button>
            </div>

            {roundMode === "straight" && (
              <p className="text-xs text-slate-400">Individual scores, counts toward handicaps.</p>
            )}

            {roundMode === "handicapped" &&
              (!canPlayHandicapped ? (
                <p className="text-xs text-slate-400">
                  Everyone playing needs a handicap (3+ rounds each) to unlock this.
                  {missingHandicapPlayers.length > 0 &&
                    ` Still need one for ${missingHandicapPlayers.map((p) => p.name).join(", ")}.`}
                </p>
              ) : (
                <div className="space-y-0.5">
                  {playerIds.map((pid) => {
                    const player = players.find((p) => p.id === pid);
                    if (!player) return null;
                    const allowance = allowances[pid] ?? 0;
                    return (
                      <p key={pid} className="text-xs text-slate-500">
                        <span className="font-medium" style={{ color: player.color }}>
                          {player.name}
                        </span>{" "}
                        {allowance === 0 ? "scratch (+0)" : `+${allowance}`}
                      </p>
                    );
                  })}
                </div>
              ))}

            {roundMode === "team" && (
              <div>
                <p className="text-xs text-slate-400 mb-2">
                  Scores are entered per player as usual, but won't count toward anyone's
                  handicap or rating.
                </p>
                <div className="space-y-2">
                  {playerIds.map((pid) => {
                    const player = players.find((p) => p.id === pid);
                    if (!player) return null;
                    return (
                      <div key={pid} className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800 flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: player.color }}
                          />
                          {player.name}
                        </span>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {Array.from({ length: teamCount }, (_, i) => i).map((teamIndex) => (
                            <button
                              key={teamIndex}
                              type="button"
                              onClick={() => setTeamOf((prev) => ({ ...prev, [pid]: teamIndex }))}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                (teamOf[pid] ?? 0) === teamIndex
                                  ? "bg-green-700 text-white"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              Team {teamIndex + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-green-700 mt-3"
                  onClick={() => setTeamCount((n) => Math.min(6, n + 1))}
                  disabled={teamCount >= 6}
                >
                  + Add team
                </button>
              </div>
            )}
          </Card>
        )}

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
  const isHandicapped = roundMode === "handicapped";
  const isTeam = roundMode === "team";

  function goToHole(index: number) {
    setActiveHoleIndex(Math.max(0, Math.min(course!.holes.length - 1, index)));
  }

  const netStandings = isHandicapped
    ? playerIds
        .map((pid) => {
          const player = players.find((p) => p.id === pid);
          const playerScores = scores[pid];
          if (!player || !playerScores) return null;
          const gross = playerScores.reduce((s, v) => s + v, 0);
          const allowance = allowances[pid] ?? 0;
          return { pid, player, gross, allowance, net: gross - allowance };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .sort((a, b) => a.net - b.net)
    : [];

  const teamStandings = isTeam
    ? Array.from({ length: teamCount }, (_, teamIndex) => {
        const members = playerIds
          .filter((pid) => (teamOf[pid] ?? 0) === teamIndex)
          .map((pid) => players.find((p) => p.id === pid))
          .filter((p): p is Player => Boolean(p));
        const total = playerIds
          .filter((pid) => (teamOf[pid] ?? 0) === teamIndex)
          .reduce((sum, pid) => sum + (scores[pid]?.reduce((s, v) => s + v, 0) ?? 0), 0);
        return { teamIndex, members, total };
      })
        .filter((t) => t.members.length > 0)
        .sort((a, b) => a.total - b.total)
    : [];

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

      {isHandicapped && (
        <Card className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Net leaderboard
          </p>
          <div className="space-y-1.5">
            {netStandings.map((row, i) => (
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

      {isTeam && (
        <Card className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Team leaderboard
          </p>
          <div className="space-y-2">
            {teamStandings.map((team, i) => (
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
                  {isTeam && ` · Team ${(teamOf[pid] ?? 0) + 1}`}
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
          disabled={isLastHole && saving}
          onClick={() => (isLastHole ? handleSave() : goToHole(activeHoleIndex + 1))}
        >
          {isLastHole ? (saving ? "Saving…" : "Save round") : "Next hole"}
        </Button>
      </div>
    </div>
  );
}
