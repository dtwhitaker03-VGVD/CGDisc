import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import {
  INDIVIDUAL_RECORD_LABEL,
  TEAM_RECORD_LABEL,
  courseRecords,
  type IndividualRecordType,
  type RecordEntry,
} from "../lib/records";
import { teamLabel, type TeamGameType } from "../lib/teamStats";
import { Card, EmptyState, PageHeader } from "../components/ui";

const rel = (v: number) => (v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`);

export function RecordsPage() {
  const { rounds, coursesById, playersById } = useAppData();
  const records = courseRecords(rounds, coursesById);

  const holders = (e: RecordEntry, team: boolean) =>
    e.holders.map((h, i) => (
      <Link key={`${h.roundId}-${i}`} to={`/round/${h.roundId}`} className="block text-[11px] text-slate-400">
        {team
          ? teamLabel(h.playerIds, playersById)
          : (playersById.get(h.playerIds[0])?.name ?? "Someone")}{" "}
        · {h.date}
      </Link>
    ));

  const score = (e: RecordEntry, net: boolean) =>
    net && e.net !== undefined ? `${e.net} net (${rel(e.rel)}) · ${e.strokes} gross` : `${e.strokes} (${rel(e.rel)})`;

  return (
    <div>
      <PageHeader
        title="Records"
        subtitle="Best scores at each course"
        action={
          <Link to="/stats" className="text-sm font-medium text-green-700">
            ← Stats
          </Link>
        }
      />

      {records.length === 0 ? (
        <EmptyState icon="🏆" title="No records yet" subtitle="Finish a round to set the first ones." />
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            const course = coursesById.get(r.courseId);
            const individual = (Object.keys(INDIVIDUAL_RECORD_LABEL) as IndividualRecordType[]).filter(
              (t) => r.individual[t],
            );
            const team = (Object.keys(TEAM_RECORD_LABEL) as TeamGameType[]).filter((t) => r.team[t]);
            return (
              <Card key={r.courseId}>
                <Link to={`/courses/${r.courseId}`} className="font-semibold text-slate-900">
                  {course?.name ?? "Course"}
                </Link>

                {individual.length > 0 && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-3 mb-1">
                      Individual
                    </p>
                    <ul className="divide-y divide-slate-100">
                      {individual.map((t) => (
                        <li key={t} className="flex items-start justify-between gap-3 py-1.5">
                          <span className="text-sm text-slate-600">{INDIVIDUAL_RECORD_LABEL[t]}</span>
                          <span className="text-right">
                            <span className="text-sm font-semibold text-slate-900 tabular-nums">
                              {score(r.individual[t]!, t === "handicapped")}
                            </span>
                            {holders(r.individual[t]!, false)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {team.length > 0 && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mt-3 mb-1">
                      Team
                    </p>
                    <ul className="divide-y divide-slate-100">
                      {team.map((t) => (
                        <li key={t} className="flex items-start justify-between gap-3 py-1.5">
                          <span className="text-sm text-slate-600">{TEAM_RECORD_LABEL[t]}</span>
                          <span className="text-right">
                            <span className="text-sm font-semibold text-slate-900 tabular-nums">
                              {score(r.team[t]!, false)}
                            </span>
                            {holders(r.team[t]!, true)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
