import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";
import { coursesAPI } from "../../api";
import { BookOpen, Users, BarChart2, PlusCircle } from "lucide-react";

export default function InstructorDashboard() {
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ["my-courses"], queryFn: () => coursesAPI.list().then(r => r.data) });
  const courses = Array.isArray(data) ? data : (data?.results || []);
  const myCourses = courses.filter(c => c.instructor_id === user?.id || !c.instructor_id);

  return (
    <div className="page">
      <Navbar />
      <div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div>
            <h2 style={{ marginBottom: "0.25rem" }}>Instructor Dashboard</h2>
            <p className="text-muted">Manage your courses and review student submissions</p>
          </div>
          <Link to="/courses/create" className="btn btn-primary"><PlusCircle size={16} /> New Course</Link>
        </div>

        <div className="grid-3" style={{ marginBottom: "2.5rem" }}>
          {[
            { icon: BookOpen, label: "My Courses", value: myCourses.length, color: "var(--clr-primary)" },
            { icon: Users,    label: "Total Students", value: "-", color: "var(--clr-accent)" },
            { icon: BarChart2, label: "Avg Completion", value: "-", color: "var(--clr-warning)" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="glass" style={{ padding: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ background: `${color}20`, borderRadius: "50%", padding: "0.75rem" }}><Icon size={22} color={color} /></div>
              <div>
                <p className="text-muted" style={{ fontSize: "0.8rem" }}>{label}</p>
                <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--clr-heading)" }}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        <h3 style={{ marginBottom: "1rem" }}>Your Courses</h3>
        {myCourses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", border: "1px dashed var(--clr-border)", borderRadius: "var(--radius-md)" }}>
            <BookOpen size={40} style={{ opacity: 0.3, margin: "0 auto 1rem" }} />
            <p className="text-muted">No courses yet.</p>
            <Link to="/courses/create" className="btn btn-primary" style={{ marginTop: "1rem" }}>Create Your First Course</Link>
          </div>
        ) : (
          <div className="grid-3">
            {myCourses.map(c => (
              <div key={c.id} className="card">
                <div className="card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <h4>{c.title}</h4>
                    <span className={`badge ${c.status === "published" ? "badge-success" : "badge-warning"}`}>{c.status}</span>
                  </div>
                  <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>{c.lesson_count} lessons</p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Link to={`/courses/${c.slug}`} className="btn btn-outline btn-sm">View</Link>
                    <Link to={`/dashboard/instructor/courses/${c.slug}/analytics`} className="btn btn-sm" style={{ background: "rgba(108,99,255,0.1)", color: "var(--clr-primary)" }}>Analytics</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
