import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { coursesAPI } from "../api";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import {
  BookOpen, Clock, Lock, ChevronDown, ChevronUp,
  CheckCircle, Eye, Users, PlayCircle, Award,
  Star, ShieldCheck, Zap, Globe,
} from "lucide-react";
import { useState } from "react";

/* ── Lesson row inside accordion ──────────────────────────────── */
function LessonRow({ lesson, isAccessible, slug }) {
  const Wrap = isAccessible ? Link : "div";
  return (
    <Wrap
      to={isAccessible ? `/learn/${slug}/${lesson.id}` : undefined}
      style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        padding: "0.75rem 1.5rem",
        borderTop: "1px solid #F3F4F6",
        textDecoration: "none", color: "inherit",
        cursor: isAccessible ? "pointer" : "default",
        background: "#fff",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => { if (isAccessible) e.currentTarget.style.background = "#F9FAFB"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
    >
      {/* Icon */}
      <div style={{
        width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isAccessible ? "rgba(79,70,229,0.08)" : "#F3F4F6",
      }}>
        {isAccessible
          ? <PlayCircle size={15} color="#4F46E5" />
          : <Lock size={13} color="#9CA3AF" />}
      </div>

      {/* Title */}
      <span style={{
        flex: 1, fontSize: "0.875rem", fontWeight: 500,
        color: isAccessible ? "#374151" : "#9CA3AF",
      }}>
        {lesson.title}
      </span>

      {/* Preview badge */}
      {lesson.is_preview && !isAccessible && (
        <span style={{
          fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px",
          borderRadius: "100px", background: "rgba(16,185,129,0.1)",
          color: "#059669", border: "1px solid rgba(16,185,129,0.2)",
        }}>PREVIEW</span>
      )}

      {/* Duration */}
      {lesson.estimated_duration_mins > 0 && (
        <span style={{ fontSize: "0.75rem", color: "#9CA3AF", whiteSpace: "nowrap" }}>
          {lesson.estimated_duration_mins}m
        </span>
      )}
    </Wrap>
  );
}

/* ── Module accordion ─────────────────────────────────────────── */
function ModuleAccordion({ mod, index, isEnrolled, isAdmin, slug }) {
  const [open, setOpen] = useState(index === 0);
  const lessons = mod.lessons || [];
  const totalMins = lessons.reduce((s, l) => s + (l.estimated_duration_mins || 0), 0);

  return (
    <div style={{
      border: "1px solid #E5E7EB", borderRadius: "12px",
      overflow: "hidden", marginBottom: "0.75rem",
      boxShadow: open ? "0 4px 16px rgba(0,0,0,0.06)" : "none",
      transition: "box-shadow 0.2s",
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          gap: "1rem", padding: "1.1rem 1.5rem",
          background: open ? "linear-gradient(135deg,#F5F3FF,#EEF2FF)" : "#FAFAFA",
          border: "none", cursor: "pointer",
          transition: "background 0.2s",
        }}
      >
        {/* Module number */}
        <div style={{
          width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0,
          background: open ? "var(--clr-primary,#4F46E5)" : "#E5E7EB",
          color: open ? "#fff" : "#6B7280",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.8rem", fontWeight: 800,
          transition: "all 0.2s",
        }}>
          {index + 1}
        </div>

        {/* Title + meta */}
        <div style={{ flex: 1, textAlign: "left" }}>
          <p style={{
            fontWeight: 700, fontSize: "0.95rem",
            color: open ? "#4F46E5" : "#111827", margin: 0,
          }}>
            {mod.title}
          </p>
          <p style={{ fontSize: "0.75rem", color: "#9CA3AF", margin: "2px 0 0" }}>
            {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
            {totalMins > 0 && ` · ${totalMins}m`}
          </p>
        </div>

        {/* Chevron */}
        <div style={{
          color: open ? "#4F46E5" : "#9CA3AF",
          transition: "transform 0.2s",
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
        }}>
          <ChevronDown size={18} />
        </div>
      </button>

      {/* Lessons */}
      {open && (
        <div>
          {lessons.length === 0 ? (
            <p style={{ padding: "1rem 1.5rem", fontSize: "0.85rem", color: "#9CA3AF" }}>
              No lessons yet.
            </p>
          ) : (
            lessons.map(l => (
              <LessonRow
                key={l.id}
                lesson={l}
                isAccessible={l.is_preview || isEnrolled || isAdmin}
                slug={slug}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ── Stat pill ────────────────────────────────────────────────── */
function StatPill({ icon: Icon, label }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.4rem",
      padding: "0.4rem 0.85rem", borderRadius: "100px",
      background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)",
      border: "1px solid rgba(255,255,255,0.2)",
    }}>
      <Icon size={13} color="rgba(255,255,255,0.9)" />
      <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>
        {label}
      </span>
    </div>
  );
}

/* ── Feature bullet ───────────────────────────────────────────── */
function Feature({ icon: Icon, color, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
      <div style={{
        width: "30px", height: "30px", borderRadius: "8px", flexShrink: 0,
        background: `${color}18`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={15} color={color} />
      </div>
      <span style={{ fontSize: "0.875rem", color: "#374151" }}>{text}</span>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function CourseDetail() {
  const { slug }   = useParams();
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const { data: course, isLoading } = useQuery({
    queryKey: ["course", slug],
    queryFn: () => coursesAPI.detail(slug).then(r => r.data),
  });

  const enrollMutation = useMutation({
    mutationFn: () => coursesAPI.enroll(slug),
    onSuccess: () => navigate(`/learn/${slug}`),
  });

  if (isLoading) return <><Navbar /><div className="loading-screen"><div className="spinner" /></div></>;
  if (!course)   return <><Navbar /><p style={{ textAlign: "center", padding: "4rem" }}>Course not found.</p></>;

  const isEnrolled = course.is_enrolled;
  const isAdmin    = user?.role === "admin";
  const modules    = course.modules || [];
  const totalLessons = modules.reduce((s, m) => s + (m.lessons?.length || 0), 0);
  const totalMins    = modules.reduce((s, m) =>
    s + (m.lessons || []).reduce((ss, l) => ss + (l.estimated_duration_mins || 0), 0), 0);
  const visibleModules = showAll ? modules : modules.slice(0, 4);

  return (
    <div className="page">
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4C1D95 100%)",
        padding: "4rem 0 3rem",
        position: "relative", overflow: "hidden",
      }}>
        {/* Decorative blobs */}
        <div style={{
          position: "absolute", top: "-80px", right: "-80px",
          width: "360px", height: "360px", borderRadius: "50%",
          background: "rgba(99,102,241,0.15)", filter: "blur(60px)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "-60px", left: "10%",
          width: "240px", height: "240px", borderRadius: "50%",
          background: "rgba(236,72,153,0.1)", filter: "blur(50px)",
          pointerEvents: "none",
        }} />

        <div className="container" style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: "3rem", alignItems: "start",
          position: "relative", zIndex: 1,
        }}>
          {/* Left: text */}
          <div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
              <span style={{
                padding: "0.3rem 0.9rem", borderRadius: "100px",
                background: "rgba(99,102,241,0.3)", border: "1px solid rgba(99,102,241,0.5)",
                color: "#C7D2FE", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em",
              }}>COURSE</span>
              {course.language && (
                <span style={{
                  padding: "0.3rem 0.9rem", borderRadius: "100px",
                  background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                  color: "rgba(255,255,255,0.8)", fontSize: "0.75rem", fontWeight: 600,
                  display: "flex", alignItems: "center", gap: "0.3rem",
                }}>
                  <Globe size={11} /> {course.language}
                </span>
              )}
            </div>

            <h1 style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
              fontWeight: 800, color: "#fff", lineHeight: 1.25,
              marginBottom: "1.1rem", letterSpacing: "-0.02em",
            }}>
              {course.title}
            </h1>

            <p style={{
              color: "rgba(255,255,255,0.75)", fontSize: "1.05rem",
              lineHeight: 1.7, marginBottom: "1.75rem", maxWidth: "600px",
            }}>
              {course.short_description || course.description?.slice(0, 180)}
            </p>

            {/* Stats pills */}
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
              <StatPill icon={BookOpen} label={`${totalLessons} lessons`} />
              {totalMins > 0 && <StatPill icon={Clock} label={`${Math.round(totalMins / 60 * 10) / 10}h total`} />}
              {course.instructor_name && <StatPill icon={Users} label={`By ${course.instructor_name}`} />}
              <StatPill icon={Award} label="Certificate" />
            </div>

            {/* Instructor */}
            {course.instructor_name && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: "linear-gradient(135deg,#6366F1,#EC4899)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 800, fontSize: "1rem",
                }}>
                  {course.instructor_name[0].toUpperCase()}
                </div>
                <div>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", margin: 0 }}>Instructor</p>
                  <p style={{ color: "#fff", fontWeight: 600, fontSize: "0.9rem", margin: 0 }}>
                    {course.instructor_name}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right: enrollment card */}
          <div style={{
            background: "#fff", borderRadius: "20px",
            overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
            position: "sticky", top: "80px",
          }}>
            {/* Thumbnail */}
            {course.thumbnail ? (
              <div style={{ aspectRatio: "16/9", overflow: "hidden" }}>
                <img src={course.thumbnail} alt={course.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            ) : (
              <div style={{
                aspectRatio: "16/9",
                background: "linear-gradient(135deg,#4F46E5,#7C3AED,#EC4899)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <BookOpen size={48} color="rgba(255,255,255,0.4)" />
              </div>
            )}

            <div style={{ padding: "1.5rem" }}>
              {/* Price */}
              <div style={{ marginBottom: "1.1rem" }}>
                <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#111827", lineHeight: 1 }}>
                  {course.is_free ? (
                    <span style={{ color: "#059669" }}>Free</span>
                  ) : (
                    <>
                      <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "#6B7280" }}>BDT </span>
                      <span style={{ color: "#EC4899" }}>{course.price}</span>
                    </>
                  )}
                </div>
                {!course.is_free && (
                  <p style={{ fontSize: "0.75rem", color: "#9CA3AF", marginTop: "4px" }}>
                    One-time payment · Lifetime access
                  </p>
                )}
              </div>

              {/* CTA button */}
              {isEnrolled ? (
                <Link to={`/learn/${slug}`} className="btn btn-accent btn-lg"
                  style={{ width: "100%", justifyContent: "center", marginBottom: "0.75rem" }}>
                  <PlayCircle size={18} /> Continue Learning
                </Link>
              ) : isAdmin ? (
                <Link to={`/learn/${slug}`} className="btn btn-primary btn-lg"
                  style={{ width: "100%", justifyContent: "center", marginBottom: "0.75rem" }}>
                  <Eye size={18} /> Preview as Admin
                </Link>
              ) : course.is_free ? (
                <button className="btn btn-primary btn-lg"
                  style={{ width: "100%", justifyContent: "center", marginBottom: "0.75rem" }}
                  onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending}>
                  {enrollMutation.isPending ? "Enrolling…" : "Enroll for Free →"}
                </button>
              ) : (
                <button className="btn btn-primary btn-lg"
                  style={{ width: "100%", justifyContent: "center", marginBottom: "0.75rem" }}
                  onClick={() => navigate(`/checkout/${slug}`)}>
                  Buy Course →
                </button>
              )}

              {/* Features list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "1rem" }}>
                <Feature icon={PlayCircle}   color="#4F46E5" text={`${totalLessons} on-demand lessons`} />
                {totalMins > 0 && <Feature icon={Clock} color="#7C3AED" text={`${Math.round(totalMins)} minutes of content`} />}
                <Feature icon={ShieldCheck}  color="#059669" text="Lifetime access" />
                <Feature icon={Award}        color="#EC4899" text="Certificate of completion" />
                <Feature icon={Zap}          color="#F59E0B" text="Learn at your own pace" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Full Description ──────────────────────────────────── */}
      {course.description && (
        <div style={{ borderBottom: "1px solid #F3F4F6", padding: "3rem 0" }}>
          <div className="container" style={{ maxWidth: "760px" }}>
            <h2 style={{ marginBottom: "1.25rem", fontSize: "1.4rem" }}>About this course</h2>
            <p style={{
              color: "#374151", lineHeight: 1.85, fontSize: "0.95rem",
              whiteSpace: "pre-line",
            }}>
              {course.description}
            </p>
          </div>
        </div>
      )}

      {/* ── Course Curriculum ─────────────────────────────────── */}
      <div style={{ padding: "3rem 0 5rem" }}>
        <div className="container">
          {/* Section header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: "2rem", flexWrap: "wrap", gap: "1rem",
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Course Curriculum</h2>
              <p style={{ color: "#6B7280", fontSize: "0.85rem", marginTop: "4px" }}>
                {modules.length} module{modules.length !== 1 ? "s" : ""} · {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
                {totalMins > 0 && ` · ${totalMins} min total`}
              </p>
            </div>
            {!isEnrolled && !isAdmin && (
              <div style={{
                padding: "0.6rem 1.1rem", borderRadius: "10px",
                background: "rgba(79,70,229,0.06)", border: "1px solid rgba(79,70,229,0.15)",
                display: "flex", alignItems: "center", gap: "0.5rem",
              }}>
                <Lock size={14} color="#4F46E5" />
                <span style={{ fontSize: "0.8rem", color: "#4F46E5", fontWeight: 600 }}>
                  Enroll to unlock all lessons
                </span>
              </div>
            )}
          </div>

          {/* Module list */}
          {modules.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "3rem",
              border: "2px dashed #E5E7EB", borderRadius: "16px",
            }}>
              <BookOpen size={40} color="#D1D5DB" style={{ margin: "0 auto 1rem" }} />
              <p style={{ color: "#9CA3AF" }}>No modules available yet.</p>
            </div>
          ) : (
            <>
              {visibleModules.map((mod, i) => (
                <ModuleAccordion
                  key={mod.id} mod={mod} index={i}
                  isEnrolled={isEnrolled} isAdmin={isAdmin} slug={slug}
                />
              ))}

              {modules.length > 4 && (
                <button
                  onClick={() => setShowAll(s => !s)}
                  className="btn btn-outline"
                  style={{ width: "100%", marginTop: "0.5rem", justifyContent: "center" }}
                >
                  {showAll
                    ? <><ChevronUp size={16} /> Show less</>
                    : <><ChevronDown size={16} /> Show all {modules.length} modules</>}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
