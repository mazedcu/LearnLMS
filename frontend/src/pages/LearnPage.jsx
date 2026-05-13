import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { coursesAPI, lessonsAPI, aiAPI } from "../api";
import Navbar from "../components/Navbar";
import { Lock, CheckCircle, Maximize, Minimize, Send, ChevronRight } from "lucide-react";

// ── HTML Block ─────────────────────────────────────────────────────────────
function HTMLBlock({ block }) {
  const [fs, setFs] = useState(false);
  const ref = useRef(null);

  const toggleFs = () => {
    if (!fs) { ref.current?.requestFullscreen?.(); setFs(true); }
    else { document.exitFullscreen?.(); setFs(false); }
  };

  const src = block.file;
  const srcDoc = !src ? `<!DOCTYPE html><html><head><meta charset='UTF-8'><style>body{font-family:system-ui,sans-serif;padding:1.5rem;line-height:1.7;color:#1a1a1a;margin:0}img{max-width:100%}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}</style></head><body>${block.html_content}</body></html>` : undefined;

  return (
    <div style={{ position: "relative", border: "1px solid var(--clr-border)", borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 1rem", background: "var(--clr-surface)", borderBottom: "1px solid var(--clr-border)" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--clr-muted)" }}>{block.title || (src ? "HTML File" : "HTML Content")}</span>
        <button onClick={toggleFs} className="btn btn-sm btn-outline" title={fs ? "Exit Fullscreen" : "Fullscreen"}>
          {fs ? <Minimize size={14} /> : <Maximize size={14} />} {fs ? "Exit" : "Fullscreen"}
        </button>
      </div>
      <div ref={ref} style={{ background: "#fff", color: "#000", height: fs ? "100vh" : "auto" }}>
        <iframe
          src={src}
          srcDoc={srcDoc}
          sandbox="allow-same-origin allow-scripts"
          style={{ width: "100%", height: fs ? "100vh" : "600px", border: "none", display: "block" }}
          onLoad={e => { 
            if (!fs && !src) {
              try { e.target.style.height = e.target.contentDocument.body.scrollHeight + 40 + "px"; } catch {} 
            }
          }}
        />
      </div>
    </div>
  );
}

// ── H5P Block ──────────────────────────────────────────────────────────────
function H5PBlock({ block }) {
  const url = block.h5p_embed_url || (block.moodle_resource_id ? `https://campus.rawdatun.org/mod/hvp/embed.php?id=${block.moodle_resource_id}` : null);
  if (!url) return <div className="alert alert-info">H5P activity URL not configured.</div>;
  return (
    <div className="h5p-container">
      {block.title && <p style={{ padding: "0.75rem 1rem", background: "var(--clr-surface)", borderBottom: "1px solid var(--clr-border)", fontSize: "0.875rem", fontWeight: 600 }}>{block.title}</p>}
      <iframe src={url} allowFullScreen title={block.title || "H5P Activity"} style={{ width: "100%", minHeight: "480px", border: "none" }} />
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
      return `https://www.youtube.com/embed/${vidId}`;
    }
    if (url.includes("youtu.be/")) {
      vidId = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${vidId}`;
    }
    if (url.includes("vimeo.com/")) {
      vidId = url.split("vimeo.com/")[1]?.split("?")[0];
      return `https://player.vimeo.com/video/${vidId}`;
    }
    return url;
  };

  const embedUrl = getEmbedUrl(block.video_url);

  if (embedUrl) return (
    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: "var(--radius-md)", overflow: "hidden", background: "#000" }}>
      <iframe src={embedUrl} allowFullScreen title={block.title} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} />
    </div>
  );
  if (block.file) return <video controls style={{ width: "100%", borderRadius: "var(--radius-md)", background: "#000" }} src={block.file} />;
  return <div className="alert alert-info">No video source configured.</div>;
}

