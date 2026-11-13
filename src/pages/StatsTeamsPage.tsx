import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { teamLabel, teamMatchups, teamRecords } from "../lib/teamStats";
import { Card, PageHeader, inputClass } from "../components/ui";
import { TeamStatsView } from "../components/TeamStats";

const backLink = (
  <Link to="/stats" className="text-sm font-medium text-green-700 whitespace-nowrap">
    ← Stats
  </Link>
);

export function StatsTeamsPage() {
  const { players, playersById, rounds, coursesById } = useAppData();
  const [teamKey, setTeamKey] = useState("");
  const self = players.find((p) => p.isSelf);

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
        label: teamLabel(t.playerIds, playersById),
        mine: self ? t.playerIds.includes(self.id) : false,
        games: games.get(t.key) ?? 0,
      }))
      .sort(
        (a, b) =>
          Number(b.mine) - Number(a.mine) || b.games - a.games || a.label.localeCompare(b.label),
      );
  }, [matchups, playersById, self]);

  return (
    <div>
      <PageHeader title="Teams" subtitle="Pick a team" action={backLink} />
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
    </div>
  );
}
