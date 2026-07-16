import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { assessmentsAPI, coursesAPI, lessonsAPI } from "../api";
import Navbar from "../components/Navbar";
import { Lock, CheckCircle, Maximize, Minimize, ChevronRight, RotateCcw, AlertTriangle, Timer, Award, Menu, X } from "lucide-react";
import QuizPlayer from "../components/quiz/QuizPlayer";
import { useAuth } from "../context/AuthContext";

// ── HTML Block ─────────────────────────────────────────────────────────────
function HTMLBlock({ block }) {
  const [fs, setFs] = useState(false);
  const ref = useRef(null);

  const toggleFs = () => {
    if (!fs) { ref.current?.requestFullscreen?.(); setFs(true); }
    else { document.exitFullscreen?.(); setFs(false); }
  };

  const rawSrc = block.file;
  let src = rawSrc && rawSrc.startsWith('http')
    ? new URL(rawSrc).pathname
    : rawSrc;
    
  if (src) {
    src = src + "?v=" + new Date().getTime();
  }

  const srcDoc = !src
    ? `<!DOCTYPE html><html><head><meta charset='UTF-8'><style>body{font-family:system-ui,sans-serif;padding:1.5rem;line-height:1.7;color:#1a1a1a;margin:0}img{max-width:100%}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}</style></head><body>${block.html_content}</body></html>`
    : null;

  const sandbox = src
    ? "allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"
    : "allow-same-origin allow-scripts";

  return (
    <div style={{ position: "relative", border: "1px solid var(--clr-border)", borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 1rem", background: "var(--clr-surface)", borderBottom: "1px solid var(--clr-border)" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--clr-muted)" }}>{block.title || (src ? "HTML File" : "HTML Content")}</span>
        <button onClick={toggleFs} className="btn btn-sm btn-outline" title={fs ? "Exit Fullscreen" : "Fullscreen"}>
          {fs ? <Minimize size={14} /> : <Maximize size={14} />} {fs ? "Exit" : "Fullscreen"}
        </button>
      </div>
      <div ref={ref} style={{ background: "#fff", color: "#000", height: fs ? "100vh" : "auto" }}>
        {src ? (
          <iframe
            src={src}
            sandbox={sandbox}
            style={{ width: "100%", height: fs ? "100vh" : "600px", border: "none", display: "block" }}
          />
        ) : (
          <iframe
            srcDoc={srcDoc}
            sandbox={sandbox}
            style={{ width: "100%", height: fs ? "100vh" : "600px", border: "none", display: "block" }}
            onLoad={e => {
              if (!fs) {
                try { e.target.style.height = e.target.contentDocument.body.scrollHeight + 40 + "px"; } catch {}
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── H5P Block ──────────────────────────────────────────────────────────────
function H5PBlock({ block }) {
  const containerRef = useRef(null);
  const h5pInstanceRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Determine the H5P content path
  const h5pPath = block.h5p_extracted_path;
  const embedUrl = block.h5p_embed_url || (block.moodle_resource_id
    ? `https://campus.rawdatun.org/mod/hvp/embed.php?id=${block.moodle_resource_id}`
    : null);

  useEffect(() => {
    let isMounted = true;
    // If using extracted local H5P content
    if (h5pPath && containerRef.current) {
      setLoading(true);
      setError(null);
      // Clear previous instance
      containerRef.current.innerHTML = '';
      h5pInstanceRef.current = null;

      import('h5p-standalone').then(({ H5P }) => {
        if (!isMounted || !containerRef.current) return;
        new H5P(containerRef.current, {
          h5pJsonPath: `/media/${h5pPath}`,
          frameJs: '/h5p-standalone/frame.bundle.js',
          frameCss: '/h5p-standalone/styles/h5p.css',
        })
          .then(() => {
            if (!isMounted) return;
            h5pInstanceRef.current = true;
            setLoading(false);
          })
          .catch((err) => {
            if (!isMounted) return;
            console.error('H5P render error:', err);
            setError(err.message || 'Failed to render H5P content');
            setLoading(false);
          });
      }).catch((err) => {
        if (!isMounted) return;
        console.error('H5P import error:', err);
        setError('Failed to load H5P player library');
        setLoading(false);
      });
    } else if (!h5pPath && !embedUrl) {
      setLoading(false);
    } else {
      setLoading(false);
    }
    
    return () => {
      isMounted = false;
    };
  }, [h5pPath, block.id]);

  // Fallback: embed URL (Moodle or external)
  if (!h5pPath && embedUrl) {
    return (
      <div className="h5p-container">
        {block.title && <p style={{ padding: "0.75rem 1rem", background: "var(--clr-surface)", borderBottom: "1px solid var(--clr-border)", fontSize: "0.875rem", fontWeight: 600 }}>{block.title}</p>}
        <iframe src={embedUrl} allowFullScreen title={block.title || "H5P Activity"} style={{ width: "100%", minHeight: "480px", border: "none" }} />
      </div>
    );
  }

  // No content at all
  if (!h5pPath && !embedUrl) {
    return <div className="alert alert-info">H5P activity not configured.</div>;
  }

  // Local H5P rendering
  return (
    <div className="h5p-container">
      {block.title && <p style={{ padding: "0.75rem 1rem", background: "var(--clr-surface)", borderBottom: "1px solid var(--clr-border)", fontSize: "0.875rem", fontWeight: 600 }}>{block.title}</p>}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "var(--clr-muted)" }}>
          <div className="spinner" style={{ marginRight: "0.75rem" }} /> Loading H5P content…
        </div>
      )}
      {error && (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--clr-danger, #c0392b)" }}>
          Failed to load H5P content: {error}
        </div>
      )}
      <div ref={containerRef} style={{ minHeight: loading ? 0 : "400px" }} />
    </div>
  );
}

// ── Video Block ────────────────────────────────────────────────────────────
function VideoBlock({ block }) {
  const getEmbedUrl = (url) => {
    if (!url) return null;
    let vidId = "";
    if (url.includes("youtube.com/watch?v=")) {
      vidId = url.split("v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${vidId}?autoplay=0&rel=0`;
    }
    if (url.includes("youtu.be/")) {
      vidId = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${vidId}?autoplay=0&rel=0`;
    }
    if (url.includes("vimeo.com/")) {
      vidId = url.split("vimeo.com/")[1]?.split("?")[0];
      return `https://player.vimeo.com/video/${vidId}?autoplay=0`;
    }
    return url;
  };

  const embedUrl = getEmbedUrl(block.video_url);

  if (embedUrl) return (
    <div className="video-container" style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: "var(--radius-md)", overflow: "hidden", background: "#000" }}>
      <iframe src={embedUrl} allowFullScreen title={block.title} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} />
    </div>
  );
  if (block.file) return (
    <div className="video-container" style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: "var(--radius-md)", overflow: "hidden", background: "#000" }}>
      <video controls preload="metadata" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain" }} src={block.file} />
    </div>
  );
  return <div className="alert alert-info">No video source configured.</div>;
}

