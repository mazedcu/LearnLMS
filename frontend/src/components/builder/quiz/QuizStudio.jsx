import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Eye, Pencil, Copy, Trash2, ArrowUp, ArrowDown, GripVertical, Timer, Target, Repeat, X } from "lucide-react";
import { adminAPI } from "../../../api";
import QuizPreview from "../../admin/coursesSection/quiz/QuizPreview";
import { RowMenu, dropPosition, apiErrorMessage } from "../shared";
import TypePicker, { TypeIcon } from "./TypePicker";
import QuestionStudio from "./QuestionStudio";
import { TYPES, newDraft, toDraft, gapsToText } from "./quizModel";
import "./quizStudio.css";

const list = (r) => (Array.isArray(r.data) ? r.data : r.data?.results || []);

/** One line describing a question, with gaps shown as chips. */
function QuestionSummary({ q }) {
  const c = q.content || {};
  if (q.question_type === "fill_blanks" || q.question_type === "drag_drop_word") {
    const text = gapsToText(q.prompt, q.question_type === "fill_blanks" ? c.blanks : c.mappings);
    return (
      <span className={`qs-t-${q.question_type}`}>
        {text.split(/(\[[^\]]+\])/).map((part, i) =>
          part.startsWith("[") ? <span key={i} className="qs-gapchip">{part.slice(1, -1).split("|")[0]}</span> : <span key={i}>{part}</span>)}
      </span>
    );
  }
  if (q.question_type === "calculated_mcq") {
    return (
      <span className="qs-t-calculated_mcq">
        {(q.prompt || "").split(/(\{\{\s*\w+\s*\}\})/).map((part, i) =>
          /^\{\{/.test(part) ? <span key={i} className="qs-gapchip">{part.replace(/[{}\s]/g, "")}</span> : <span key={i}>{part}</span>)}
      </span>
    );
  }
  return <>{q.prompt}</>;
}

function describe(q) {
  const c = q.content || {};
  switch (q.question_type) {
    case "mcq": return `${(c.options || []).length} options`;
    case "fill_blanks": return `${Object.keys(c.blanks || {}).length} gaps`;
    case "drag_drop_word": return `${(c.draggable_words || []).length} words`;
    case "drag_drop_image": return `${(c.zones || []).length} spots`;
    case "calculated_mcq": return c.distractors?.length ? `${c.distractors.length + 1} options` : "typed answer";
    case "keyword_match": return `${(c.keywords || []).length} key words`;
    default: return "";
  }
}

/* ── One quiz ─────────────────────────────────────────────────────────── */
function QuizCard({ quiz, lessonId, autoAdd, onChanged, toast }) {
  const qc = useQueryClient();
  const qKey = ["questions-admin", quiz.id];
  const [picking, setPicking] = useState(!!autoAdd);
  const [studio, setStudio] = useState(null); // draft being edited
  const [settings, setSettings] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);

  const { data: questions = [], isLoading } = useQuery({ queryKey: qKey, queryFn: () => adminAPI.getQuestions(quiz.id).then(list) });
  const refresh = () => { qc.invalidateQueries({ queryKey: qKey }); qc.invalidateQueries({ queryKey: ["quizzes-admin", lessonId] }); onChanged?.(); };

  const updateQuiz = useMutation({ mutationFn: (patch) => adminAPI.updateQuiz(quiz.id, patch), onSuccess: refresh,
    onError: (e) => toast?.(apiErrorMessage(e, "Couldn't save quiz settings."), "error") });
  const delQuiz = useMutation({ mutationFn: () => adminAPI.deleteQuiz(quiz.id), onSuccess: refresh });
  const delQ = useMutation({ mutationFn: (id) => adminAPI.deleteQuestion(id), onSuccess: refresh });
  const duplicate = useMutation({
    mutationFn: (q) => adminAPI.createQuestion(quiz.id, { question_type: q.question_type, prompt: q.prompt, content: q.content, max_marks: q.max_marks }),
    onSuccess: () => { refresh(); toast?.("Question duplicated"); },
  });

  const reorder = (from, to) => {
    if (to < 0 || to >= questions.length || from === to) return;
    const next = [...questions];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    qc.setQueryData(qKey, next);
    adminAPI.reorderQuestions(quiz.id, next.map((q) => q.id)).then(refresh).catch(refresh);
  };

  const totalMarks = questions.reduce((s, q) => s + (Number(q.max_marks) || 0), 0);

  return (
    <div className="qs-quiz">
      <div className="qs-quiz-head">
        <div className="qs-quiz-title">
          {quiz.title}
          <div className="text-muted" style={{ fontSize: "0.75rem", fontWeight: 500 }}>
            {questions.length} question{questions.length === 1 ? "" : "s"} · {totalMarks} mark{totalMarks === 1 ? "" : "s"}
          </div>
        </div>
        <div className="qs-chips">
          <button className="qs-chip" onClick={() => setSettings((s) => !s)} title="Pass mark"><Target size={12} /> Pass {quiz.passing_score}%</button>
          <button className="qs-chip" onClick={() => setSettings((s) => !s)} title="Time limit"><Timer size={12} /> {quiz.time_limit_mins ? `${quiz.time_limit_mins} min` : "No time limit"}</button>
          <button className="qs-chip" onClick={() => setSettings((s) => !s)} title="Attempts"><Repeat size={12} /> {quiz.max_attempts ? `${quiz.max_attempts} attempt${quiz.max_attempts === 1 ? "" : "s"}` : "Unlimited tries"}</button>
        </div>
        <button className="cb-btn" onClick={() => setPreviewing(true)} disabled={!questions.length}><Eye size={14} /> <span className="cb-label">Try quiz</span></button>
        <RowMenu label="Quiz actions" items={[
          { label: "Settings", icon: Pencil, onClick: () => setSettings(true) },
          "divider",
          { label: "Delete quiz", icon: Trash2, danger: true, onClick: () => confirm(`Delete "${quiz.title}" and all its questions?`) && delQuiz.mutate() },
        ]} />
      </div>

      {settings && (
        <div className="qs-settings">
          <label>Title<input className="qs-input sm" defaultValue={quiz.title} onBlur={(e) => e.target.value.trim() && e.target.value !== quiz.title && updateQuiz.mutate({ title: e.target.value.trim() })} /></label>
          <label>Pass mark (%)<input className="qs-input sm" type="number" min="0" max="100" defaultValue={quiz.passing_score} style={{ width: 90 }}
            onBlur={(e) => updateQuiz.mutate({ passing_score: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} /></label>
          <label>Time limit (min)<input className="qs-input sm" type="number" min="0" placeholder="none" defaultValue={quiz.time_limit_mins || ""} style={{ width: 110 }}
            onBlur={(e) => updateQuiz.mutate({ time_limit_mins: Number(e.target.value) > 0 ? Number(e.target.value) : null })} /></label>
          <label>Attempts<input className="qs-input sm" type="number" min="0" placeholder="unlimited" defaultValue={quiz.max_attempts || ""} style={{ width: 100 }}
            onBlur={(e) => updateQuiz.mutate({ max_attempts: Number(e.target.value) > 0 ? Math.floor(Number(e.target.value)) : 0 })} /></label>
          <button className="cb-icon-btn" aria-label="Close settings" onClick={() => setSettings(false)}><X size={16} /></button>
        </div>
      )}

      <div className="qs-qlist" onDragOver={(e) => dragId && e.preventDefault()}
        onDrop={(e) => {
          if (!dragId || !over) return;
          e.preventDefault();
          const from = questions.findIndex((q) => q.id === dragId);
          let to = questions.findIndex((q) => q.id === over.id) + (over.pos === "after" ? 1 : 0);
          if (from < to) to -= 1;
          reorder(from, to);
          setDragId(null); setOver(null);
        }}>
        {isLoading && <div className="spinner" style={{ margin: "1rem auto" }} />}
        {!isLoading && questions.length === 0 && !picking && (
          <div className="qs-empty">No questions yet — add the first one below.</div>
        )}
        {questions.map((q, i) => (
          <div key={q.id}
            className={`qs-q ${dragId === q.id ? "dragging" : ""}${over?.id === q.id && dragId && dragId !== q.id ? ` cb-drop-line cb-drop-${over.pos}` : ""}`}
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", q.id); setDragId(q.id); }}
            onDragEnd={() => { setDragId(null); setOver(null); }}
            onDragOver={(e) => { if (!dragId) return; e.preventDefault(); setOver({ id: q.id, pos: dropPosition(e) }); }}
            onClick={() => setStudio(toDraft(q))}>
            <span className="cb-handle" aria-hidden><GripVertical size={14} /></span>
            <span className="qs-q-num">{i + 1}</span>
            <TypeIcon type={q.question_type} small />
            <div className="qs-q-body">
              <div className="qs-q-prompt"><QuestionSummary q={q} /></div>
              <div className="qs-q-meta">{TYPES[q.question_type]?.label} · {describe(q)} · {q.max_marks} mark{Number(q.max_marks) === 1 ? "" : "s"}</div>
            </div>
            <RowMenu label="Question actions" items={[
              { label: "Edit", icon: Pencil, onClick: () => setStudio(toDraft(q)) },
              { label: "Duplicate", icon: Copy, onClick: () => duplicate.mutate(q) },
              "divider",
              { label: "Move up", icon: ArrowUp, disabled: i === 0, onClick: () => reorder(i, i - 1) },
              { label: "Move down", icon: ArrowDown, disabled: i === questions.length - 1, onClick: () => reorder(i, i + 1) },
              "divider",
              { label: "Delete", icon: Trash2, danger: true, onClick: () => confirm("Delete this question?") && delQ.mutate(q.id) },
            ]} />
          </div>
        ))}
      </div>

      {picking ? (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0.85rem 0", borderTop: "1px solid var(--clr-border)", background: "var(--clr-bg)" }}>
            <strong style={{ fontSize: "0.85rem" }}>Choose a question type</strong>
            <button className="cb-icon-btn" aria-label="Cancel" onClick={() => setPicking(false)}><X size={16} /></button>
          </div>
          <TypePicker onPick={(type) => { setPicking(false); setStudio(newDraft(type)); }} />
        </>
      ) : (
        <div className="qs-quiz-foot">
          <button className="cb-btn cb-btn-primary" onClick={() => setPicking(true)}><Plus size={15} /> Add question</button>
        </div>
      )}

      {studio && (
        <QuestionStudio
          key={studio.id || `new-${studio.type}-${studio._n || 0}`}
          quizId={quiz.id}
          initialDraft={studio}
          onClose={() => setStudio(null)}
          onSaved={() => { setStudio(null); refresh(); toast?.("Question saved"); }}
          onSaveAndNew={(type) => { refresh(); toast?.("Question saved"); setStudio({ ...newDraft(type), _n: Date.now() }); }}
        />
      )}

      {previewing && (
        <div className="qs-overlay" onMouseDown={(e) => e.target === e.currentTarget && setPreviewing(false)}>
          <div className="qs-studio" style={{ maxWidth: 820 }}>
            <div className="qs-studio-head"><h3>Try “{quiz.title}” <small>Marked here only — nothing is saved</small></h3>
              <button className="cb-icon-btn" aria-label="Close" onClick={() => setPreviewing(false)}><X size={18} /></button></div>
            <div style={{ overflowY: "auto", padding: "1rem" }}><QuizPreview quiz={quiz} onClose={() => setPreviewing(false)} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── All quizzes in a lesson ──────────────────────────────────────────── */
export default function QuizStudio({ lessonId, startCreating = 0, onChanged, toast }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [justCreated, setJustCreated] = useState(null);

  useEffect(() => { if (startCreating) setCreating(true); }, [startCreating]);

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ["quizzes-admin", lessonId],
    queryFn: () => adminAPI.getQuizzes(lessonId).then(list),
  });

  const create = useMutation({
    mutationFn: () => adminAPI.createQuiz(lessonId, { title: title.trim() || "Quiz", passing_score: 60 }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["quizzes-admin", lessonId] });
      setCreating(false); setTitle("");
      setJustCreated(res.data?.id);
      onChanged?.();
    },
  });

  return (
    <div>
      {isLoading && <div className="spinner" style={{ margin: "1rem auto" }} />}
      {quizzes.map((q) => (
        <QuizCard key={q.id} quiz={q} lessonId={lessonId} autoAdd={q.id === justCreated} onChanged={onChanged} toast={toast} />
      ))}
      {creating ? (
        <form className="qs-quiz" style={{ padding: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <input className="qs-input" autoFocus style={{ flex: 1, minWidth: 200 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quiz title, e.g. Check your understanding" />
          <button className="cb-btn cb-btn-primary" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create quiz"}</button>
          <button type="button" className="cb-btn cb-btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
        </form>
      ) : (
        <button className="qs-addline" style={{ width: "100%", justifyContent: "center", padding: "0.75rem" }} onClick={() => setCreating(true)}>
          <Plus size={15} /> {quizzes.length ? "Add another quiz" : "Create a quiz for this lesson"}
        </button>
      )}
    </div>
  );
}
