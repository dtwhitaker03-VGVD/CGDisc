import { Card, PageHeader } from "../components/ui";

export function AboutRatingsPage() {
  return (
    <div>
      <PageHeader title="How ratings work" />
      <div className="space-y-4">
        <Card>
          <p className="font-semibold text-slate-800 mb-1">Round rating</p>
          <p className="text-sm text-slate-600">
            Each course has a <strong>rating basis</strong> (a score treated as "1000 rated",
            defaulting to par) and <strong>points per throw</strong> (default 10). A round's
            rating is:
          </p>
          <p className="text-sm font-mono bg-slate-50 rounded-lg p-2 mt-2">
            1000 − (score − ratingBasis) × pointsPerThrow
          </p>
          <p className="text-sm text-slate-600 mt-2">
            This is inspired by the shape of PDGA-style ratings, but it's a personal estimate:
            it has no access to PDGA's official course-propagator data, so it's only meaningful
            for tracking your own trend over time and comparing rounds on the same course. You
            can tune a course's rating basis and points-per-throw in its edit screen.
          </p>
        </Card>

        <Card>
          <p className="font-semibold text-slate-800 mb-1">Handicap</p>
          <p className="text-sm text-slate-600">
            For every round, we compute a <strong>differential</strong>: your score minus that
            course's rating basis. A lower (more negative) differential means you played better
            than that course's baseline.
          </p>
          <p className="text-sm text-slate-600 mt-2">
            Your handicap is the average of your best differentials from your most recent 20
            rounds (across any course) — loosely modeled on how golf's World Handicap System
            picks how many of your best rounds to average as you build up history:
          </p>
          <ul className="text-sm text-slate-600 list-disc pl-5 mt-2 space-y-0.5">
            <li>Fewer than 3 rounds: no handicap yet</li>
            <li>3–4 rounds: best 1</li>
            <li>5–6 rounds: best 2</li>
            <li>7–8 rounds: best 3</li>
            <li>9–20 rounds: best 4 through 8, scaling up</li>
          </ul>
          <p className="text-sm text-slate-600 mt-2">
            A lower (more negative) handicap means you tend to shoot under a course's baseline;
            a positive handicap means you tend to shoot over it. Because differentials are
            normalized by each course's rating basis, handicaps are comparable across different
            courses — which is what lets you and your friends compare handicaps even if you
            don't always play the same course together.
          </p>
        </Card>

        <Card>
          <p className="font-semibold text-slate-800 mb-1">All data stays on this phone</p>
          <p className="text-sm text-slate-600">
            Courses, players, and rounds are stored only in this browser's local storage —
            nothing is sent to a server. That keeps things simple and private, but it also means
            data isn't synced between devices, so scores for friends are the ones you enter
            here, not synced from their own phones.
          </p>
        </Card>
      </div>
    </div>
  );
}
