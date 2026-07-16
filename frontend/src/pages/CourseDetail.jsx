import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { coursesAPI } from "../api";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import { BookOpen, Clock, Lock, ChevronDown, ChevronUp, CheckCircle, Eye } from "lucide-react";
import { useState } from "react";

function ModuleItem({ mod, isEnrolled, isAdmin, slug }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="module-item" style={{ border: "1px solid var(--clr-border)", borderRadius: "var(--radius-sm)", marginBottom: "0.75rem", overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", background: "var(--clr-card)", color: "var(--clr-heading)", fontWeight: 600, fontSize: "0.95rem" }}>
        <span>{mod.title}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div style={{ background: "var(--clr-surface)" }}>
          {(mod.lessons || []).map(l => {
            const isAccessible = l.is_preview || isEnrolled || isAdmin;
            const Component = isAccessible ? Link : "div";
            return (
              <Component 
                key={l.id} 
                to={isAccessible ? `/learn/${slug}/${l.id}` : undefined}
                className="lesson-item"
                style={{ 
                  display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1.25rem", 
                  borderTop: "1px solid var(--clr-border)", textDecoration: "none", color: "inherit",
                  cursor: isAccessible ? "pointer" : "default" 
                }}
              >
                {isAccessible ? <CheckCircle size={14} color="var(--clr-success)" /> : <Lock size={14} color="var(--clr-muted)" />}
                <span style={{ fontSize: "0.875rem", color: isAccessible ? "var(--clr-text)" : "var(--clr-muted)" }}>{l.title}</span>
                {l.estimated_duration_mins > 0 && <span className="text-muted" style={{ fontSize: "0.75rem", marginLeft: "auto" }}>{l.estimated_duration_mins}m</span>}
              </Component>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CourseDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: course, isLoading } = useQuery({
    queryKey: ["course", slug],
    queryFn: () => coursesAPI.detail(slug).then(r => r.data),
  });

  const enrollMutation = useMutation({
    mutationFn: () => coursesAPI.enroll(slug),
    onSuccess: () => navigate(`/learn/${slug}`),
  });

  if (isLoading) return <><Navbar /><div className="loading-screen"><div className="spinner" /></div></>;
  if (!course) return <><Navbar /><p style={{ textAlign: "center", padding: "4rem" }}>Course not found.</p></>;

  const isEnrolled = course.is_enrolled;

  return (
    <div className="page">
      <Navbar />
      <div style={{ background: "linear-gradient(135deg, var(--clr-surface), var(--clr-bg))", borderBottom: "1px solid var(--clr-border)", padding: "4rem 0 3rem" }}>
        <div className="container course-detail-header" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "3rem", alignItems: "start" }}>
          <div>
            <span className="badge badge-primary" style={{ marginBottom: "1rem" }}>Course</span>
            <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>{course.title}</h1>
            <p style={{ color: "var(--clr-muted)", marginBottom: "1.5rem", lineHeight: "1.7" }}>{course.short_description || course.description}</p>
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              <span className="text-muted"><BookOpen size={14} style={{ verticalAlign: "middle" }} /> {course.lesson_count} lessons</span>
              {course.instructor_name && <span className="text-muted">by {course.instructor_name}</span>}
            </div>
          </div>
          <div className="card course-card" style={{ position: "sticky", top: "80px" }}>
            {course.thumbnail && <img src={course.thumbnail} alt={course.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover" }} />}
            <div className="card-body">
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--clr-accent)", marginBottom: "1.25rem" }}>
                {course.is_free ? "Free" : `BDT ${course.price}`}
              </div>
              {isEnrolled ? (
                <Link to={`/learn/${slug}`} className="btn btn-accent" style={{ width: "100%", justifyContent: "center" }}>Continue Learning</Link>
              ) : user?.role === 'admin' ? (
                <Link to={`/learn/${slug}`} className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                  <Eye size={16} /> Preview as Admin
                </Link>
              ) : course.is_free ? (
                <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending}>
                  {enrollMutation.isPending ? "Enrolling..." : "Enroll for Free"}
                </button>
              ) : (
                <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => navigate(`/checkout/${slug}`)}>
                  Buy Course
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container section" style={{ paddingTop: "3rem" }}>
        <h2 style={{ marginBottom: "1.5rem" }}>Course Content</h2>
        {(course.modules || []).map(mod => (
          <ModuleItem 
            key={mod.id} 
            mod={mod} 
            isEnrolled={isEnrolled} 
            isAdmin={user?.role === "admin"} 
            slug={slug} 
          />
        ))}
      </div>
    </div>
  );
}
