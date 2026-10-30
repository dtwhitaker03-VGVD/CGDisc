import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { allocateHandicapStrokes, coursePar, roundRating, scoreToPar, totalScore } from "../lib/ratings";
import { courseHoleHandicapOrder } from "../lib/stats";
import { computeHoleWins, teamPerHoleScores } from "../lib/matchplay";
import { formatDuration } from "../lib/duration";
import { courseForRound } from "../lib/roundCourse";
import { ScoreStepper } from "../components/ScoreStepper";
import { Button, Card, PageHeader, inputClass } from "../components/ui";

export function RoundDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { rounds, coursesById, playersById, updateRound, deleteRound } = useAppData();

  const round = useMemo(() => rounds.find((r) => r.id === id), [rounds, id]);
  const baseCourse = round ? coursesById.get(round.courseId) : undefined;
  // The course as played this round (per-round par overrides applied).
  const course = round && baseCourse ? courseForRound(baseCourse, round) : baseCourse;

  // Rounds are locked by default once finalized -- "Edit round" opts back
  // into the editable scorecard below so scores aren't changed by a stray tap.
  const [editing, setEditing] = useState(false);

  // Edited locally first and saved after a short pause, so taps don't fight the
  // network round-trip / realtime refresh on every change.
  const [draftScores, setDraftScores] = useState(round?.scores ?? {});
  // Which hole the hole-by-hole editor is showing (and whether its par picker is open).
  const [editHole, setEditHole] = useState(0);
  const [editingPar, setEditingPar] = useState(false);
  // Latest draft for the debounced save, and the players whose edits haven't
  // been saved yet (their draft wins over a refresh from the server).
  const draftRef = useRef(draftScores);
  const unsavedRef = useRef(new Set<string>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function flushEdits() {
    clearTimeout(saveTimer.current);
    if (!round || unsavedRef.current.size === 0) return;
    const scores = Object.fromEntries(
      [...unsavedRef.current].map((pid) => [pid, draftRef.current[pid]]),
    );
    unsavedRef.current.clear();
    void updateRound(round.id, { scores });
  }
  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    flushRef.current = flushEdits;
  });
  // Don't lose taps made just before navigating away.
  useEffect(() => () => flushRef.current(), []);
  useEffect(() => {
    if (!round) return;
    const next = { ...round.scores };
    for (const pid of unsavedRef.current) next[pid] = draftRef.current[pid] ?? next[pid];
    draftRef.current = next;
    setDraftScores(next);
  }, [round]);

  if (!round || !course) {
    return (
      <div>
        <PageHeader title="Round not found" />
      </div>
    );
  }

  // A player who left early only played part of the course, so par
  // comparisons for them have to stop at the hole they left on instead of
  // the full round.
  function effectiveHolesFor(pid: string): number {
    return round!.droppedPlayers?.[pid] ?? course!.holes.length;
  }

  // "Dynamic" net, like a real scorecard's stroke-index column: each
  // player's flat allowance (the "Simple" net above) spread across
  // specific holes instead, hardest holes first -- the round total always
  // comes out equal to Simple, this only changes which holes get credit.
  const dynamicHoleOrder = round.handicapped ? courseHoleHandicapOrder(course, rounds) : [];
  const dynamicNetRows =
    round.handicapped && round.handicapAllowances
      ? round.playerIds
          .map((pid) => {
            const player = playersById.get(pid);
            const strokes = draftScores[pid];
            if (!player || !strokes) return null;
            const strokesPerHole = allocateHandicapStrokes(
              round.handicapAllowances?.[pid] ?? 0,
              dynamicHoleOrder,
            );
            const netPerHole = course!.holes.map(
              (hole, i) => (strokes[i] ?? hole.par) - (strokesPerHole[i] ?? 0),
            );
            const total = netPerHole.reduce((sum, v) => sum + v, 0);
            return { pid, player, strokesPerHole, netPerHole, total };
          })
          .filter((row): row is NonNullable<typeof row> => Boolean(row))
          .sort((a, b) => a.total - b.total)
      : [];

  const isScramble = Boolean(round.teamAssignments) && round.teamGameType === "scramble";
  const showsIndividualRating =
    !round.teamAssignments ||
    round.teamGameType === "bestBall" ||
    round.teamGameType === "teamTotal";
  const isHolesScoring = round.scoringMethod === "holes";

  const teamGroups = round.teamAssignments
    ? Object.entries(
        round.playerIds.reduce<Record<number, string[]>>((acc, pid) => {
          const teamIndex = round.teamAssignments?.[pid] ?? 0;
          (acc[teamIndex] ??= []).push(pid);
          return acc;
        }, {}),
      ).map(([teamIndex, pids]) => ({
        teamIndex: Number(teamIndex),
        pids,
        members: pids
          .map((pid) => playersById.get(pid))
          .filter((p): p is NonNullable<typeof p> => Boolean(p)),
      }))
    : [];

  function teamTotal(pids: string[]): number {
    if (round!.teamGameType === "scramble") return totalScore(draftScores[pids[0]] ?? []);
    if (round!.teamGameType === "bestBall") {
      return course!.holes.reduce((sum, _h, i) => {
        const holeScores = pids
          .map((pid) => draftScores[pid]?.[i])
          .filter((v): v is number => typeof v === "number");
        return sum + (holeScores.length > 0 ? Math.min(...holeScores) : 0);
      }, 0);
    }
    // "teamTotal" rounds, and legacy team rounds predating teamGameType,
    // both show the sum of individual totals.
    return pids.reduce((sum, pid) => sum + totalScore(draftScores[pid] ?? []), 0);
  }

  // Match play: whoever (or whichever team) has the lowest score on a hole
  // won it; a tie halved it. Only set for straight individual rounds and
  // team rounds (see scoringMethod).
  const playerHoleWinRows =
    isHolesScoring && !round.teamAssignments
      ? (() => {
          const wins = computeHoleWins(
            course.holes.length,
            round.playerIds.map((pid) => ({ id: pid, perHoleScores: draftScores[pid] ?? [] })),
          );
          return round.playerIds
            .map((pid) => {
              const player = playersById.get(pid);
              if (!player) return null;
              return { pid, player, ...wins[pid] };
            })
            .filter((row): row is NonNullable<typeof row> => Boolean(row))
            .sort((a, b) => b.holesWon - a.holesWon);
        })()
      : [];

  const strokesLeaderboardRows =
    !round.teamAssignments && !round.handicapped && !isHolesScoring
      ? round.playerIds
          .map((pid) => {
            const player = playersById.get(pid);
            const strokes = draftScores[pid];
            if (!player || !strokes) return null;
            return {
              pid,
              player,
              total: totalScore(strokes),
              rel: scoreToPar(strokes, course, effectiveHolesFor(pid)),
            };
          })
          .filter((row): row is NonNullable<typeof row> => Boolean(row))
          .sort((a, b) => a.total - b.total)
      : [];

  const teamHoleWinsMap =
    isHolesScoring && round.teamAssignments
      ? computeHoleWins(
          course.holes.length,
          teamGroups.map((t) => ({
            id: `team-${t.teamIndex}`,
            perHoleScores: teamPerHoleScores(
              round.teamGameType ?? "bestBall",
              t.pids,
              draftScores,
              course.holes.length,
            ),
          })),
        )
      : {};

  // Team rounds list players grouped by team (all of team 1, then all of
  // team 2, ...) rather than original selection order -- teamGroups is
  // already ordered by ascending team index (integer object keys iterate
  // that way), so flattening it keeps that order.
  const playerIdsForDisplay = round.teamAssignments
    ? teamGroups.flatMap((t) => t.pids)
    : round.playerIds;

  // One column per team for scramble (a shared score), otherwise one per
  // player -- used for both the hole-by-hole table and its header.
  const scoreColumns = isScramble
    ? teamGroups.map((team) => ({
        key: `team-${team.teamIndex}`,
        label: `Team ${team.teamIndex + 1}`,
        pids: team.pids,
      }))
    : playerIdsForDisplay.map((pid) => ({
        key: pid,
        label: playersById.get(pid)?.name ?? "",
        pids: [pid],
      }));

  // Stepper taps update the draft right away and are saved together shortly
  // after the last tap (or when leaving edit mode), instead of once per tap.
  function setHoleScoreFor(pids: string[], holeIndex: number, value: number) {
    const next = { ...draftRef.current };
    for (const pid of pids) {
      next[pid] = next[pid].map((s, i) => (i === holeIndex ? Math.max(1, value) : s));
      unsavedRef.current.add(pid);
    }
    draftRef.current = next;
    setDraftScores(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushRef.current(), 800);
  }

  // Change one hole's par for just this round (the course is untouched).
  // Existing scores are left as they are.
  function setHolePar(holeIndex: number, newPar: number) {
    if (!round || !baseCourse) return;
    const key = String(baseCourse.holes[holeIndex].number);
    const next = { ...round.parOverrides };
    if (newPar === baseCourse.holes[holeIndex].par) delete next[key];
    else next[key] = newPar;
    void updateRound(round.id, { parOverrides: next });
    setEditingPar(false);
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
        subtitle={
          round.durationSeconds !== undefined
            ? `${round.date} · ${formatDuration(round.durationSeconds)}`
            : round.date
        }
        action={
          round.handicapped ? (
            <span className="text-xs font-semibold text-green-700 bg-green-100 rounded-full px-2.5 py-1">
              Handicapped
            </span>
          ) : round.teamAssignments ? (
            <span className="text-xs font-semibold text-blue-700 bg-blue-100 rounded-full px-2.5 py-1">
              Team round
              {round.teamGameType === "scramble" && " · Scramble"}
              {round.teamGameType === "bestBall" && " · Best ball"}
              {round.teamGameType === "teamTotal" && " · Team total"}
              {isHolesScoring && " · Holes"}
            </span>
          ) : isHolesScoring ? (
            <span className="text-xs font-semibold text-purple-700 bg-purple-100 rounded-full px-2.5 py-1">
              Holes
            </span>
          ) : undefined
        }
      />

      {round.droppedPlayers && Object.keys(round.droppedPlayers).length > 0 && (
        <Card className="mb-4 bg-amber-50 border-amber-200">
          <p className="text-xs text-amber-800">
            {Object.entries(round.droppedPlayers)
              .map(([pid, n]) => `${playersById.get(pid)?.name ?? "Someone"} left after hole ${n}`)
              .join(" · ")}
          </p>
        </Card>
      )}

      {round.handicapped && round.handicapAllowances && (
        <Card className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Net results (Simple)
          </p>
          <div className="space-y-1.5">
            {round.playerIds
              .map((pid) => {
                const player = playersById.get(pid);
                const strokes = draftScores[pid];
                if (!player || !strokes) return null;
                const gross = totalScore(strokes);
                const allowance = round.handicapAllowances?.[pid] ?? 0;
                const grossRelToPar = scoreToPar(strokes, course, effectiveHolesFor(pid));
                const netRelToPar = grossRelToPar - allowance;
                return { pid, player, gross, grossRelToPar, netRelToPar };
              })
              .filter((row): row is NonNullable<typeof row> => Boolean(row))
              .sort((a, b) => a.netRelToPar - b.netRelToPar)
              .map((row, i) => (
                <div key={row.pid} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-slate-400 w-4">{i + 1}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: row.player.color }}
                    />
                    <span className="font-medium text-slate-800">{row.player.name}</span>
                    {round.droppedPlayers?.[row.pid] !== undefined && (
                      <span className="text-[10px] text-amber-600 font-normal">
                        left h{round.droppedPlayers[row.pid]}
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

      {round.handicapped && round.handicapAllowances && (
        <Card className="mb-4 overflow-x-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Net results (Dynamic)
          </p>
          <p className="text-[11px] text-slate-400 mb-2">
            Each player's allowance applied per hole, hardest holes first (•) -- same total as
            Simple.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs">
                <th className="text-left font-medium pb-2 sticky left-0 bg-white pr-2">Hole</th>
                {dynamicNetRows.map((row) => (
                  <th key={row.pid} className="font-medium pb-2 px-1 min-w-[56px]">
                    {row.player.name}
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
                  {dynamicNetRows.map((row) => (
                    <td key={row.pid} className="px-1 py-1.5 text-center tabular-nums">
                      {row.netPerHole[i]}
                      {row.strokesPerHole[i] > 0 && (
                        <span className="text-green-600">
                          {"•".repeat(row.strokesPerHole[i])}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold">
                <td className="py-1.5 sticky left-0 bg-white pr-2">Total</td>
                {dynamicNetRows.map((row) => (
                  <td key={row.pid} className="px-1 py-1.5 text-center tabular-nums">
                    {row.total}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      {strokesLeaderboardRows.length > 0 && (
        <Card className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Leaderboard
          </p>
          <div className="space-y-1.5">
            {strokesLeaderboardRows.map((row, i) => (
              <div key={row.pid} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-slate-400 w-4">{i + 1}</span>
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: row.player.color }}
                  />
                  <span className="font-medium text-slate-800">{row.player.name}</span>
                  {round.droppedPlayers?.[row.pid] !== undefined && (
                    <span className="text-[10px] text-amber-600 font-normal">
                      left h{round.droppedPlayers[row.pid]}
                    </span>
                  )}
                </span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {row.total} ({row.rel === 0 ? "E" : row.rel > 0 ? `+${row.rel}` : row.rel})
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!round.teamAssignments && isHolesScoring && (
        <Card className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Holes won
          </p>
          <div className="space-y-1.5">
            {playerHoleWinRows.map((row, i) => {
              const rel = scoreToPar(draftScores[row.pid] ?? [], course, effectiveHolesFor(row.pid));
              return (
                <div key={row.pid} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-slate-400 w-4">{i + 1}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: row.player.color }}
                    />
                    <span className="font-medium text-slate-800">{row.player.name}</span>
                    {round.droppedPlayers?.[row.pid] !== undefined && (
                      <span className="text-[10px] text-amber-600 font-normal">
                        left h{round.droppedPlayers[row.pid]}
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

      {round.teamAssignments && (
        <Card className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Team results
          </p>
          <div className="space-y-2">
            {isHolesScoring
              ? teamGroups
                  .map((team) => ({
                    ...team,
                    ...teamHoleWinsMap[`team-${team.teamIndex}`],
                    total: teamTotal(team.pids),
                  }))
                  .sort((a, b) => b.holesWon - a.holesWon)
                  .map((team, i) => {
                    const parBaseline =
                      coursePar(course) *
                      (round.teamGameType === "teamTotal" ? team.members.length : 1);
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
                          {team.holesWon} won ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                        </span>
                      </div>
                    );
                  })
              : teamGroups
                  .map((team) => ({ ...team, total: teamTotal(team.pids) }))
                  .sort((a, b) => a.total - b.total)
                  .map((team, i) => {
                    // Team total sums every teammate's own score, so the
                    // fair par baseline for the team is par times the
                    // number of teammates (two players each at par nets
                    // "par x2", E).
                    const parBaseline =
                      coursePar(course) *
                      (round.teamGameType === "teamTotal" ? team.members.length : 1);
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

      <div className="grid grid-cols-2 gap-2 mb-4">
        {isScramble
          ? teamGroups.map((team) => {
              const strokes = draftScores[team.pids[0]];
              if (!strokes) return null;
              const rel = scoreToPar(strokes, course);
              return (
                <Card key={team.teamIndex}>
                  <p className="font-medium text-sm text-slate-800">Team {team.teamIndex + 1}</p>
                  <p className="text-[11px] text-slate-400 mb-1">
                    {team.members.map((m) => m.name).join(", ")}
                  </p>
                  <p className="text-xl font-bold tabular-nums">
                    {totalScore(strokes)}{" "}
                    <span className="text-sm font-medium text-slate-400">
                      ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                    </span>
                  </p>
                </Card>
              );
            })
          : playerIdsForDisplay.map((pid) => {
              const player = playersById.get(pid);
              const strokes = draftScores[pid];
              if (!player || !strokes) return null;
              const droppedAt = round.droppedPlayers?.[pid];
              const rel = scoreToPar(strokes, course, effectiveHolesFor(pid));
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
                  {droppedAt !== undefined ? (
                    <p className="text-xs text-amber-600">Left after hole {droppedAt}</p>
                  ) : (
                    showsIndividualRating && (
                      <p className="text-xs text-slate-400">Rating {roundRating(strokes, course)}</p>
                    )
                  )}
                </Card>
              );
            })}
      </div>

      {editing && (
        <div className="mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4">
            {course.holes.map((h, i) => (
              <button
                key={h.number}
                type="button"
                onClick={() => setEditHole(i)}
                className={`shrink-0 w-9 h-9 rounded-full text-sm font-semibold ${
                  i === editHole ? "bg-green-700 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {h.number}
              </button>
            ))}
          </div>

          <Card className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-lg text-slate-900">Hole {course.holes[editHole].number}</p>
              <p className="text-sm text-slate-400">
                Par {course.holes[editHole].par}
                {course.holes[editHole].distanceFt
                  ? ` · ${course.holes[editHole].distanceFt} ft`
                  : ""}
                {" · "}
                <button
                  type="button"
                  className="font-medium text-green-700"
                  onClick={() => setEditingPar((v) => !v)}
                >
                  {editingPar ? "Cancel" : "Change par"}
                </button>
              </p>
              {baseCourse && baseCourse.holes[editHole].par !== course.holes[editHole].par && (
                <p className="text-xs font-medium text-amber-600">
                  Par changed for this round (course par {baseCourse.holes[editHole].par})
                </p>
              )}
              {editingPar && (
                <div className="flex gap-1.5 mt-1.5 mb-0.5">
                  {[2, 3, 4, 5, 6].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setHolePar(editHole, p)}
                      className={`w-9 h-9 rounded-full text-sm font-semibold ${
                        p === course.holes[editHole].par
                          ? "bg-green-700 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-sm text-slate-400">
              {editHole + 1} of {course.holes.length}
            </p>
          </Card>

          <div className="space-y-2 mb-3">
            {scoreColumns.map((col) => {
              const droppedAt = round.droppedPlayers?.[col.pids[0]];
              const strokes = draftScores[col.pids[0]];
              if (!strokes) return null;
              const left = droppedAt !== undefined && editHole >= droppedAt;
              const rel = scoreToPar(strokes, course, effectiveHolesFor(col.pids[0]));
              const player = playersById.get(col.pids[0]);
              return (
                <Card key={col.key} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-semibold text-slate-800 flex items-center gap-2">
                      {!isScramble && player && (
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: player.color }}
                        />
                      )}
                      {col.label}
                    </p>
                    <p className="text-xs text-slate-400">
                      Total {totalScore(strokes)} ({rel === 0 ? "E" : rel > 0 ? `+${rel}` : rel})
                    </p>
                  </div>
                  {left ? (
                    <p className="text-xs text-amber-600">Left after hole {droppedAt}</p>
                  ) : (
                    <ScoreStepper
                      value={strokes[editHole] ?? course.holes[editHole].par}
                      par={course.holes[editHole].par}
                      onChange={(v) => setHoleScoreFor(col.pids, editHole, v)}
                    />
                  )}
                </Card>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={editHole === 0}
              onClick={() => setEditHole(editHole - 1)}
            >
              Previous hole
            </Button>
            <Button
              className="flex-1"
              disabled={editHole === course.holes.length - 1}
              onClick={() => setEditHole(editHole + 1)}
            >
              Next hole
            </Button>
          </div>
        </div>
      )}

      <Card className="mb-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs">
              <th className="text-left font-medium pb-2 sticky left-0 bg-white pr-2">Hole</th>
              {scoreColumns.map((col) => (
                <th key={col.key} className="font-medium pb-2 px-1 min-w-[56px]">
                  {col.label}
                  {round.droppedPlayers?.[col.pids[0]] !== undefined && (
                    <span className="block text-[10px] text-amber-600 font-normal normal-case">
                      left h{round.droppedPlayers[col.pids[0]]}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {course.holes.map((hole, i) => (
              <tr
                key={hole.number}
                className={`border-t border-slate-100 ${
                  editing && i === editHole ? "bg-green-50" : ""
                } ${editing ? "cursor-pointer" : ""}`}
                onClick={editing ? () => setEditHole(i) : undefined}
              >
                <td
                  className={`py-1.5 sticky left-0 pr-2 whitespace-nowrap ${
                    editing && i === editHole ? "bg-green-50" : "bg-white"
                  }`}
                >
                  {hole.number}{" "}
                  <span className="text-slate-400">
                    (par {hole.par}
                    {hole.distanceFt ? `, ${hole.distanceFt}ft` : ""})
                  </span>
                </td>
                {scoreColumns.map((col) => {
                  const droppedAt = round.droppedPlayers?.[col.pids[0]];
                  const leftBeforeThisHole = droppedAt !== undefined && i >= droppedAt;
                  const value = draftScores[col.pids[0]]?.[i] ?? hole.par;
                  if (leftBeforeThisHole) {
                    return (
                      <td
                        key={col.key}
                        className="px-1 py-1.5 text-center tabular-nums text-slate-300"
                      >
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={col.key} className="px-1 py-1.5 text-center tabular-nums">
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editing && (
        <Card className="mb-4">
          <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
            Round time (minutes)
            <input
              key={round.durationSeconds ?? "none"}
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="--"
              defaultValue={
                round.durationSeconds !== undefined ? Math.round(round.durationSeconds / 60) : ""
              }
              onBlur={(e) => {
                const raw = e.target.value.trim();
                if (raw === "") return;
                const minutes = Math.max(0, Math.round(Number(raw)));
                if (!Number.isFinite(minutes) || minutes * 60 === round.durationSeconds) return;
                void updateRound(round.id, { durationSeconds: minutes * 60 });
              }}
              className={`${inputClass} w-24 text-right`}
            />
          </label>
        </Card>
      )}

      {editing ? (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              flushEdits();
              setEditing(false);
            }}
          >
            Done editing
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>
            Delete round
          </Button>
        </div>
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => setEditing(true)}>
          Edit round
        </Button>
      )}
    </div>
  );
}
