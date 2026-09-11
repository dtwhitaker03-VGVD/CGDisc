import { Fragment, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { DEFAULT_POINTS_PER_THROW } from "../lib/ratings";
import { Button, Card, Field, PageHeader, inputClass } from "../components/ui";
import type { Hole } from "../types";

function buildHoles(count: number, previous: Hole[]): Hole[] {
  return Array.from({ length: count }, (_, i) => previous[i] ?? { number: i + 1, par: 3 });
}

function formatFeet(n: number): string {
  return n.toLocaleString();
}

export function CourseFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { courses, addCourse, updateCourse, deleteCourse } = useAppData();
  const existing = useMemo(() => courses.find((c) => c.id === id), [courses, id]);
  const isEdit = Boolean(existing);

  const [name, setName] = useState(existing?.name ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [holes, setHoles] = useState<Hole[]>(existing?.holes ?? buildHoles(18, []));
  const [pointsPerThrow, setPointsPerThrow] = useState(
    existing?.pointsPerThrow ?? DEFAULT_POINTS_PER_THROW,
  );
  const [ratingBasis, setRatingBasis] = useState<number>(
    existing?.ratingBasis ?? holes.reduce((s, h) => s + h.par, 0),
  );
  const [ratingBasisTouched, setRatingBasisTouched] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const totalPar = holes.reduce((s, h) => s + h.par, 0);

  function setHoleCount(count: number) {
    const next = buildHoles(count, holes);
    setHoles(next);
    if (!ratingBasisTouched) {
      setRatingBasis(next.reduce((s, h) => s + h.par, 0));
    }
  }

  function setPar(index: number, par: number) {
    const next = holes.map((h, i) => (i === index ? { ...h, par } : h));
    setHoles(next);
    if (!ratingBasisTouched) {
      setRatingBasis(next.reduce((s, h) => s + h.par, 0));
    }
  }

  function setDistance(index: number, distanceFt: number | undefined) {
    setHoles((prev) => prev.map((h, i) => (i === index ? { ...h, distanceFt } : h)));
  }

  const totalDistance = holes.reduce((s, h) => s + (h.distanceFt ?? 0), 0);
  const hasAnyDistance = holes.some((h) => h.distanceFt);

  function handleSave() {
    if (!name.trim() || holes.length === 0) return;
    if (isEdit && existing) {
      updateCourse(existing.id, {
        name: name.trim(),
        location: location.trim() || undefined,
        holes,
        pointsPerThrow,
        ratingBasis,
      });
      navigate("/courses");
    } else {
      const course = addCourse({ name: name.trim(), location: location.trim() || undefined, holes });
      updateCourse(course.id, { pointsPerThrow, ratingBasis });
      navigate("/courses");
    }
  }

  function handleDelete() {
    if (!existing) return;
    if (confirm(`Delete "${existing.name}"? This also deletes any rounds played there.`)) {
      deleteCourse(existing.id);
      navigate("/courses");
    }
  }

  return (
    <div>
      <PageHeader title={isEdit ? "Edit course" : "Add a course"} />

      <div className="space-y-4">
        <Card className="space-y-3">
          <Field label="Course name">
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Riverside Park"
            />
          </Field>
          <Field label="Location (optional)">
            <input
              className={inputClass}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City or address"
            />
          </Field>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-700">Number of holes</span>
            <div className="flex gap-2">
              {[9, 18].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setHoleCount(n)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    holes.length === n ? "bg-green-700 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={36}
                className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-center"
                value={holes.length}
                onChange={(e) => setHoleCount(Math.max(1, Math.min(36, Number(e.target.value) || 1)))}
              />
            </div>
          </div>

          <p className="text-sm font-medium text-slate-700 mb-2">
            Par &amp; distance per hole{" "}
            <span className="text-slate-400 font-normal">
              (total par {totalPar}
              {hasAnyDistance ? `, ${formatFeet(totalDistance)} ft` : ""})
            </span>
          </p>
          <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1.5 items-center">
            <div />
            <div className="text-[10px] uppercase tracking-wide text-slate-400 text-center">
              Par
            </div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 text-center">
              Distance (ft)
            </div>
            {holes.map((hole, i) => (
              <Fragment key={hole.number}>
                <div className="text-xs text-slate-500 w-8">#{hole.number}</div>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="w-full rounded-lg border border-slate-300 py-1.5 text-center text-sm"
                  value={hole.par}
                  onChange={(e) => setPar(i, Math.max(1, Number(e.target.value) || 1))}
                />
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-slate-300 py-1.5 text-center text-sm"
                  placeholder="—"
                  value={hole.distanceFt ?? ""}
                  onChange={(e) =>
                    setDistance(i, e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)))
                  }
                />
              </Fragment>
            ))}
          </div>
        </Card>

        <button
          type="button"
          className="text-sm font-medium text-green-700"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "Hide" : "Show"} rating settings
        </button>

        {showAdvanced && (
          <Card className="space-y-3">
            <Field label="Rating basis (score treated as a 1000 rating)">
              <input
                type="number"
                className={inputClass}
                value={ratingBasis}
                onChange={(e) => {
                  setRatingBasisTouched(true);
                  setRatingBasis(Number(e.target.value) || 0);
                }}
              />
            </Field>
            <Field label="Points per throw">
              <input
                type="number"
                className={inputClass}
                value={pointsPerThrow}
                onChange={(e) => setPointsPerThrow(Number(e.target.value) || DEFAULT_POINTS_PER_THROW)}
              />
            </Field>
            <p className="text-xs text-slate-400">
              These control the estimated rating formula for this course. Defaults assume par is a
              1000-rated round and each throw is worth {DEFAULT_POINTS_PER_THROW} rating points.
              See the Stats tab for how ratings are calculated.
            </p>
          </Card>
        )}

        <Button className="w-full" onClick={handleSave} disabled={!name.trim()}>
          {isEdit ? "Save changes" : "Add course"}
        </Button>

        {isEdit && (
          <Button variant="danger" className="w-full" onClick={handleDelete}>
            Delete course
          </Button>
        )}
      </div>
    </div>
  );
}
