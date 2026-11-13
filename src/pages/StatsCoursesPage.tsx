import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { Card, PageHeader, inputClass } from "../components/ui";
import { CourseStatsView } from "./CourseDetailPage";

const backLink = (
  <Link to="/stats" className="text-sm font-medium text-green-700 whitespace-nowrap">
    ← Stats
  </Link>
);

export function StatsCoursesPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { courses } = useAppData();
  const course = courses.find((c) => c.id === courseId);

  return (
    <div>
      <PageHeader title="Courses" subtitle="Pick a course, then tap a hole" action={backLink} />
      {courses.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">Add a course to see its stats here.</p>
        </Card>
      ) : (
        <>
          <select
            className={`${inputClass} mb-3`}
            value={course?.id ?? ""}
            onChange={(e) => navigate(e.target.value ? `/stats/courses/${e.target.value}` : "/stats/courses")}
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
    </div>
  );
}
