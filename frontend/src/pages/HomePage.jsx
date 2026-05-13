import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { coursesAPI } from "../api";
import Navbar from "../components/Navbar";
import { BookOpen, Zap, Shield, Award } from "lucide-react";

function CourseCard({ course }) {
  return (
    <Link to={`/courses/${course.slug}`} className="card course-card" style={{ textDecoration: "none" }}>
      <div className="card-thumb" style={{ minHeight: "160px", background: "linear-gradient(135deg,#6c63ff,#00d4aa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {course.thumbnail ? <img src={course.thumbnail} alt={course.title} /> : <BookOpen size={40} color="white" />}
      </div>
      <div className="card-body">
        <h4 style={{ marginBottom: "0.375rem" }}>{course.title}</h4>
        <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "0.75rem" }}>{course.short_description || ""}</p>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, color: "var(--clr-accent)" }}>{course.is_free ? "Free" : `BDT ${course.price}`}</span>
          <span className="text-muted" style={{ fontSize: "0.75rem" }}>{course.lesson_count} lessons</span>
        </div>
        {course.instructor_name && <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>by {course.instructor_name}</p>}
      </div>
    </Link>
  );
}

const features = [
  { Icon: Zap,      title: "AI Answer Marking",  desc: "Instant DeepSeek AI feedback on written answers with markscheme scoring." },
  { Icon: BookOpen, title: "Rich Content",        desc: "HTML fullscreen blocks, H5P interactive activities, videos and documents." },
  { Icon: Shield,   title: "Content Dripping",   desc: "Unlock lessons by time, completion, quiz score, or admin release." },
  { Icon: Award,    title: "Auto Certificates",  desc: "Earn a verifiable PDF certificate on course completion automatically." },
];

export default function HomePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["courses"],
    queryFn: () => coursesAPI.list().then(r => r.data),
  });
  const courses = Array.isArray(data) ? data : (data?.results || []);

  return (
    <div className="page">
      <Navbar />
      <section style={{ padding: "6rem 0 4rem", borderBottom: "1px solid var(--clr-border)" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <h1 style={{ marginBottom: "1.25rem" }}>Learn Smarter with<br /><span className="gradient-text">Intelligent Courses</span></h1>
          <p style={{ fontSize: "1.1rem", color: "var(--clr-muted)", maxWidth: "560px", margin: "0 auto 2.5rem" }}>
            AI-driven assessments, H5P activities, and content dripping in one beautiful platform.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <Link to="/register" className="btn btn-primary btn-lg">Start Learning Free</Link>
            <a href="#courses" className="btn btn-outline btn-lg">Browse Courses</a>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--clr-surface)" }}>
        <div className="container">
          <h2 style={{ textAlign: "center", marginBottom: "3rem" }}>Why LearnLMS?</h2>
          <div className="grid-4">
            {features.map(({ Icon, title, desc }) => (
              <div key={title} className="glass" style={{ padding: "1.75rem" }}>
                <Icon size={24} color="var(--clr-primary)" style={{ marginBottom: "1rem" }} />
                <h4 style={{ marginBottom: "0.5rem" }}>{title}</h4>
                <p className="text-muted" style={{ fontSize: "0.875rem", lineHeight: "1.6" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="courses">
        <div className="container">
          <h2 style={{ marginBottom: "2rem" }}>Available Courses</h2>
          {isLoading && <div style={{ textAlign: "center", padding: "3rem" }}><div className="spinner" style={{ margin: "0 auto" }} /></div>}
          {isError && <div className="alert alert-error">Failed to load courses.</div>}
          {!isLoading && courses.length === 0 && <p className="text-muted" style={{ textAlign: "center", padding: "3rem" }}>No courses published yet.</p>}
          <div className="grid-3">{courses.map(c => <CourseCard key={c.id} course={c} />)}</div>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--clr-border)", padding: "2rem 0", textAlign: "center" }}>
        <p className="text-muted">2025 LearnLMS. All rights reserved.</p>
      </footer>
    </div>
  );
}