// ── Native Quiz Block ─────────────────────────────────────────────────────
function NativeQuizBlock({ lessonId }) {
  const { user } = useAuth();
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [result, setResult] = useState(null);

  const { data: quizzes, isLoading, error } = useQuery({
    queryKey: ["quizzes", lessonId],
    queryFn: () => assessmentsAPI.listQuizzes(lessonId).then(r => r.data),
    enabled: !!user,
    retry: false
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
            setResult(data);
            setActiveQuiz(null);
          }} 
        />
      </div>
    );
  }

  if (result) {
    const isPassed = result.score_percent >= (activeQuiz?.passing_score || 70);
    return (
      <div className="glass" style={{ padding: "2rem", marginTop: "2rem", textAlign: "center" }}>
        <Award size={48} color={isPassed ? "var(--clr-success)" : "var(--clr-warning)"} style={{ margin: "0 auto 1rem" }} />
        <h2>Quiz Result: {result.score_percent}%</h2>
        <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
          You scored {result.score} out of {result.total_marks}.
          {isPassed ? " Congratulations, you passed!" : " You did not reach the passing score."}
        </p>
        <button className="btn btn-outline" onClick={() => { setResult(null); setActiveQuiz(null); }}>
          <RotateCcw size={14} /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "2rem" }}>
      <h3 style={{ marginBottom: "1.25rem" }}>Assessments</h3>
      {qs.map(quiz => (
        <div key={quiz.id} className="glass" style={{ padding: "1.5rem", marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{quiz.title}</p>
            <p className="text-muted" style={{ fontSize: "0.8rem" }}>
              {quiz.questions?.length || 0} Questions · Passing: {quiz.passing_score}%
              {quiz.time_limit_mins && ` · ${quiz.time_limit_mins} min`}
            </p>
          </div>
          {user ? (
            <button className="btn btn-primary btn-sm" onClick={() => setActiveQuiz(quiz)}>
              Start Quiz
            </button>
          ) : (
            <button className="btn btn-outline btn-sm" disabled>
              Sign in to take quiz
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Content Block Renderer ─────────────────────────────────────────────────
function BlockRenderer({ block }) {
  switch (block.block_type) {
    case "html":      return <HTMLBlock block={block} />;
    case "h5p":       return <H5PBlock block={block} />;
    case "video":     return <VideoBlock block={block} />;
    case "document":  return block.file ? <iframe src={block.file} style={{ width: "100%", height: "600px", border: "none", borderRadius: "var(--radius-md)" }} /> : null;
    case "image":     return block.file ? <img src={block.file} alt={block.title} style={{ width: "100%", borderRadius: "var(--radius-md)" }} /> : null;
    default:          return null;
  }
}

// ── Sidebar Lesson List ────────────────────────────────────────────────────
function Sidebar({ modules, activeLessonId, slug, onSelect, isMobileOpen, onMobileClose }) {
  return (
    <aside 
      style={{ 
        width: "280px", 
        minWidth: "280px", 
        borderRight: "1px solid var(--clr-border)", 
        overflowY: "auto", 
        padding: "1rem 0",
        position: isMobileOpen ? "fixed" : "relative",
        top: isMobileOpen ? "64px" : "auto",
        left: isMobileOpen ? "0" : "auto",
        height: isMobileOpen ? "calc(100vh - 64px)" : "auto",
        zIndex: isMobileOpen ? 999 : "auto",
        background: "#fff",
        transform: isMobileOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s ease"
      }} 
      className="lesson-sidebar"
    >
      {isMobileOpen && (
        <button 
          onClick={onMobileClose}
          style={{
            position: "absolute",
            top: "0.5rem",
            right: "0.5rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.5rem",
            zIndex: 1000
          }}
          className="mobile-close-btn"
        >
          <X size={18} />
        </button>
      )}
      <div style={{ padding: "0 1rem 1rem", borderBottom: "1px solid var(--clr-border)" }}>
        <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--clr-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Course Content</p>
      </div>
      {modules.map(mod => (
        <div key={mod.id}>
          <div style={{ padding: "0.75rem 1rem", background: "var(--clr-surface)", borderBottom: "1px solid var(--clr-border)" }}>
            <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--clr-muted)" }}>{mod.title}</p>
          </div>
          {(mod.lessons || []).map(l => (
            <button key={l.id} onClick={() => onSelect(l.id)} style={{ width: "100%", textAlign: "left", padding: "0.75rem 1rem 0.75rem 1.5rem", display: "flex", alignItems: "center", gap: "0.625rem", background: l.id === activeLessonId ? "rgba(108,99,255,0.1)" : "transparent", borderBottom: "1px solid var(--clr-border)", color: l.id === activeLessonId ? "var(--clr-primary)" : "var(--clr-text)", fontSize: "0.875rem", fontWeight: l.id === activeLessonId ? 600 : 400, transition: "all 0.15s" }}>
              {l.id === activeLessonId ? <ChevronRight size={12} /> : l.is_preview ? <CheckCircle size={12} color="var(--clr-success)" /> : <Lock size={12} color="var(--clr-muted)" />}
              <span style={{ flex: 1 }}>{l.title}</span>
            </button>
          ))}
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
  });

  const currentLesson = allLessons.find(l => l.id === currentId);
  const currentIndex  = allLessons.findIndex(l => l.id === currentId);
  const nextLesson    = allLessons[currentIndex + 1];

  const handleSelect = (id) => {
    setActiveId(id);
    navigate(`/learn/${slug}/${id}`, { replace: true });
  };

  if (!courseData) return <><Navbar /><div className="loading-screen"><div className="spinner" /></div></>;

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <Navbar />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Mobile sidebar toggle */}
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: "fixed",
            top: "70px",
            left: "1rem",
            zIndex: 1000,
            background: "var(--clr-primary)",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: "44px",
            height: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-md)",
            cursor: "pointer",
            "@media (min-width: 769px)": {
              display: "none"
            }
          }}
          className="mobile-sidebar-toggle"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        
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
          slug={slug} 
          onSelect={handleSelect}
          isMobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />
        <main style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>
          {currentLesson && (
            <>
              <div style={{ marginBottom: "1.5rem" }}>
                <h2 style={{ marginBottom: "0.25rem" }}>{currentLesson.title}</h2>
                {currentLesson.estimated_duration_mins > 0 && <p className="text-muted" style={{ fontSize: "0.8rem" }}>{currentLesson.estimated_duration_mins} min</p>}
              </div>

              {(!user && !currentLesson.is_preview) ? (
                <div className="glass" style={{ padding: "3rem 2rem", textAlign: "center", marginTop: "2rem" }}>
                  <Lock size={48} color="var(--clr-muted)" style={{ margin: "0 auto 1rem" }} />
                  <h3>This lesson is locked</h3>
                  <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
                    Please sign in and enroll to access this lesson.
                  </p>
                  <button className="btn btn-primary" onClick={() => navigate("/login")}>
                    Sign in
                  </button>
                </div>
              ) : (blocks?.length === 0 && !currentLesson.is_preview && user) ? (
                <div className="glass" style={{ padding: "3rem 2rem", textAlign: "center", marginTop: "2rem" }}>
                  <Lock size={48} color="var(--clr-muted)" style={{ margin: "0 auto 1rem" }} />
                  <h3>This lesson is locked</h3>
                  <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
                    You need to enroll in this course or unlock previous lessons to access this content.
                  </p>
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

                  <NativeQuizBlock lessonId={currentId} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--clr-border)" }}>
                    {user ? (
                      <button className="btn btn-accent" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
                        <CheckCircle size={16} /> {completeMutation.isSuccess ? "Marked Complete!" : "Mark as Complete"}
                      </button>
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
