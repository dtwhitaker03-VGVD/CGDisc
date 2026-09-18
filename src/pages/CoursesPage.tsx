import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { coursePar } from "../lib/ratings";
import { Card, EmptyState, LinkButton, PageHeader } from "../components/ui";

export function CoursesPage() {
  const { courses } = useAppData();

  return (
    <div>
      <PageHeader
        title="Your courses"
        subtitle="Local courses you play"
        action={
          <Link
            to="/courses/new"
            className="rounded-xl bg-green-700 text-white px-3 py-2 text-sm font-semibold"
          >
            + Add
          </Link>
        }
      />

      {courses.length === 0 ? (
        <EmptyState
          icon="🗺️"
          title="No courses yet"
          subtitle="Add the local courses you play so you can quickly start a round."
          action={<LinkButton to="/courses/new">Add your first course</LinkButton>}
        />
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <Card key={course.id} className="flex items-start justify-between gap-3">
              <Link to={`/courses/${course.id}`} className="block flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{course.name}</p>
                {course.location && (
                  <p className="text-sm text-slate-500">{course.location}</p>
                )}
                <p className="text-sm text-slate-400 mt-1">
                  {course.holes.length} holes · par {coursePar(course)}
                  {course.holes.some((h) => h.distanceFt) &&
                    ` · ${course.holes
                      .reduce((s, h) => s + (h.distanceFt ?? 0), 0)
                      .toLocaleString()} ft`}
                </p>
              </Link>
              {course.mapImageUrl && (
                <a
                  href={course.mapImageUrl}
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
      )}
    </div>
  );
}
