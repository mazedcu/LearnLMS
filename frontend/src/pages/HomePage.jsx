import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { coursesAPI } from "../api";
import Navbar from "../components/Navbar";
import { BookOpen, Zap, Shield, Award, ChevronRight, PlayCircle, MousePointerClick, FileText, HelpCircle, Video } from "lucide-react";

function CourseCard({ course }) {
  return (
    <Link to={`/courses/${course.slug}`} className="card course-card fade-in-up" style={{ textDecoration: "none" }}>
      <div className="card-thumb" style={{ minHeight: "180px", background: "var(--clr-surface)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {course.thumbnail ? <img src={course.thumbnail} alt={course.title} /> : <BookOpen size={48} color="rgba(255,255,255,0.2)" />}
      </div>
      <div className="card-body">
        <h4 style={{ marginBottom: "0.5rem", lineHeight: "1.3" }}>{course.title}</h4>
        <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: "1rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {course.short_description || "Explore this comprehensive course and enhance your skills with expert-led content."}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <span className="badge badge-primary">{course.lesson_count} lessons</span>
          <span style={{ fontWeight: 800, color: "var(--clr-accent)", fontSize: "1.1rem" }}>
            {course.is_free ? "Free" : `BDT ${course.price}`}
          </span>
        </div>
        {course.instructor_name && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingTop: "1rem", borderTop: "1px solid var(--clr-border)" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "linear-gradient(135deg, var(--clr-primary), var(--clr-accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold" }}>
              {course.instructor_name.charAt(0)}
            </div>
            <span className="text-muted" style={{ fontSize: "0.8rem", fontWeight: 500 }}>{course.instructor_name}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

const features = [
  { Icon: MousePointerClick, title: "Interactive Activities",  desc: "Engage with dynamic H5P modules, simulations, and hands-on exercises." },
  { Icon: FileText,          title: "Digital Notes",           desc: "Access comprehensive, structured digital notes for every single topic." },
  { Icon: HelpCircle,        title: "Practice Questions",      desc: "Test your knowledge with extensive quizzes, mock exams, and instant feedback." },
  { Icon: Video,             title: "Animated Explainer",      desc: "Understand complex concepts easily through high-quality animated videos." },
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
      
      {/* HERO SECTION */}
      <section className="section" style={{ position: "relative", overflow: "hidden", minHeight: "85vh", display: "flex", alignItems: "center" }}>
        {/* Abstract Background Glows */}
        <div style={{ position: "absolute", top: "20%", left: "10%", width: "40vw", height: "40vw", background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 60%)", borderRadius: "50%", filter: "blur(60px)", zIndex: -1 }}></div>
        <div style={{ position: "absolute", bottom: "10%", right: "5%", width: "35vw", height: "35vw", background: "radial-gradient(circle, rgba(45,212,191,0.1) 0%, transparent 60%)", borderRadius: "50%", filter: "blur(60px)", zIndex: -1 }}></div>
        
        <div className="container" style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <div className="badge badge-accent fade-in-up" style={{ marginBottom: "1.5rem" }}>Available Now !</div>
          <h1 className="fade-in-up delay-1" style={{ marginBottom: "1.5rem", maxWidth: "800px", margin: "0 auto 1.5rem" }}>
            Learn smarter with <br />
            <span className="gradient-text">effective method</span>
          </h1>
          <p className="fade-in-up delay-2" style={{ fontSize: "1.15rem", color: "var(--clr-muted)", maxWidth: "600px", margin: "0 auto 2.5rem", lineHeight: "1.7" }}>
            Experience the next generation of learning. Master your subjects with interactive activities, structured digital notes, extensive practice questions, and animated explainers in one beautiful platform.
          </p>
          <div className="fade-in-up delay-3" style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/register" className="btn btn-primary btn-lg">
              Start Learning Free <ChevronRight size={18} />
            </Link>
            <a href="#courses" className="btn btn-outline btn-lg">
              <PlayCircle size={18} style={{ marginRight: "0.25rem" }} /> Browse Courses
            </a>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="section" style={{ position: "relative", zIndex: 2 }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <h2 className="fade-in-up">Why Choose LearnwithHasan?</h2>
            <p className="text-muted fade-in-up delay-1" style={{ maxWidth: "500px", margin: "1rem auto 0" }}>Powerful features designed to enhance both teaching and learning experiences.</p>
          </div>
          <div className="grid-4">
            {features.map(({ Icon, title, desc }, idx) => (
              <div key={title} className={`glass fade-in-up delay-${(idx % 3) + 1}`} style={{ padding: "2rem", textAlign: "left" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(139,92,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <Icon size={24} color="var(--clr-primary)" />
                </div>
                <h4 style={{ marginBottom: "0.75rem" }}>{title}</h4>
                <p className="text-muted" style={{ fontSize: "0.9rem", lineHeight: "1.6" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COURSES SECTION */}
      <section className="section" id="courses" style={{ background: "rgba(255,255,255,0.01)", borderTop: "1px solid var(--clr-border)", borderBottom: "1px solid var(--clr-border)" }}>
        <div className="container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "3rem" }}>
            <div>
              <h2 className="fade-in-up">Popular Courses</h2>
              <p className="text-muted fade-in-up delay-1" style={{ marginTop: "0.5rem" }}>Join thousands of students learning new skills.</p>
            </div>
            <Link to="/courses" className="btn btn-outline btn-sm fade-in-up delay-2">View All</Link>
          </div>
          
          {isLoading && <div style={{ textAlign: "center", padding: "4rem" }}><div className="spinner" style={{ margin: "0 auto" }} /></div>}
          {isError && <div className="alert alert-error" style={{ maxWidth: "600px", margin: "0 auto" }}>Failed to load courses. Please try again later.</div>}
          {!isLoading && courses.length === 0 && (
            <div className="glass" style={{ textAlign: "center", padding: "4rem", maxWidth: "600px", margin: "0 auto" }}>
              <BookOpen size={48} color="var(--clr-muted)" style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
              <h4 style={{ marginBottom: "0.5rem" }}>No Courses Available</h4>
              <p className="text-muted">Check back soon for new content.</p>
            </div>
          )}
          
          <div className="grid-3">
            {courses.map((c, idx) => (
              <div key={c.id} style={{ animationDelay: `${idx * 0.1}s` }}>
                <CourseCard course={c} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="section">
        <div className="container">
          <div className="glass" style={{ padding: "4rem 2rem", textAlign: "center", background: "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(45,212,191,0.05))", borderColor: "rgba(139,92,246,0.2)" }}>
            <h2 style={{ marginBottom: "1rem" }}>Ready to Start Learning?</h2>
            <p className="text-muted" style={{ maxWidth: "500px", margin: "0 auto 2rem" }}>Create your free account today and get access to our library of premium courses.</p>
            <Link to="/register" className="btn btn-primary btn-lg">Create Free Account</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "3rem 0", textAlign: "center", borderTop: "1px solid var(--clr-border)", background: "var(--clr-surface)" }}>
        <div className="container">
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--clr-heading)" }}>Learnwith<span className="gradient-text">Hasan</span></span>
          </div>
          <p className="text-muted" style={{ fontSize: "0.9rem" }}>&copy; {new Date().getFullYear()} LearnwithHasan. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
