import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { teamMatchups, teamRecords } from "../lib/teamStats";
import { Card, EmptyState, PageHeader } from "../components/ui";

function StatsLink({ to, title, subtitle }: { to: string; title: string; subtitle: string }) {
  return (
    <Link to={to} className="block">
      <Card className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="text-sm text-slate-400">{subtitle}</p>
        </div>
        <span className="text-slate-400">→</span>
      </Card>
    </Link>
  );
}

export function StatsPage() {
  const { players, courses, rounds, coursesById } = useAppData();
  const teamCount = useMemo(
    () => teamRecords(teamMatchups(rounds, coursesById)).length,
    [rounds, coursesById],
  );

  if (players.length === 0) {
    return (
      <div>
        <PageHeader title="Stats" />
        <EmptyState icon="📈" title="Add players to see stats" />
      </div>
    );
  }

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return (
    <div>
      <PageHeader title="Stats" subtitle="Pick what you want to look at" />
      <div className="space-y-3">
        <StatsLink
          to="/stats/individuals"
          title="Individuals"
          subtitle={`Handicap, ratings and hole-by-hole stats · ${plural(players.length, "player")}`}
        />
        <StatsLink
          to="/stats/teams"
          title="Teams"
          subtitle={`Team records by course and versus other teams · ${plural(teamCount, "team")}`}
        />
        <StatsLink
          to="/stats/courses"
          title="Courses"
          subtitle={`Every hole's averages, birdies, pars, bogeys, lows and highs · ${plural(courses.length, "course")}`}
        />
        <StatsLink
          to="/stats/records"
          title="Records"
          subtitle="Best scores at every course, by individual, team and round type"
        />
      </div>

      <p className="text-center text-xs text-slate-400 mt-8">
        <Link to="/about-ratings" className="underline">
          How are ratings & handicaps calculated?
        </Link>
      </p>
    </div>
  );
}
