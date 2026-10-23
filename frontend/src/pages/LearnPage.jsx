import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assessmentsAPI, coursesAPI, lessonsAPI } from "../api";
import Navbar from "../components/Navbar";
import { Lock, CheckCircle, Circle, ChevronRight, RotateCcw, Award, Menu, X } from "lucide-react";
import QuizPlayer from "../components/quiz/QuizPlayer";
import { useAuth } from "../context/AuthContext";
import { BlockRenderer } from "../components/lesson/LessonBlocks";

// ── Native Quiz Block ─────────────────────────────────────────────────────
function NativeQuizBlock({ lessonId, slug }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [result, setResult] = useState(null);

  const { data: quizzes, isLoading, error } = useQuery({
    queryKey: ["quizzes", lessonId],
    queryFn: () => assessmentsAPI.listQuizzes(lessonId).then(r => r.data),
    enabled: !!user,
    retry: false,
  });

  if (isLoading || error) return null;
  const qs = Array.isArray(quizzes) ? quizzes : (quizzes?.results || []);
  if (qs.length === 0) return null;

  if (activeQuiz) {
    return (
      <div style={{ marginTop: "2rem" }}>
        <QuizPlayer
          quiz={activeQuiz}
          onFinish={(data) => {
            setResult({ ...data, quiz: activeQuiz });
            setActiveQuiz(null);
            // Attempts, best score and quiz-score unlocks have changed
            queryClient.invalidateQueries({ queryKey: ["quizzes", lessonId] });
            queryClient.invalidateQueries({ queryKey: ["lesson-status", slug] });
          }}
        />
      </div>
    );
  }

  if (result) {
    const passMark = result.passing_score ?? result.quiz?.passing_score ?? 70;
    const isPassed = result.passed ?? (result.score_percent >= passMark);
    const attemptsLeft = result.attempts_left;
    const canRetry = attemptsLeft === null || attemptsLeft === undefined || attemptsLeft > 0;
    return (
      <div className="glass" style={{ padding: "2rem", marginTop: "2rem", textAlign: "center" }}>
        <Award size={48} color={isPassed ? "var(--clr-success)" : "var(--clr-warning)"} style={{ margin: "0 auto 1rem" }} />
        <h2>Quiz Result: {result.score_percent}%</h2>
        <p className="text-muted" style={{ marginBottom: "0.5rem" }}>
          You scored {result.score} out of {result.total_marks}. Pass mark: {passMark}%.
        </p>
        <p style={{ marginBottom: "1.5rem", fontWeight: 600, color: isPassed ? "var(--clr-success)" : "var(--clr-warning)" }}>
          {isPassed ? "Congratulations, you passed!" : "You did not reach the pass mark."}
        </p>
        {canRetry ? (
          <button className="btn btn-outline" onClick={() => setResult(null)}>
            <RotateCcw size={14} /> {attemptsLeft != null ? `Try Again (${attemptsLeft} left)` : "Try Again"}
          </button>
        ) : (
          <>
            <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>You have used all your attempts for this quiz.</p>
            <button className="btn btn-outline" onClick={() => setResult(null)}>Back to quizzes</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: "2rem" }}>
      <h3 style={{ marginBottom: "1.25rem" }}>Assessments</h3>
      {qs.map(quiz => {
        const outOfAttempts = quiz.attempts_left === 0;
        return (
          <div key={quiz.id} className="glass" style={{ padding: "1.5rem", marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{quiz.title}</p>
              <p className="text-muted" style={{ fontSize: "0.8rem" }}>
                {quiz.questions?.length || 0} Questions · Pass mark: {quiz.passing_score}%
                {quiz.time_limit_mins ? ` · ${quiz.time_limit_mins} min` : ""}
                {quiz.attempts_left != null ? ` · ${quiz.attempts_left} attempt${quiz.attempts_left === 1 ? "" : "s"} left` : ""}
              </p>
              {quiz.best_score_percent != null && (
                <p style={{ fontSize: "0.8rem", marginTop: "0.25rem", color: quiz.best_score_percent >= quiz.passing_score ? "var(--clr-success)" : "var(--clr-muted)" }}>
                  Best score: {quiz.best_score_percent}%{quiz.best_score_percent >= quiz.passing_score ? " · Passed" : ""}
                </p>
              )}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setActiveQuiz(quiz)} disabled={outOfAttempts}>
              {outOfAttempts ? "No attempts left" : quiz.attempts_used ? "Retake Quiz" : "Start Quiz"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Sidebar Lesson List ────────────────────────────────────────────────────
function LessonIcon({ active, state }) {
  if (active) return <ChevronRight size={14} />;
  if (state?.completed) return <CheckCircle size={14} color="var(--clr-success)" />;
  if (state && !state.accessible) return <Lock size={14} color="var(--clr-muted)" />;
  return <Circle size={14} color="var(--clr-muted)" />;
}

function Sidebar({ modules, activeLessonId, onSelect, isMobileOpen, onMobileClose, status }) {
  const lessonState = status?.lessons || {};
  const percent = status?.enrolled ? Math.round(status.percent_complete || 0) : null;
  return (
    <aside
      className={`lesson-sidebar${isMobileOpen ? " open" : ""}`}
      style={{ width: "280px", minWidth: "280px", borderRight: "1px solid var(--clr-border)", overflowY: "auto", padding: "1rem 0", background: "var(--clr-bg, #fff)" }}
    >
      <button
        onClick={onMobileClose}
        aria-label="Close lesson list"
        style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: "none", border: "none", cursor: "pointer", padding: "0.5rem", display: "none" }}
        className="mobile-close-btn"
      >
        <X size={18} />
      </button>
      <div style={{ padding: "0 1rem 1rem", borderBottom: "1px solid var(--clr-border)" }}>
        <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--clr-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Course Content</p>
        {percent !== null && (
          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--clr-muted)", marginBottom: "0.375rem" }}>
              <span>Your progress</span><span>{percent}%</span>
            </div>
            <div className="progress-bar-wrap"><div className="progress-bar-fill" style={{ width: `${percent}%` }} /></div>
          </div>
        )}
      </div>
      {modules.map(mod => (
        <div key={mod.id}>
          <div style={{ padding: "0.75rem 1rem", background: "var(--clr-surface)", borderBottom: "1px solid var(--clr-border)" }}>
            <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--clr-muted)" }}>{mod.title}</p>
          </div>
          {(mod.lessons || []).map(l => {
            const active = l.id === activeLessonId;
            const state = lessonState[l.id];
            const locked = state && !state.accessible;
            return (
              <button
                key={l.id}
                onClick={() => onSelect(l.id)}
                title={locked ? state.lock?.message : undefined}
                style={{ width: "100%", textAlign: "left", padding: "0.75rem 1rem 0.75rem 1.5rem", display: "flex", alignItems: "center", gap: "0.625rem", background: active ? "rgba(108,99,255,0.1)" : "transparent", borderBottom: "1px solid var(--clr-border)", color: active ? "var(--clr-primary)" : locked ? "var(--clr-muted)" : "var(--clr-text)", fontSize: "0.875rem", fontWeight: active ? 600 : 400, transition: "all 0.15s" }}
              >
                <LessonIcon active={active} state={state} />
                <span style={{ flex: 1 }}>{l.title}</span>
                {l.is_preview && !status?.enrolled && <span className="badge badge-primary" style={{ fontSize: "0.65rem" }}>Preview</span>}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

// ── Main LearnPage ─────────────────────────────────────────────────────────
export default function LearnPage() {
  const { slug, lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["lesson-status", slug, user?.id ?? null],
    queryFn: () => lessonsAPI.courseStatus(slug).then(r => r.data),
  });

  const { data: courseData } = useQuery({
    queryKey: ["course-learn", slug],
    queryFn: () => coursesAPI.detail(slug).then(r => r.data),
  });

  const [activeId, setActiveId] = useState(lessonId || null);

  const allLessons = (courseData?.modules || []).flatMap(m => m.lessons || []);
  const firstLesson = allLessons[0];
  const currentId = activeId || (firstLesson?.id);

  const { data: blocks } = useQuery({
    queryKey: ["blocks", currentId],
    queryFn: () => currentId ? lessonsAPI.blocks(currentId).then(r => Array.isArray(r.data) ? r.data : r.data?.results || []) : Promise.resolve([]),
    enabled: !!currentId,
  });

  const completeMutation = useMutation({
    mutationFn: () => lessonsAPI.complete(currentId),
    onSuccess: () => {
      // Completion can change progress, unlock later lessons and issue a certificate
      queryClient.invalidateQueries({ queryKey: ["lesson-status", slug] });
      queryClient.invalidateQueries({ queryKey: ["my-enr"] });
      queryClient.invalidateQueries({ queryKey: ["my-certs"] });
    },
  });

  const currentLesson = allLessons.find(l => l.id === currentId);
  const currentIndex  = allLessons.findIndex(l => l.id === currentId);
  const nextLesson    = allLessons[currentIndex + 1];

  const currentState = status?.lessons?.[currentId];
  const isCompleted = !!currentState?.completed;
  const lockInfo = currentState && !currentState.accessible ? currentState.lock : null;

  const handleSelect = (id) => {
    setActiveId(id);
    setSidebarOpen(false);
    completeMutation.reset();
    navigate(`/learn/${slug}/${id}`, { replace: true });
  };

  if (!courseData) return <><Navbar /><div className="loading-screen"><div className="spinner" /></div></>;

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <Navbar />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div 
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 998,
              display: "none"
            }}
            className="mobile-sidebar-overlay"
          />
        )}
        
        <Sidebar
          modules={courseData.modules || []}
          activeLessonId={currentId}
          onSelect={handleSelect}
          isMobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
          status={status}
        />
        <main style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>
          <button className="learn-lessons-btn" onClick={() => setSidebarOpen(true)} aria-label="Show lessons">
            <Menu size={16} /> Lessons
            {status?.enrolled && <span className="text-muted" style={{ fontWeight: 500, fontSize: "0.78rem" }}>· {Math.round(status.percent_complete || 0)}%</span>}
          </button>
          {currentLesson && (
            <>
              <div style={{ marginBottom: "1.5rem" }}>
                <h2 style={{ marginBottom: "0.25rem" }}>{currentLesson.title}</h2>
                {currentLesson.estimated_duration_mins > 0 && <p className="text-muted" style={{ fontSize: "0.8rem" }}>{currentLesson.estimated_duration_mins} min</p>}
              </div>

              {(lockInfo || (!user && !currentLesson.is_preview) || (blocks?.length === 0 && !currentLesson.is_preview && user && !currentState)) ? (
                <div className="glass" style={{ padding: "3rem 2rem", textAlign: "center", marginTop: "2rem" }}>
                  <Lock size={48} color="var(--clr-muted)" style={{ margin: "0 auto 1rem" }} />
                  <h3>This lesson is locked</h3>
                  <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
                    {lockInfo?.message || (user
                      ? "You need to enroll in this course or unlock previous lessons to access this content."
                      : "Please sign in and enroll to access this lesson.")}
                  </p>
                  {(!user || lockInfo?.reason === "login") && (
                    <button className="btn btn-primary" onClick={() => navigate("/login")}>Sign in</button>
                  )}
                  {user && lockInfo?.reason === "enroll" && (
                    <button className="btn btn-primary" onClick={() => navigate(`/courses/${slug}`)}>View course &amp; enroll</button>
                  )}
                  {lockInfo?.required_lesson && allLessons.some(l => l.id === lockInfo.required_lesson) && (
                    <button className="btn btn-outline" onClick={() => handleSelect(lockInfo.required_lesson)}>
                      Go to required lesson <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    {(blocks || []).map(b => (
                      <div key={b.id}>
                        {b.title && b.block_type !== "html" && b.block_type !== "h5p" && <h4 style={{ marginBottom: "0.75rem" }}>{b.title}</h4>}
                        <BlockRenderer block={b} />
                      </div>
                    ))}
                  </div>

                  <NativeQuizBlock lessonId={currentId} slug={slug} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--clr-border)" }}>
                    {user ? (
                      (isCompleted || completeMutation.isSuccess) ? (
                        <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 0.875rem" }}>
                          <CheckCircle size={16} /> Completed
                        </span>
                      ) : (
                        <button className="btn btn-accent" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending || !status?.enrolled}
                          title={!status?.enrolled ? "Enroll in the course to track progress" : undefined}>
                          <CheckCircle size={16} /> {completeMutation.isPending ? "Saving…" : "Mark as Complete"}
                        </button>
                      )
                    ) : (
                      <button className="btn btn-outline" disabled>
                        Sign in to mark as complete
                      </button>
                    )}
                    {nextLesson && (
                      <button className="btn btn-outline" onClick={() => handleSelect(nextLesson.id)}>
                        Next: {nextLesson.title} <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
