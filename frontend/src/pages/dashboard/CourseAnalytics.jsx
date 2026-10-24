import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users, BarChart2, Award } from "lucide-react";
import Navbar from "../../components/Navbar";
import { progressAPI } from "../../api";

/** Per-course numbers: enrolments, average progress, completions, and how
 *  many students finished each lesson (spot where they drop off). */
export default function CourseAnalytics() {
  const { slug } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["course-analytics", slug],
    queryFn: () => progressAPI.courseAnalytics(slug).then((r) => r.data),
  });

  const lessons = data?.lesson_completion_stats || [];
  const max = Math.max(1, data?.total_enrolled || 0, ...lessons.map((l) => l.completions));

  return (
    <div className="page">
      <Navbar />
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem", maxWidth: 900 }}>
        <Link to="/dashboard/instructor" className="text-muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.85rem", marginBottom: "1rem" }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        {isLoading && <div className="spinner" style={{ margin: "3rem auto" }} />}
        {error && <div className="alert alert-error">Couldn't load analytics for this course.</div>}
        {data && (
          <>
            <h2 style={{ marginBottom: "1.5rem" }}>{data.course}</h2>
            <div className="grid-3" style={{ marginBottom: "2rem" }}>
              {[
                { icon: Users, label: "Students enrolled", value: data.total_enrolled, color: "var(--clr-primary)" },
                { icon: BarChart2, label: "Average progress", value: `${data.avg_progress_percent}%`, color: "var(--clr-warning)" },
                { icon: Award, label: "Finished the course", value: data.total_completions, color: "var(--clr-success)" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="glass" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ background: `${color}20`, borderRadius: "50%", padding: "0.7rem" }}><Icon size={20} color={color} /></div>
                  <div>
                    <p className="text-muted" style={{ fontSize: "0.8rem" }}>{label}</p>
                    <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--clr-heading)" }}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3 style={{ marginBottom: "0.35rem" }}>Lessons completed</h3>
            <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>How many students finished each lesson — a sharp drop shows where students get stuck.</p>
            {lessons.length === 0 ? (
              <p className="text-muted">No lesson completions yet.</p>
            ) : (
              <div className="glass" style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                {lessons.map((l, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
                      <span>{l.lesson__title}</span>
                      <span className="text-muted">{l.completions}</span>
                    </div>
                    <div className="progress-bar-wrap"><div className="progress-bar-fill" style={{ width: `${(l.completions / max) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
