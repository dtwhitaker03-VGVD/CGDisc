import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { teamMatchups, teamRecords } from "../lib/teamStats";
import { computeHandicap, playerDifferentials } from "../lib/ratings";
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

  const self = players.find((p) => p.isSelf);
  const myDiffs = self ? playerDifferentials(self.id, rounds, coursesById) : [];
  const myHandicap = computeHandicap(myDiffs);

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

      <Card className="mt-6">
        <details>
          <summary className="font-semibold text-slate-900 cursor-pointer">
            How handicaps work
          </summary>
          <div className="mt-2 text-sm text-slate-600 space-y-2">
            {self && (
              <p className="rounded-lg bg-slate-50 p-2">
                {myHandicap !== null ? (
                  <>
                    Your handicap is{" "}
                    <strong className="text-slate-900">
                      {myHandicap > 0 ? `+${myHandicap}` : myHandicap}
                    </strong>
                    , based on your {Math.min(myDiffs.length, 20)} most recent counting{" "}
                    {Math.min(myDiffs.length, 20) === 1 ? "round" : "rounds"}.
                  </>
                ) : (
                  <>
                    You have {myDiffs.length} counting {myDiffs.length === 1 ? "round" : "rounds"};
                    a handicap starts at 2.
                  </>
                )}
              </p>
            )}
            <p>
              Every finished round gets a <strong>differential</strong>: your total strokes minus
              the course's rating basis. Lower is better.
            </p>
            <p>
              Your handicap is the average of your <strong>best</strong> differentials from your{" "}
              <strong>last 20 rounds</strong>, on any course. The more rounds you have, the more of
              your best ones are averaged: 2–4 rounds use the best 1, 5–6 the best 2, 7–8 the best
              3, then up to the best 8 at 19–20 rounds.
            </p>
            <p>
              It's <strong>recalculated automatically</strong> every time you look, so a new or
              edited round is reflected right away. A negative handicap means you usually beat
              the course baseline, a positive one that you usually shoot over it.
            </p>
            <p>
              <strong>Counts:</strong> individual rounds, plus best-ball and team-total rounds
              (each player's own score). <strong>Doesn't count:</strong> scramble rounds, rounds
              you left early, and rounds you joined late. A hole's par changed for a round
              shifts that round's baseline to match.
            </p>
            <p>
              In a <strong>handicapped round</strong>, the lowest handicap plays scratch and
              everyone else gets the difference as bonus strokes, locked in when the round starts.
            </p>
            <p className="text-xs text-slate-400">
              This is a personal estimate modeled loosely on golf's handicap system, not an
              official disc golf handicap.
            </p>
          </div>
        </details>
      </Card>

      <p className="text-center text-xs text-slate-400 mt-4">
        <Link to="/about-ratings" className="underline">
          How are ratings & handicaps calculated?
        </Link>
      </p>
    </div>
  );
}