// ── AI Q&A Block ───────────────────────────────────────────────────────────
function AIQABlock({ lessonId }) {
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});

  const { data: questions } = useQuery({
    queryKey: ["ai-questions", lessonId],
    queryFn: () => aiAPI.getQuestions(lessonId).then(r => r.data),
  });

  const submitMutation = useMutation({
    mutationFn: ({ qId, text }) => aiAPI.submit(qId, { answer_text: text }).then(r => r.data),
    onSuccess: (data, { qId }) => setResults(r => ({ ...r, [qId]: data })),
  });

  const qs = Array.isArray(questions) ? questions : (questions?.results || []);
  if (qs.length === 0) return null;

  return (
    <div style={{ marginTop: "2rem" }}>
      <h3 style={{ marginBottom: "1.25rem" }}>Questions</h3>
      {qs.map(q => {
        const res = results[q.id];
        return (
          <div key={q.id} className="glass" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
            <p style={{ fontWeight: 600, marginBottom: "1rem" }}>{q.question_text}</p>
            <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "0.75rem" }}>Max marks: {q.max_marks}</p>
            {!res ? (
              <>
                <textarea className="form-control" rows={5} value={answers[q.id] || ""} onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} placeholder="Type your answer here..." style={{ marginBottom: "0.75rem", resize: "vertical" }} />
                <button className="btn btn-primary btn-sm" onClick={() => submitMutation.mutate({ qId: q.id, text: answers[q.id] || "" })} disabled={submitMutation.isPending || !answers[q.id]}>
                  <Send size={14} /> Submit Answer
                </button>
              </>
            ) : (
              <div>
                <div style={{ background: "var(--clr-surface)", borderRadius: "var(--radius-sm)", padding: "1rem", marginBottom: "0.75rem" }}>
                  <p style={{ fontWeight: 600, color: "var(--clr-accent)", marginBottom: "0.5rem" }}>
                    Score: {res.final_score ?? res.ai_score} / {q.max_marks}
                    {res._mock && <span className="badge badge-warning" style={{ marginLeft: "0.5rem" }}>Mock</span>}
                  </p>
                  <p style={{ fontSize: "0.875rem", lineHeight: "1.6" }}>{res.ai_feedback}</p>
                </div>
                {res.ai_breakdown?.length > 0 && (
                  <ul style={{ fontSize: "0.8rem", color: "var(--clr-muted)", paddingLeft: "1.25rem" }}>
                    {res.ai_breakdown.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Moodle Quiz Block ─────────────────────────────────────────────────────
function MoodleQuizBlock({ lessonId }) {
  const [starting, setStarting] = useState({});
  const [started, setStarted] = useState({});

  const { data: quizzes } = useQuery({
    queryKey: ["moodle-quizzes-lesson", lessonId],
    queryFn: () => aiAPI.getMoodleQuizzes(lessonId).then(r => Array.isArray(r.data) ? r.data : r.data?.results || []),
    enabled: !!lessonId,
  });

  const qs = quizzes || [];
  if (qs.length === 0) return null;

  const handleStart = async (quiz) => {
    setStarting(s => ({ ...s, [quiz.id]: true }));
    try {
      const r = await aiAPI.startQuiz(quiz.id);
      setStarted(s => ({ ...s, [quiz.id]: r.data }));
    } catch (e) {
      alert(e?.response?.data?.detail || "Could not start quiz. Check Moodle connection.");
    } finally {
      setStarting(s => ({ ...s, [quiz.id]: false }));
    }
  };

  return (
    <div style={{ marginTop: "2rem" }}>
      <h3 style={{ marginBottom: "1.25rem" }}>Quizzes</h3>
      {qs.map(quiz => (
        <div key={quiz.id} className="glass" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <div>
              <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{quiz.title}</p>
              <p className="text-muted" style={{ fontSize: "0.8rem" }}>
                Max attempts: {quiz.max_attempts}
                {quiz.time_limit_secs && ` · Time limit: ${Math.floor(quiz.time_limit_secs / 60)} min`}
              </p>
            </div>
            {!started[quiz.id] && (
              <button className="btn btn-primary btn-sm" onClick={() => handleStart(quiz)} disabled={starting[quiz.id]}>
                {starting[quiz.id] ? "Starting..." : "Start Quiz"}
              </button>
            )}
          </div>
          {started[quiz.id] && (
            <div className="alert alert-success" style={{ fontSize: "0.875rem" }}>
              Quiz started (Attempt ID: {started[quiz.id].moodle_attempt_id || "N/A"}).
              Please open Moodle to complete your quiz at: {" "}
              <a href={`https://campus.rawdatun.org/mod/quiz/attempt.php?attempt=${started[quiz.id].moodle_attempt_id}`}
                 target="_blank" rel="noreferrer" style={{ color: "var(--clr-accent)" }}>
                Open in Moodle →
              </a>
            </div>
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
function Sidebar({ modules, activeLessonId, slug, onSelect }) {
  return (
    <aside style={{ width: "280px", minWidth: "280px", borderRight: "1px solid var(--clr-border)", overflowY: "auto", padding: "1rem 0" }}>
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
        <Sidebar modules={courseData.modules || []} activeLessonId={currentId} slug={slug} onSelect={handleSelect} />
        <main style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>
          {currentLesson && (
            <>
              <div style={{ marginBottom: "1.5rem" }}>
                <h2 style={{ marginBottom: "0.25rem" }}>{currentLesson.title}</h2>
                {currentLesson.estimated_duration_mins > 0 && <p className="text-muted" style={{ fontSize: "0.8rem" }}>{currentLesson.estimated_duration_mins} min</p>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {(blocks || []).map(b => (
                  <div key={b.id}>
                    {b.title && b.block_type !== "html" && <h4 style={{ marginBottom: "0.75rem" }}>{b.title}</h4>}
                    <BlockRenderer block={b} />
                  </div>
                ))}
              </div>

              <AIQABlock lessonId={currentId} />
              <MoodleQuizBlock lessonId={currentId} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--clr-border)" }}>
                <button className="btn btn-accent" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
                  <CheckCircle size={16} /> {completeMutation.isSuccess ? "Marked Complete!" : "Mark as Complete"}
                </button>
                {nextLesson && (
                  <button className="btn btn-outline" onClick={() => handleSelect(nextLesson.id)}>
                    Next: {nextLesson.title} <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
