import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import {
  computeHandicap,
  computeHandicapAllowances,
  coursePar,
  playerDifferentials,
  scoreToPar,
  totalScore,
} from "../lib/ratings";
import { ScoreStepper } from "../components/ScoreStepper";
import { Button, Card, EmptyState, LinkButton, PageHeader, inputClass } from "../components/ui";
import type { Player } from "../types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Persist in-progress round state locally so closing or reloading the app
// mid-round (accidentally or on purpose) doesn't lose it -- it's only ever
// saved to Supabase once the round is actually finished.
const DRAFT_STORAGE_KEY = "cgdisc:new-round-draft";

interface RoundDraft {
  step: 1 | 2 | 3;
  courseId: string | null;
  playerIds: string[];
  date: string;
  scores: Record<string, number[]>;
  activeHoleIndex: number;
  roundMode: "straight" | "handicapped" | "team";
  teamOf: Record<string, number>;
  teamCount: number;
  teamGameType: "scramble" | "bestBall" | "teamTotal";
}

function loadDraft(): RoundDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RoundDraft) : null;
  } catch {
    return null;
  }
}

function saveDraft(draft: RoundDraft) {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore (e.g. private browsing storage limits)
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
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
  const [teamGameType, setTeamGameType] = useState<"scramble" | "bestBall" | "teamTotal">(
    "bestBall",
  );

  const [pendingDraft, setPendingDraft] = useState<RoundDraft | null>(() => {
    const draft = loadDraft();
    if (draft && courses.some((c) => c.id === draft.courseId)) return draft;
    if (draft) clearDraft();
    return null;
  });

  function resumeDraft() {
    if (!pendingDraft) return;
    const validPlayerIds = pendingDraft.playerIds.filter((pid) => players.some((p) => p.id === pid));
    setCourseId(pendingDraft.courseId);
    setPlayerIds(validPlayerIds);
    setDate(pendingDraft.date);
    setScores(pendingDraft.scores);
    setActiveHoleIndex(pendingDraft.activeHoleIndex);
    setRoundMode(pendingDraft.roundMode);
    setTeamOf(pendingDraft.teamOf);
    setTeamCount(pendingDraft.teamCount);
    setTeamGameType(pendingDraft.teamGameType ?? "bestBall");
    setStep(validPlayerIds.length > 0 ? pendingDraft.step : 2);
    setPendingDraft(null);
  }

  function discardDraft() {
    clearDraft();
    setPendingDraft(null);
  }

  function discardRound() {
    clearDraft();
    setStep(1);
    setCourseId(null);
    setPlayerIds([]);
    setScores({});
    setActiveHoleIndex(0);
    setRoundMode("straight");
    setTeamOf({});
    setTeamCount(2);
    setTeamGameType("bestBall");
  }

  // Once the draft prompt (if any) is resolved, keep saving progress as the
  // round is played so it survives a reload.
  useEffect(() => {
    if (pendingDraft || !courseId) return;
    saveDraft({
      step,
      courseId,
      playerIds,
      date,
      scores,
      activeHoleIndex,
      roundMode,
      teamOf,
      teamCount,
      teamGameType,
    });
  }, [
    pendingDraft,
    step,
    courseId,
    playerIds,
    date,
    scores,
    activeHoleIndex,
    roundMode,
    teamOf,
    teamCount,
    teamGameType,
  ]);

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

  function adjustTeamCount(delta: number) {
    const next = Math.max(2, Math.min(6, teamCount + delta));
    if (next === teamCount) return;
    setTeamCount(next);
    if (next < teamCount) {
      // Reassign anyone on a team index that no longer exists to the last
      // remaining team, rather than leaving them pointing at a removed one.
      setTeamOf((prev) => {
        const updated = { ...prev };
        for (const pid of Object.keys(updated)) {
          if ((updated[pid] ?? 0) >= next) updated[pid] = next - 1;
        }
        return updated;
      });
    }
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

  // Scramble: the whole team shares one ball, so one score entry is applied
  // to every teammate's own score array (keeps the per-player storage shape
  // the rest of the app already expects, without needing a separate path).
  function setTeamHoleScore(teamIndex: number, holeIndex: number, value: number) {
    const memberIds = playerIds.filter((pid) => (teamOf[pid] ?? 0) === teamIndex);
    setScores((prev) => {
      const next = { ...prev };
      for (const pid of memberIds) {
        next[pid] = prev[pid].map((s, i) => (i === holeIndex ? value : s));
      }
      return next;
    });
  }

  async function handleSave() {
    if (!course) return;
    setSaving(true);
    try {
      const handicapped = roundMode === "handicapped";
      const isTeam = roundMode === "team";
      await addRound({
        courseId: course.id,
        date,
        playerIds,
        scores,
        handicapped,
        handicapAllowances: handicapped ? allowances : undefined,
        teamAssignments: isTeam
          ? Object.fromEntries(playerIds.map((pid) => [pid, teamOf[pid] ?? 0]))
          : undefined,
        teamGameType: isTeam ? teamGameType : undefined,
      });
      clearDraft();
      navigate("/");
    } finally {
      setSaving(false);
    }
  }

  if (pendingDraft) {
    const draft = pendingDraft;
    const draftCourse = courses.find((c) => c.id === draft.courseId);
    return (
      <div>
        <PageHeader title="Round in progress" />
        <Card className="space-y-3">
          <p className="text-slate-700">
            You have an unfinished round at{" "}
            <span className="font-semibold">{draftCourse?.name ?? "a course"}</span>
            {draft.step === 3 && ` (hole ${draft.activeHoleIndex + 1} of ${draftCourse?.holes.length ?? "?"})`}.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={discardDraft}>
              Start new round instead
            </Button>
            <Button className="flex-1" onClick={resumeDraft}>
              Continue round
            </Button>
          </div>
        </Card>
      </div>
    );
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
            <Card
              key={c.id}
              className={`flex items-center justify-between gap-3 ${
                courseId === c.id ? "border-green-600 ring-2 ring-green-100" : ""
              }`}
            >
              <button type="button" onClick={() => setCourseId(c.id)} className="flex-1 text-left">
                <p className="font-semibold text-slate-900">{c.name}</p>
                <p className="text-sm text-slate-400">{c.holes.length} holes</p>
              </button>
              {c.mapImageUrl && (
                <a
                  href={c.mapImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex flex-col items-center gap-0.5 text-green-700"
                >
                  <span className="text-xl leading-none">🗺️</span>
                  <span className="text-[11px] font-medium">Map</span>
                </a>
              )}
            </Card>
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
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setTeamGameType("scramble")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      teamGameType === "scramble"
                        ? "bg-green-700 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Scramble
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeamGameType("bestBall")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      teamGameType === "bestBall"
                        ? "bg-green-700 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Best ball
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeamGameType("teamTotal")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      teamGameType === "teamTotal"
                        ? "bg-green-700 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Team total
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  {teamGameType === "scramble"
                    ? "Teammates share one ball -- enter a single score per team each hole. Doesn't count toward anyone's handicap or rating."
                    : teamGameType === "bestBall"
                      ? "Each player plays their own disc and is scored individually, counting toward handicap/rating as usual. The team's score shown is the lowest between teammates on each hole."
                      : "Each player plays their own disc and is scored individually, counting toward handicap/rating as usual. The team's score shown is the sum of teammates' scores."}
                </p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">Number of teams</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustTeamCount(-1)}
                      disabled={teamCount <= 2}
                      className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-semibold disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="text-sm font-semibold tabular-nums w-4 text-center">
                      {teamCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => adjustTeamCount(1)}
                      disabled={teamCount >= 6}
                      className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-semibold disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
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
        <button
          type="button"
          className="text-sm font-medium text-slate-400 mt-3 block mx-auto"
          onClick={discardRound}
        >
          Discard round
        </button>
      </div>
    );
  }

  if (!course) return null;

  const hole = course.holes[activeHoleIndex];
  const isFirstHole = activeHoleIndex === 0;
  const isLastHole = activeHoleIndex === course.holes.length - 1;
  const isHandicapped = roundMode === "handicapped";
  const isTeam = roundMode === "team";
  const isScramble = isTeam && teamGameType === "scramble";

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
        const memberIds = playerIds.filter((pid) => (teamOf[pid] ?? 0) === teamIndex);
        const members = memberIds
          .map((pid) => players.find((p) => p.id === pid))
          .filter((p): p is Player => Boolean(p));
        // Scramble: the team shares one score, so every teammate's array is
        // identical -- just read it once. Best ball: the team's score is
        // the lowest among teammates on each hole, summed across holes.
        // Team total: the sum of teammates' own individual totals.
        let total: number;
        if (isScramble) {
          total = totalScore(scores[memberIds[0]] ?? []);
        } else if (teamGameType === "bestBall") {
          total = course.holes.reduce((sum, _h, holeIndex) => {
            const holeScores = memberIds
              .map((pid) => scores[pid]?.[holeIndex])
              .filter((v): v is number => typeof v === "number");
            return sum + (holeScores.length > 0 ? Math.min(...holeScores) : 0);
          }, 0);
        } else {
          total = memberIds.reduce((sum, pid) => sum + totalScore(scores[pid] ?? []), 0);
        }
        return { teamIndex, members, total };
      })
        .filter((t) => t.members.length > 0)
        .sort((a, b) => a.total - b.total)
    : [];

  // Keep the player list sorted by current standing (lowest score first) so
  // it's easy to see who's leading while entering scores. Team rounds keep
  // selection order since they already have a team leaderboard above.
  function playerScore(pid: string) {
    const gross = (scores[pid] ?? []).reduce((s, v) => s + v, 0);
    return isHandicapped ? gross - (allowances[pid] ?? 0) : gross;
  }
  const sortedPlayerIds = isTeam
    ? playerIds
    : [...playerIds].sort((a, b) => playerScore(a) - playerScore(b));

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
            {teamStandings.map((team, i) => {
              const rel = team.total - coursePar(course);
              return (
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
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {team.total} ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="space-y-2 mb-4">
        {isScramble
          ? teamStandings.map((team) => {
              const representativePid = playerIds.find(
                (pid) => (teamOf[pid] ?? 0) === team.teamIndex,
              );
              const teamScores = representativePid ? scores[representativePid] : undefined;
              if (!teamScores) return null;
              const rel = scoreToPar(teamScores, course);
              return (
                <Card key={team.teamIndex} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-semibold text-slate-800">Team {team.teamIndex + 1}</p>
                    <p className="text-xs text-slate-400">
                      {team.members.map((m) => m.name).join(", ")}
                    </p>
                    <p className="text-xs text-slate-400">
                      Total {team.total} ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                    </p>
                  </div>
                  <ScoreStepper
                    value={teamScores[activeHoleIndex] ?? hole.par}
                    par={hole.par}
                    onChange={(v) => setTeamHoleScore(team.teamIndex, activeHoleIndex, v)}
                  />
                </Card>
              );
            })
          : sortedPlayerIds.map((pid) => {
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
          {isLastHole ? (saving ? "Finalizing…" : "Finalize round") : "Next hole"}
        </Button>
      </div>
      <button
        type="button"
        className="text-sm font-medium text-slate-400 mt-3 block mx-auto"
        onClick={discardRound}
      >
        Discard round
      </button>
    </div>
  );
}
