import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { teamLabel, teamMatchups, teamRecords } from "../lib/teamStats";
import { Card, EmptyState, PageHeader, inputClass } from "../components/ui";
import { PlayerStatsView } from "./PlayerStatsPage";
import { CourseStatsView } from "./CourseDetailPage";
import { TeamStatsView } from "../components/TeamStats";

const SECTIONS = [
  { id: "stats-individuals", label: "Individuals" },
  { id: "stats-teams", label: "Teams" },
  { id: "stats-courses", label: "Courses" },
  { id: "stats-records", label: "Records" },
];

function jumpTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{title}</h2>
  );
}

export function StatsPage() {
  const { players, playersById, courses, rounds, coursesById } = useAppData();

  // Individuals: defaults to whoever is signed in (their own player).
  const [pickedPlayerId, setPickedPlayerId] = useState<string | null>(null);
  const [teamKey, setTeamKey] = useState("");
  const [courseId, setCourseId] = useState("");

  const self = players.find((p) => p.isSelf);
  const player =
    (pickedPlayerId ? playersById.get(pickedPlayerId) : undefined) ?? self ?? players[0];

  const matchups = useMemo(() => teamMatchups(rounds, coursesById), [rounds, coursesById]);
  // Teams that have played a team round; the signed-in player's teams first, then most played.
  const teams = useMemo(() => {
    const games = new Map<string, number>();
    for (const m of matchups) {
      games.set(m.keyA, (games.get(m.keyA) ?? 0) + m.games.length);
      games.set(m.keyB, (games.get(m.keyB) ?? 0) + m.games.length);
    }
    return teamRecords(matchups)
      .map((t) => ({
        key: t.key,
        ids: t.playerIds,
        label: teamLabel(t.playerIds, playersById),
        mine: self ? t.playerIds.includes(self.id) : false,
        games: games.get(t.key) ?? 0,
      }))
      .sort(
        (a, b) =>
          Number(b.mine) - Number(a.mine) || b.games - a.games || a.label.localeCompare(b.label),
      );
  }, [matchups, playersById, self]);

  const course = courses.find((c) => c.id === courseId);

  if (players.length === 0 || !player) {
    return (
      <div>
        <PageHeader title="Stats" />
        <EmptyState icon="📈" title="Add players to see stats" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Stats" subtitle="Pick a person, team or course" />

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => jumpTo(s.id)}
            className="shrink-0 rounded-full bg-slate-100 text-slate-700 text-sm font-medium px-3.5 py-1.5 active:bg-slate-200"
          >
            {s.label}
          </button>
        ))}
      </div>

      <section id="stats-individuals" className="scroll-mt-4">
        <SectionHeader title="Individuals" />
        <select
          className={`${inputClass} mb-3`}
          value={player.id}
          onChange={(e) => setPickedPlayerId(e.target.value)}
          aria-label="Choose a person"
        >
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isSelf ? " (you)" : ""}
            </option>
          ))}
        </select>
        <PlayerStatsView key={player.id} player={player} embedded />
      </section>

      <section id="stats-teams" className="scroll-mt-4 mt-8">
        <SectionHeader title="Teams" />
        {teams.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">
              Play a team round to start tracking team vs. team records here.
            </p>
          </Card>
        ) : (
          <>
            <select
              className={`${inputClass} mb-3`}
              value={teamKey}
              onChange={(e) => setTeamKey(e.target.value)}
              aria-label="Choose a team"
            >
              <option value="">Choose a team…</option>
              {teams.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            {teamKey && <TeamStatsView key={teamKey} teamKey={teamKey} matchups={matchups} />}
          </>
        )}
      </section>

      <section id="stats-courses" className="scroll-mt-4 mt-8">
        <SectionHeader title="Courses" />
        {courses.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">Add a course to see its stats here.</p>
          </Card>
        ) : (
          <>
            <select
              className={`${inputClass} mb-3`}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              aria-label="Choose a course"
            >
              <option value="">Choose a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {course && <CourseStatsView key={course.id} course={course} embedded />}
          </>
        )}
      </section>

      <section id="stats-records" className="scroll-mt-4 mt-8">
        <SectionHeader title="Records" />
        <Link to="/stats/records" className="block">
          <Card className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800">Course records</p>
              <p className="text-sm text-slate-400">
                Best scores at every course, by individual, team and round type
              </p>
            </div>
            <span className="text-slate-400">→</span>
          </Card>
        </Link>
      </section>

      <p className="text-center text-xs text-slate-400 mt-8">
        <Link to="/about-ratings" className="underline">
          How are ratings & handicaps calculated?
        </Link>
      </p>
    </div>
  );
}
