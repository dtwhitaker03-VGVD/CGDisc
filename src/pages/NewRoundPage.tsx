import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import {
  computeHandicap,
  computeHandicapAllowances,
  playerDifferentials,
  totalScore,
} from "../lib/ratings";
import { computeHoleWins, teamPerHoleScores } from "../lib/matchplay";
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
  step: 1 | 2 | 3 | 4;
  courseId: string | null;
  playerIds: string[];
  date: string;
  scores: Record<string, number[]>;
  activeHoleIndex: number;
  roundMode: "straight" | "handicapped" | "team";
  teamOf: Record<string, number>;
  teamCount: number;
  teamGameType: "scramble" | "bestBall" | "teamTotal";
  scoringMethod: "strokes" | "holes";
  droppedPlayers: Record<string, number>;
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

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
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
  const [scoringMethod, setScoringMethod] = useState<"strokes" | "holes">("strokes");
  // Players who left partway through the round (only supported for
  // non-team rounds) -- maps playerId to how many holes they played
  // before leaving, so their score through that point still counts.
  const [droppedPlayers, setDroppedPlayers] = useState<Record<string, number>>({});

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
    setScoringMethod(pendingDraft.scoringMethod ?? "strokes");
    setDroppedPlayers(pendingDraft.droppedPlayers ?? {});
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
    setScoringMethod("strokes");
    setDroppedPlayers({});
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
      scoringMethod,
      droppedPlayers,
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
    scoringMethod,
    droppedPlayers,
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

  // Holes scoring only applies to straight individual rounds and team
  // rounds -- handicapped rounds always score by strokes.
  useEffect(() => {
    if (roundMode === "handicapped" && scoringMethod === "holes") setScoringMethod("strokes");
  }, [roundMode, scoringMethod]);

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
    setDroppedPlayers({});
    setStep(3);
  }

  function setHoleScore(playerId: string, holeIndex: number, value: number) {
    setScores((prev) => ({
      ...prev,
      [playerId]: prev[playerId].map((s, i) => (i === holeIndex ? value : s)),
    }));
  }

  // Locks in a player's score through the current hole and drops them from
  // the rest of the round -- their partial scorecard is kept (and still
  // counts toward lifetime hole stats), but they're excluded from
  // handicap/rating and from course low/avg/high stats since the round
  // isn't complete for them. Only offered for non-team rounds.
  function dropPlayer(playerId: string) {
    const player = players.find((p) => p.id === playerId);
    if (!player) return;
    if (
      !confirm(
        `Remove ${player.name} from the rest of this round? Their score through hole ${activeHoleIndex} will still be saved.`,
      )
    ) {
      return;
    }
    setScores((prev) => ({
      ...prev,
      [playerId]: (prev[playerId] ?? []).slice(0, activeHoleIndex),
    }));
    setDroppedPlayers((prev) => ({ ...prev, [playerId]: activeHoleIndex }));
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
        scoringMethod: handicapped ? undefined : scoringMethod,
        droppedPlayers: Object.keys(droppedPlayers).length > 0 ? droppedPlayers : undefined,
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
            {draft.step === 3 && ` (hole ${draft.activeHoleIndex + 1} of ${draftCourse?.holes.length ?? "?"})`}
            {draft.step === 4 && " (reviewing final scores)"}.
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
                courseId === c.id
                  ? "border-green-700 ring-4 ring-green-300 bg-green-50"
                  : ""
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
              <div>
                <p className="text-xs text-slate-400 mb-2">
                  Individual scores, counts toward handicaps.
                </p>
                <p className="text-sm font-medium text-slate-700 mb-2">Scoring</p>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setScoringMethod("strokes")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      scoringMethod === "strokes"
                        ? "bg-green-700 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Strokes
                  </button>
                  <button
                    type="button"
                    onClick={() => setScoringMethod("holes")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      scoringMethod === "holes"
                        ? "bg-green-700 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Holes
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  {scoringMethod === "holes"
                    ? "Whoever has the lowest score on a hole wins it (a tie halves it) -- the result is holes won. Individual stroke totals are still kept and shown."
                    : "Lowest total strokes wins, as usual."}
                </p>
              </div>
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
                <p className="text-sm font-medium text-slate-700 mb-2">Scoring</p>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setScoringMethod("strokes")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      scoringMethod === "strokes"
                        ? "bg-green-700 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Strokes
                  </button>
                  <button
                    type="button"
                    onClick={() => setScoringMethod("holes")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      scoringMethod === "holes"
                        ? "bg-green-700 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Holes
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  {scoringMethod === "holes"
                    ? "Whichever team has the lowest score on a hole (per the rule above) wins it -- a tie halves it. The result is holes won. Individual stroke totals are still kept and shown."
                    : "Lowest total score wins, as usual."}
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

  // Holes default to par until changed (so the stepper's baseline is always
  // par, per-hole), but showing every unplayed hole's par from the start
  // would make a fresh round look already finished. So every running total
  // shown during scoring only counts holes already moved past -- it's 0 on
  // hole 1, and a hole's score joins the total only once you advance off of
  // it, rather than starting at the whole course's par.
  function totalThrough(strokes: number[] | undefined, holesCount: number): number {
    return totalScore((strokes ?? []).slice(0, holesCount));
  }
  function parThrough(holesCount: number): number {
    return course!.holes.slice(0, holesCount).reduce((sum, h) => sum + h.par, 0);
  }
  function liveTotal(strokes: number[] | undefined): number {
    return totalThrough(strokes, activeHoleIndex);
  }
  function playedPar(): number {
    return parThrough(activeHoleIndex);
  }
  function liveRelToPar(strokes: number[] | undefined): number {
    return liveTotal(strokes) - playedPar();
  }
  // Once the round is finished, the review screen shows the real total --
  // every hole counts, not just the ones already moved past.
  function finalTotal(strokes: number[] | undefined): number {
    return totalThrough(strokes, course!.holes.length);
  }
  function finalPar(): number {
    return parThrough(course!.holes.length);
  }
  // A player who left early only has a score through the hole they left
  // at, so their "final" par has to stop there too -- otherwise they'd be
  // compared against a full round they didn't finish.
  function effectiveHolesCount(pid: string, holesCount: number): number {
    const dropped = droppedPlayers[pid];
    return dropped === undefined ? holesCount : Math.min(dropped, holesCount);
  }
  function finalRelToPar(pid: string): number {
    return finalTotal(scores[pid]) - parThrough(effectiveHolesCount(pid, course!.holes.length));
  }

  // Players who left the round early are excluded from the live scoring
  // list and leaderboards (activePlayerIds), but still appear -- with their
  // partial score -- in the final review/saved views (playerIds).
  const activePlayerIds = playerIds.filter((pid) => !(pid in droppedPlayers));

  function buildNetStandings(
    totalFn: (s: number[] | undefined) => number,
    parFn: (pid: string) => number,
    ids: string[],
  ) {
    return ids
      .map((pid) => {
        const player = players.find((p) => p.id === pid);
        const playerScores = scores[pid];
        if (!player || !playerScores) return null;
        const gross = totalFn(playerScores);
        const allowance = allowances[pid] ?? 0;
        const grossRelToPar = gross - parFn(pid);
        const netRelToPar = grossRelToPar - allowance;
        return { pid, player, gross, grossRelToPar, netRelToPar };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => a.netRelToPar - b.netRelToPar);
  }

  function buildTeamStandings(totalFn: (s: number[] | undefined) => number, holesCount: number) {
    return Array.from({ length: teamCount }, (_, teamIndex) => {
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
        total = totalFn(scores[memberIds[0]]);
      } else if (teamGameType === "bestBall") {
        total = course!.holes.slice(0, holesCount).reduce((sum, _h, holeIndex) => {
          const holeScores = memberIds
            .map((pid) => scores[pid]?.[holeIndex])
            .filter((v): v is number => typeof v === "number");
          return sum + (holeScores.length > 0 ? Math.min(...holeScores) : 0);
        }, 0);
      } else {
        total = memberIds.reduce((sum, pid) => sum + totalFn(scores[pid]), 0);
      }
      return { teamIndex, members, total };
    })
      .filter((t) => t.members.length > 0)
      .sort((a, b) => a.total - b.total);
  }

  const netStandings = isHandicapped
    ? buildNetStandings(liveTotal, () => playedPar(), activePlayerIds)
    : [];
  const teamStandings = isTeam ? buildTeamStandings(liveTotal, activeHoleIndex) : [];
  const finalNetStandings = isHandicapped
    ? buildNetStandings(
        finalTotal,
        (pid) => parThrough(effectiveHolesCount(pid, course.holes.length)),
        playerIds,
      )
    : [];
  const finalTeamStandings = isTeam
    ? buildTeamStandings(finalTotal, course.holes.length)
    : [];

  // Match play: whoever (or whichever team) has the lowest score on a hole
  // wins it -- only offered for straight individual rounds and team
  // rounds. Player totals are computed the same way regardless (0 until a
  // hole is moved past, live; every hole, final), so the same holesCount
  // cutoff used elsewhere drives how many holes have been decided so far.
  const isHolesScoring = (roundMode === "straight" || isTeam) && scoringMethod === "holes";

  function buildPlayerHoleWins(holesCount: number, ids: string[]) {
    const wins = computeHoleWins(
      holesCount,
      ids.map((pid) => ({ id: pid, perHoleScores: scores[pid] ?? [] })),
    );
    return ids
      .map((pid) => {
        const player = players.find((p) => p.id === pid);
        if (!player) return null;
        return { pid, player, ...wins[pid] };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .sort((a, b) => b.holesWon - a.holesWon);
  }

  function buildTeamHoleWins(holesCount: number) {
    const teamGroups = Array.from({ length: teamCount }, (_, teamIndex) => {
      const memberIds = playerIds.filter((pid) => (teamOf[pid] ?? 0) === teamIndex);
      const members = memberIds
        .map((pid) => players.find((p) => p.id === pid))
        .filter((p): p is Player => Boolean(p));
      return { teamIndex, memberIds, members };
    }).filter((t) => t.members.length > 0);
    const wins = computeHoleWins(
      holesCount,
      teamGroups.map((t) => ({
        id: `team-${t.teamIndex}`,
        perHoleScores: teamPerHoleScores(teamGameType, t.memberIds, scores, holesCount),
      })),
    );
    return teamGroups
      .map((t) => ({
        teamIndex: t.teamIndex,
        members: t.members,
        ...wins[`team-${t.teamIndex}`],
      }))
      .sort((a, b) => b.holesWon - a.holesWon);
  }

  const holeWins =
    isHolesScoring && !isTeam ? buildPlayerHoleWins(activeHoleIndex, activePlayerIds) : [];
  const finalHoleWins =
    isHolesScoring && !isTeam ? buildPlayerHoleWins(course.holes.length, playerIds) : [];
  const teamHoleWins = isHolesScoring && isTeam ? buildTeamHoleWins(activeHoleIndex) : [];
  const finalTeamHoleWins =
    isHolesScoring && isTeam ? buildTeamHoleWins(course.holes.length) : [];

  // For individual rounds, keep the player list sorted by current standing
  // (lowest score first) so it's easy to see who's leading. Team rounds
  // instead group players by team (all of team 1, then all of team 2, ...)
  // so the list doesn't reshuffle hole to hole -- they already have a
  // ranked team leaderboard above for that.
  function playerScore(pid: string) {
    const gross = liveTotal(scores[pid]);
    return isHandicapped ? gross - (allowances[pid] ?? 0) : gross;
  }
  function finalPlayerScore(pid: string) {
    const gross = finalTotal(scores[pid]);
    return isHandicapped ? gross - (allowances[pid] ?? 0) : gross;
  }
  const sortedPlayerIds = isTeam
    ? [...playerIds].sort((a, b) => (teamOf[a] ?? 0) - (teamOf[b] ?? 0))
    : [...activePlayerIds].sort((a, b) => playerScore(a) - playerScore(b));
  const finalSortedPlayerIds = isTeam
    ? [...playerIds].sort((a, b) => (teamOf[a] ?? 0) - (teamOf[b] ?? 0))
    : [...playerIds].sort((a, b) => finalPlayerScore(a) - finalPlayerScore(b));
  const teamsByIndex = [...teamStandings].sort((a, b) => a.teamIndex - b.teamIndex);
  const finalTeamsByIndex = [...finalTeamStandings].sort((a, b) => a.teamIndex - b.teamIndex);

  // Honors: like real golf, whoever scores lowest on a hole goes first on
  // the next one. Chaining one stable sort per completed hole (rather than
  // one sort by cumulative total) means a tie keeps whoever already had
  // honors, exactly like the real rule -- each pass only reorders players
  // who are actually ahead/behind on that specific hole. Only applies to
  // individual (non-team) rounds; the leaderboard itself is unaffected and
  // keeps ranking by cumulative score.
  function honorsOrder(ids: string[], holesCompleted: number): string[] {
    let order = ids;
    for (let h = 0; h < holesCompleted; h++) {
      order = [...order].sort((a, b) => {
        const sa = scores[a]?.[h];
        const sb = scores[b]?.[h];
        const va = typeof sa === "number" ? sa : Infinity;
        const vb = typeof sb === "number" ? sb : Infinity;
        return va - vb;
      });
    }
    return order;
  }
  const honorsPlayerIds = isTeam
    ? sortedPlayerIds
    : honorsOrder(activePlayerIds, activeHoleIndex);

  // One column per team for scramble (a shared score), otherwise one per
  // player -- used for the review screen's hole-by-hole table.
  const reviewColumns = isScramble
    ? finalTeamsByIndex.map((team) => ({
        key: `team-${team.teamIndex}`,
        label: `Team ${team.teamIndex + 1}`,
        pid: playerIds.find((pid) => (teamOf[pid] ?? 0) === team.teamIndex),
      }))
    : finalSortedPlayerIds.map((pid) => ({
        key: pid,
        label: players.find((p) => p.id === pid)?.name ?? "",
        pid,
      }));

  // Keep the active hole scrolled into view in the (horizontally scrolling,
  // not all holes fit at once) hole-picker strip, so advancing past the
  // initially visible holes doesn't require a manual scroll to see where
  // you are.
  function scrollActiveHoleIntoView(el: HTMLButtonElement | null) {
    el?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }

  if (step === 4) {
    return (
      <div>
        <PageHeader title="New round" subtitle={`Review · ${course.name}`} />

        {Object.keys(droppedPlayers).length > 0 && (
          <Card className="mb-3 bg-amber-50 border-amber-200">
            <p className="text-xs text-amber-800">
              {Object.entries(droppedPlayers)
                .map(([pid, n]) => {
                  const name = players.find((p) => p.id === pid)?.name ?? "Someone";
                  return `${name} left after hole ${n}`;
                })
                .join(" · ")}
            </p>
          </Card>
        )}

        {isHandicapped && (
          <Card className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Net leaderboard
            </p>
            <div className="space-y-1.5">
              {finalNetStandings.map((row, i) => (
                <div key={row.pid} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-slate-400 w-4">{i + 1}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: row.player.color }}
                    />
                    <span className="font-medium text-slate-800">{row.player.name}</span>
                    {droppedPlayers[row.pid] !== undefined && (
                      <span className="text-[10px] text-amber-600 font-normal">
                        left h{droppedPlayers[row.pid]}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-slate-500">
                    {`${row.gross} · (${
                      row.grossRelToPar === 0
                        ? "E"
                        : row.grossRelToPar > 0
                          ? `+${row.grossRelToPar}`
                          : row.grossRelToPar
                    }) · `}
                    <span className="font-semibold text-slate-900">
                      {row.netRelToPar === 0
                        ? "E"
                        : row.netRelToPar > 0
                          ? `+${row.netRelToPar}`
                          : row.netRelToPar}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {roundMode === "straight" && !isHolesScoring && (
          <Card className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Leaderboard
            </p>
            <div className="space-y-1.5">
              {finalSortedPlayerIds.map((pid, i) => {
                const player = players.find((p) => p.id === pid);
                if (!player) return null;
                const total = finalTotal(scores[pid]);
                const rel = finalRelToPar(pid);
                return (
                  <div key={pid} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-slate-400 w-4">{i + 1}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: player.color }}
                      />
                      <span className="font-medium text-slate-800">{player.name}</span>
                      {droppedPlayers[pid] !== undefined && (
                        <span className="text-[10px] text-amber-600 font-normal">
                          left h{droppedPlayers[pid]}
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {total} ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {roundMode === "straight" && isHolesScoring && (
          <Card className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Holes won
            </p>
            <div className="space-y-1.5">
              {finalHoleWins.map((row, i) => {
                const rel = finalRelToPar(row.pid);
                return (
                  <div key={row.pid} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-slate-400 w-4">{i + 1}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: row.player.color }}
                      />
                      <span className="font-medium text-slate-800">{row.player.name}</span>
                      {droppedPlayers[row.pid] !== undefined && (
                        <span className="text-[10px] text-amber-600 font-normal">
                          left h{droppedPlayers[row.pid]}
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {row.holesWon} won ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {isTeam && (
          <Card className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Team leaderboard
            </p>
            <div className="space-y-2">
              {isHolesScoring
                ? finalTeamHoleWins.map((team, i) => {
                    const standing = finalTeamStandings.find(
                      (t) => t.teamIndex === team.teamIndex,
                    );
                    const parBaseline =
                      finalPar() * (teamGameType === "teamTotal" ? team.members.length : 1);
                    const rel = (standing?.total ?? 0) - parBaseline;
                    return (
                      <div
                        key={team.teamIndex}
                        className="flex items-center justify-between text-sm"
                      >
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
                          {team.holesWon} won ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                        </span>
                      </div>
                    );
                  })
                : finalTeamStandings.map((team, i) => {
                    const parBaseline =
                      finalPar() * (teamGameType === "teamTotal" ? team.members.length : 1);
                    const rel = team.total - parBaseline;
                    return (
                      <div
                        key={team.teamIndex}
                        className="flex items-center justify-between text-sm"
                      >
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

        <Card className="mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs">
                <th className="text-left font-medium pb-2 sticky left-0 bg-white pr-2">Hole</th>
                {reviewColumns.map((col) => (
                  <th key={col.key} className="font-medium pb-2 px-1 min-w-[56px]">
                    {col.label}
                    {col.pid && droppedPlayers[col.pid] !== undefined && (
                      <span className="block text-[10px] text-amber-600 font-normal normal-case">
                        left h{droppedPlayers[col.pid]}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {course.holes.map((h, i) => (
                <tr key={h.number} className="border-t border-slate-100">
                  <td className="py-1.5 sticky left-0 bg-white pr-2 whitespace-nowrap">
                    {h.number}{" "}
                    <span className="text-slate-400">
                      (par {h.par}
                      {h.distanceFt ? `, ${h.distanceFt}ft` : ""})
                    </span>
                  </td>
                  {reviewColumns.map((col) => {
                    const droppedAt = col.pid ? droppedPlayers[col.pid] : undefined;
                    const leftBeforeThisHole = droppedAt !== undefined && i >= droppedAt;
                    return (
                      <td key={col.key} className="px-1 py-1.5 text-center tabular-nums">
                        {col.pid && !leftBeforeThisHole ? scores[col.pid]?.[i] ?? h.par : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold">
                <td className="py-1.5 sticky left-0 bg-white pr-2">Total</td>
                {reviewColumns.map((col) => {
                  const total = col.pid ? finalTotal(scores[col.pid]) : 0;
                  const rel = col.pid ? finalRelToPar(col.pid) : 0;
                  return (
                    <td key={col.key} className="px-1 py-1.5 text-center tabular-nums">
                      {total}{" "}
                      <span className="text-slate-400 font-normal">
                        ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </Card>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setStep(3)}>
            Edit round
          </Button>
          <Button className="flex-1" disabled={saving} onClick={handleSave}>
            {saving ? "Finalizing…" : "Finalize round"}
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

  return (
    <div>
      <PageHeader title="New round" subtitle={`Step 3 of 3 · ${course.name}`} />

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4">
        {course.holes.map((h, i) => (
          <button
            key={h.number}
            type="button"
            ref={i === activeHoleIndex ? scrollActiveHoleIntoView : undefined}
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
        {isScramble
          ? teamsByIndex.map((team) => {
              const representativePid = playerIds.find(
                (pid) => (teamOf[pid] ?? 0) === team.teamIndex,
              );
              const teamScores = representativePid ? scores[representativePid] : undefined;
              if (!teamScores) return null;
              const rel = liveRelToPar(teamScores);
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
          : honorsPlayerIds.map((pid) => {
              const player = players.find((p) => p.id === pid);
              const playerScores = scores[pid];
              if (!player || !playerScores) return null;
              const total = liveTotal(playerScores);
              const rel = liveRelToPar(playerScores);
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
                    {!isTeam && (
                      <button
                        type="button"
                        className="text-[11px] font-medium text-red-500 mt-0.5"
                        onClick={() => dropPlayer(pid)}
                      >
                        Left early
                      </button>
                    )}
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
          onClick={() => (isLastHole ? setStep(4) : goToHole(activeHoleIndex + 1))}
        >
          {isLastHole ? "Finish" : "Next hole"}
        </Button>
      </div>

      {isHandicapped && (
        <Card className="mb-3 mt-3">
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
                  {`${row.gross} · (${
                    row.grossRelToPar === 0
                      ? "E"
                      : row.grossRelToPar > 0
                        ? `+${row.grossRelToPar}`
                        : row.grossRelToPar
                  }) · `}
                  <span className="font-semibold text-slate-900">
                    {row.netRelToPar === 0
                      ? "E"
                      : row.netRelToPar > 0
                        ? `+${row.netRelToPar}`
                        : row.netRelToPar}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {roundMode === "straight" && !isHolesScoring && (
        <Card className="mb-3 mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Leaderboard
          </p>
          <div className="space-y-1.5">
            {sortedPlayerIds.map((pid, i) => {
              const player = players.find((p) => p.id === pid);
              if (!player) return null;
              const total = liveTotal(scores[pid]);
              const rel = liveRelToPar(scores[pid]);
              return (
                <div key={pid} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-slate-400 w-4">{i + 1}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: player.color }}
                    />
                    <span className="font-medium text-slate-800">{player.name}</span>
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {total} ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {roundMode === "straight" && isHolesScoring && (
        <Card className="mb-3 mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Holes won
          </p>
          <div className="space-y-1.5">
            {holeWins.map((row, i) => {
              const rel = liveRelToPar(scores[row.pid]);
              return (
                <div key={row.pid} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-slate-400 w-4">{i + 1}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: row.player.color }}
                    />
                    <span className="font-medium text-slate-800">{row.player.name}</span>
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {row.holesWon} won ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {isTeam && (
        <Card className="mb-3 mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Team leaderboard
          </p>
          <div className="space-y-2">
            {isHolesScoring
              ? teamHoleWins.map((team, i) => {
                  const standing = teamStandings.find((t) => t.teamIndex === team.teamIndex);
                  const parBaseline =
                    playedPar() * (teamGameType === "teamTotal" ? team.members.length : 1);
                  const rel = (standing?.total ?? 0) - parBaseline;
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
                        {team.holesWon} won ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                      </span>
                    </div>
                  );
                })
              : teamStandings.map((team, i) => {
                  // Team total sums every teammate's own score, so the fair
                  // par baseline for the team is par times the number of
                  // teammates (two players each shooting par nets "par x2"
                  // raw, E relative).
                  const parBaseline =
                    playedPar() * (teamGameType === "teamTotal" ? team.members.length : 1);
                  const rel = team.total - parBaseline;
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
