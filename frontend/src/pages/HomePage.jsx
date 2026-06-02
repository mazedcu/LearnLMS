import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { coursesAPI } from "../api";
import Navbar from "../components/Navbar";
import { BookOpen, ChevronRight, PlayCircle, MousePointerClick, FileText, HelpCircle, Video, Users, Award, TrendingUp, Star, ArrowRight, Sparkles } from "lucide-react";

function CourseCard({ course }) {
  return (
    <Link to={`/courses/${course.slug}`} className="card course-card fade-in-up" style={{ textDecoration: "none" }}>
      <div className="card-thumb" style={{ minHeight: "180px", background: "linear-gradient(135deg, #EEF2FF, #F5F3FF)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {course.thumbnail ? <img src={course.thumbnail} alt={course.title} /> : <BookOpen size={48} color="rgba(79,70,229,0.2)" />}
      </div>
      <div className="card-body">
        <h4 style={{ marginBottom: "0.5rem", lineHeight: "1.35", letterSpacing: "-0.02em" }}>{course.title}</h4>
        <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: "1rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: "1.6" }}>
          {course.short_description || "Explore this comprehensive course and enhance your skills with expert-led content."}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <span className="badge badge-primary">{course.lesson_count} lessons</span>
          <span style={{ fontWeight: 800, color: "var(--clr-primary)", fontSize: "1.05rem" }}>
            {course.is_free ? <span style={{ color: "var(--clr-success)" }}>Free</span> : `BDT ${course.price}`}
          </span>
        </div>
        {course.instructor_name && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingTop: "0.75rem", borderTop: "1px solid var(--clr-border)" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, #4F46E5, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold", color: "#fff" }}>
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
  { Icon: MousePointerClick, title: "Interactive Activities",  desc: "Engage with dynamic H5P modules, simulations, and hands-on exercises designed for deeper understanding.", color: "purple" },
  { Icon: FileText,          title: "Digital Notes",           desc: "Access comprehensive, structured digital notes for every topic — always available, perfectly organized.", color: "pink" },
  { Icon: HelpCircle,        title: "Practice Questions",      desc: "Test your knowledge with extensive quizzes, mock exams, and instant AI-powered feedback.", color: "green" },
  { Icon: Video,             title: "Animated Explainers",     desc: "Understand complex concepts through high-quality animated videos that make learning fun.", color: "amber" },
];

const featureColorMap = {
  purple: "feature-icon-purple",
  pink: "feature-icon-pink",
  green: "feature-icon-green",
  amber: "feature-icon-amber",
};

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
      <section className="section" style={{ position: "relative", overflow: "hidden", minHeight: "90vh", display: "flex", alignItems: "center" }}>
        {/* Background Orbs */}
        <div className="hero-gradient-orb" style={{ top: "5%", left: "5%", width: "45vw", height: "45vw", background: "radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 60%)" }}></div>
        <div className="hero-gradient-orb" style={{ bottom: "0%", right: "0%", width: "40vw", height: "40vw", background: "radial-gradient(circle, rgba(236,72,153,0.06) 0%, transparent 60%)" }}></div>
        <div className="hero-gradient-orb" style={{ top: "40%", right: "30%", width: "25vw", height: "25vw", background: "radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 60%)" }}></div>
        
        <div className="container" style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <div className="fade-in-up" style={{ marginBottom: "1.5rem", display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 1rem", borderRadius: "100px", background: "linear-gradient(135deg, rgba(79,70,229,0.08), rgba(236,72,153,0.08))", border: "1px solid rgba(79,70,229,0.12)", fontSize: "0.8rem", fontWeight: 600, color: "var(--clr-primary)" }}>
            <Sparkles size={14} /> Available Now — Start Learning Today
          </div>
          
          <h1 className="fade-in-up delay-1" style={{ marginBottom: "1.5rem", maxWidth: "720px", margin: "0 auto 1.5rem" }}>
            Learn smarter with{" "}
            <span className="gradient-text">effective method</span>
          </h1>
          
          <p className="fade-in-up delay-2" style={{ fontSize: "1.125rem", color: "var(--clr-muted)", maxWidth: "560px", margin: "0 auto 2.5rem", lineHeight: "1.75" }}>
            Master your subjects with interactive activities, structured notes, practice questions, and animated explainers — all in one beautiful platform.
          </p>
          
          <div className="fade-in-up delay-3" style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/register" className="btn btn-primary btn-lg">
              Start Learning Free <ChevronRight size={18} />
            </Link>
            <a href="#courses" className="btn btn-outline btn-lg">
              <PlayCircle size={18} /> Browse Courses
            </a>
          </div>

          {/* Stats Strip */}
          <div className="hero-stats fade-in-up delay-4">
            <div className="hero-stat">
              <div className="hero-stat-value">500+</div>
              <div className="hero-stat-label">Active Students</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">50+</div>
              <div className="hero-stat-label">Lessons</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">4.9</div>
              <div className="hero-stat-label">Average Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="section" style={{ position: "relative", zIndex: 2 }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <div className="badge badge-primary fade-in-up" style={{ marginBottom: "1rem" }}>Features</div>
            <h2 className="fade-in-up delay-1">Why Choose LearnwithHasan?</h2>
            <p className="text-muted fade-in-up delay-2" style={{ maxWidth: "480px", margin: "1rem auto 0", lineHeight: "1.7" }}>Powerful features designed to make learning effective, engaging, and enjoyable.</p>
          </div>
          <div className="grid-4">
            {features.map(({ Icon, title, desc, color }, idx) => (
              <div key={title} className={`feature-card fade-in-up delay-${(idx % 4) + 1}`}>
                <div className={`feature-icon ${featureColorMap[color]}`}>
                  <Icon size={24} />
                </div>
                <h4 style={{ marginBottom: "0.5rem" }}>{title}</h4>
                <p className="text-muted" style={{ fontSize: "0.875rem", lineHeight: "1.65" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COURSES SECTION */}
      <section className="section" id="courses" style={{ background: "#fff", borderTop: "1px solid var(--clr-border)", borderBottom: "1px solid var(--clr-border)" }}>
        <div className="container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "3rem", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div className="badge badge-accent fade-in-up" style={{ marginBottom: "0.75rem" }}>Courses</div>
              <h2 className="fade-in-up delay-1">Popular Courses</h2>
              <p className="text-muted fade-in-up delay-2" style={{ marginTop: "0.5rem" }}>Join hundreds of students learning new skills every day.</p>
            </div>
            <Link to="/courses" className="btn btn-outline btn-sm fade-in-up delay-2">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          
          {isLoading && <div style={{ textAlign: "center", padding: "4rem" }}><div className="spinner" style={{ margin: "0 auto" }} /></div>}
          {isError && <div className="alert alert-error" style={{ maxWidth: "600px", margin: "0 auto" }}>Failed to load courses. Please try again later.</div>}
          {!isLoading && courses.length === 0 && (
            <div className="glass" style={{ textAlign: "center", padding: "4rem", maxWidth: "600px", margin: "0 auto" }}>
              <BookOpen size={48} color="var(--clr-muted)" style={{ margin: "0 auto 1rem", opacity: 0.4 }} />
              <h4 style={{ marginBottom: "0.5rem" }}>No Courses Available Yet</h4>
              <p className="text-muted">We're preparing amazing content. Check back soon!</p>
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
          <div className="cta-section">
            <h2 style={{ marginBottom: "1rem", fontSize: "2rem" }}>Ready to Start Learning?</h2>
            <p style={{ maxWidth: "460px", margin: "0 auto 2rem", fontSize: "1.05rem" }}>Create your free account today and unlock access to our entire library of premium courses and resources.</p>
            <Link to="/register" className="btn btn-lg">
              Get Started Free <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container">
          <div className="footer-brand">
            <BookOpen size={20} color="var(--clr-primary)" />
            Learnwith<span className="gradient-text">Hasan</span>
          </div>
          <p className="text-muted" style={{ fontSize: "0.85rem" }}>&copy; {new Date().getFullYear()} LearnwithHasan. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
