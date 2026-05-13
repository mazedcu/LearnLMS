import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { coursesAPI, adminAPI } from "../../api";
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, BookOpen, Save, X, Eye, ExternalLink } from "lucide-react";

// ── Tiny inline form helper ────────────────────────────────────────────────
function InlineForm({ fields, onSave, onCancel, saving }) {
  const [vals, setVals] = useState(() => Object.fromEntries(fields.map(f => [f.name, f.default || ""])));
  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", padding: "0.75rem", background: "rgba(108,99,255,0.06)", borderRadius: "var(--radius-sm)", marginBottom: "0.5rem" }}>
      {fields.map(f => (
        <div key={f.name} className="form-group" style={{ margin: 0, flex: f.flex || "1 1 160px" }}>
          <label className="form-label" style={{ fontSize: "0.7rem" }}>{f.label}</label>
          {f.type === "select" ? (
            <select className="form-control" style={{ fontSize: "0.8rem" }} value={vals[f.name]} onChange={e => setVals(v => ({ ...v, [f.name]: e.target.value }))}>
              {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input className="form-control" style={{ fontSize: "0.8rem" }} type={f.type || "text"} placeholder={f.placeholder || f.label} value={vals[f.name]} onChange={e => setVals(v => ({ ...v, [f.name]: e.target.value }))} />
          )}
        </div>
      ))}
      <button className="btn btn-primary btn-sm" onClick={() => onSave(vals)} disabled={saving}><Save size={13} /></button>
      <button className="btn btn-outline btn-sm" onClick={onCancel}><X size={13} /></button>
    </div>
  );
}

// ── Content Block Editor ───────────────────────────────────────────────────
function BlockEditor({ lessonId, onClose }) {
  const qc = useQueryClient();
  const { data: blocks } = useQuery({
    queryKey: ["blocks", lessonId],
    queryFn: () => import("../../api").then(m => m.lessonsAPI.blocks(lessonId).then(r => Array.isArray(r.data) ? r.data : r.data?.results || [])),
  });
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState("html");
  const [form, setForm] = useState({ title: "", html_content: "", h5p_embed_url: "", video_url: "", is_fullscreen: true, order: 1 });
  const [file, setFile] = useState(null);
  const [editId, setEditId] = useState(null);

  const save = useMutation({
    mutationFn: (data) => {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (v !== null && v !== undefined) fd.append(k, v);
      });
      if (file) fd.append("file", file);
      fd.append("block_type", type);
      
      if (editId) return adminAPI.updateBlock(editId, fd);
      return adminAPI.createBlock(lessonId, fd);
    },
    onSuccess: () => { 
      qc.invalidateQueries(["blocks", lessonId]); 
      setAdding(false); 
      setEditId(null); 
      setFile(null);
    },
  });

  const del = useMutation({
    mutationFn: (id) => adminAPI.deleteBlock(id),
    onSuccess: () => qc.invalidateQueries(["blocks", lessonId]),
  });

  return (
    <div style={{ padding: "1rem", background: "var(--clr-surface)", border: "1px solid var(--clr-border)", borderRadius: "var(--radius-md)", marginTop: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h5 style={{ margin: 0 }}>Content Blocks</h5>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-primary btn-sm" onClick={() => { setAdding(true); setEditId(null); setFile(null); }}><Plus size={13} /> Add Block</button>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={13} /></button>
        </div>
      </div>

      {adding && (
        <div style={{ marginBottom: "1rem", padding: "1rem", background: "rgba(108,99,255,0.06)", borderRadius: "var(--radius-sm)" }}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            {["html", "h5p", "video", "document", "image"].map(t => (
              <button key={t} className="btn btn-sm" onClick={() => setType(t)}
                style={{ background: type === t ? "var(--clr-primary)" : "transparent", color: type === t ? "#fff" : "var(--clr-muted)", border: "1px solid var(--clr-border)", textTransform: "capitalize" }}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input className="form-control" placeholder="Block title (optional)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input className="form-control" placeholder="Order" type="number" value={form.order} onChange={e => setForm(f => ({ ...f, order: e.target.value }))} style={{ flex: 1 }} />
              {type === "html" && (
                <label style={{ display: "flex", gap: "0.375rem", alignItems: "center", fontSize: "0.75rem", flex: 1 }}>
                  <input type="checkbox" checked={form.is_fullscreen} onChange={e => setForm(f => ({ ...f, is_fullscreen: e.target.checked }))} />
                  Fullscreen
                </label>
              )}
            </div>

            {type === "html" && (
              <>
                <textarea className="form-control" rows={4} placeholder="Paste HTML content here..." value={form.html_content} onChange={e => setForm(f => ({ ...f, html_content: e.target.value }))} style={{ fontFamily: "monospace", fontSize: "0.8rem" }} />
                <div style={{ padding: "0.5rem", border: "1px dashed var(--clr-border)", borderRadius: "4px" }}>
                  <p style={{ fontSize: "0.7rem", color: "var(--clr-muted)", marginBottom: "0.25rem" }}>OR Upload HTML File:</p>
                  <input type="file" accept=".html" onChange={e => setFile(e.target.files[0])} style={{ fontSize: "0.7rem" }} />
                </div>
              </>
            )}
            {type === "h5p" && (
              <input 
                className="form-control" 
                placeholder="Paste H5P URL or iframe code..." 
                value={form.h5p_embed_url} 
                onChange={e => {
                  let val = e.target.value;
                  if (val.includes("<iframe")) {
                    const match = val.match(/src="([^"]+)"/);
                    if (match) {
                      val = match[1].replace(/&amp;/g, "&");
                    }
                  }
                  setForm(f => ({ ...f, h5p_embed_url: val }));
                }} 
              />
            )}
            {type === "video" && (
              <>
                <input 
                  className="form-control" 
                  placeholder="YouTube/Vimeo URL or iframe code..." 
                  value={form.video_url} 
                  onChange={e => {
                    let val = e.target.value;
                    if (val.includes("<iframe")) {
                      const match = val.match(/src="([^"]+)"/);
                      if (match) {
                        val = match[1].replace(/&amp;/g, "&");
                      }
                    }
                    setForm(f => ({ ...f, video_url: val }));
                  }} 
                />
                <p style={{ fontSize: "0.7rem", color: "var(--clr-muted)", textAlign: "center" }}>- OR -</p>
                <input type="file" accept="video/*" onChange={e => setFile(e.target.files[0])} style={{ fontSize: "0.7rem" }} />
              </>
            )}
            {(type === "document" || type === "image") && <input type="file" accept={type === "image" ? "image/*" : ".pdf,.doc,.docx"} onChange={e => setFile(e.target.files[0])} style={{ fontSize: "0.7rem" }} />}
            
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button className="btn btn-primary btn-sm" onClick={() => save.mutate(form)} disabled={save.isPending}><Save size={13} /> {save.isPending ? "Saving..." : "Save Block"}</button>
              <button className="btn btn-outline btn-sm" onClick={() => setAdding(false)}><X size={13} /></button>
            </div>
            {save.isError && <p className="form-error" style={{ fontSize: "0.7rem", marginTop: "0.5rem" }}>{save.error?.response?.data?.detail || "Error saving block. Please check the fields."}</p>}
          </div>
        </div>
      )}

      {(blocks || []).length === 0 && !adding && <p className="text-muted" style={{ fontSize: "0.8rem" }}>No content blocks yet.</p>}
      {(blocks || []).map(b => (
        <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 0.75rem", background: "var(--clr-bg)", borderRadius: "var(--radius-sm)", marginBottom: "0.375rem" }}>
          <span style={{ fontSize: "0.8rem" }}>
            <span style={{ background: "rgba(108,99,255,0.15)", color: "var(--clr-primary)", borderRadius: "4px", padding: "1px 6px", fontSize: "0.7rem", marginRight: "0.5rem", textTransform: "capitalize" }}>{b.block_type}</span>
            {b.title || "(untitled)"}
          </span>
          <button className="btn btn-danger btn-sm" style={{ padding: "0.25rem 0.5rem" }} onClick={() => del.mutate(b.id)}><Trash2 size={12} /></button>
        </div>
      ))}
    </div>
  );
}

// ── Assessments Editor ─────────────────────────────────────────────────────
function AssessmentsEditor({ lessonId, onClose }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("ai"); // "ai" | "quiz"
  const [addingQ, setAddingQ] = useState(false);
  const [addingMoodle, setAddingMoodle] = useState(false);
  const [qForm, setQForm] = useState({ question_text: "", markscheme: "", max_marks: 10, order: 1 });
  const [mForm, setMForm] = useState({ moodle_quiz_id: "", title: "", time_limit_secs: "", max_attempts: 1 });

  const { data: aiQuestions } = useQuery({
    queryKey: ["ai-questions-admin", lessonId],
    queryFn: () => adminAPI.getAIQuestions(lessonId).then(r => Array.isArray(r.data) ? r.data : r.data?.results || []),
  });
  const { data: moodleQuizzes } = useQuery({
    queryKey: ["moodle-quizzes-admin", lessonId],
    queryFn: () => adminAPI.getMoodleQuizzes(lessonId).then(r => Array.isArray(r.data) ? r.data : r.data?.results || []),
  });

  const createQ = useMutation({
    mutationFn: (data) => adminAPI.createAIQuestion(lessonId, data),
    onSuccess: () => { qc.invalidateQueries(["ai-questions-admin", lessonId]); setAddingQ(false); setQForm({ question_text: "", markscheme: "", max_marks: 10, order: 1 }); },
  });
  const delQ = useMutation({
    mutationFn: (id) => adminAPI.deleteAIQuestion(id),
    onSuccess: () => qc.invalidateQueries(["ai-questions-admin", lessonId]),
  });
  const createMoodle = useMutation({
    mutationFn: (data) => adminAPI.createMoodleQuiz(lessonId, { ...data, moodle_quiz_id: Number(data.moodle_quiz_id) }),
    onSuccess: () => { qc.invalidateQueries(["moodle-quizzes-admin", lessonId]); setAddingMoodle(false); setMForm({ moodle_quiz_id: "", title: "", time_limit_secs: "", max_attempts: 1 }); },
  });
  const delMoodle = useMutation({
    mutationFn: (id) => adminAPI.deleteMoodleQuiz(id),
    onSuccess: () => qc.invalidateQueries(["moodle-quizzes-admin", lessonId]),
  });

  return (
    <div style={{ padding: "1rem", background: "rgba(0,212,170,0.04)", border: "1px solid rgba(0,212,170,0.2)", borderRadius: "var(--radius-md)", marginTop: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <h5 style={{ margin: 0, color: "var(--clr-accent)" }}>Assessments</h5>
          <button className="btn btn-sm" onClick={() => setTab("ai")} style={{ background: tab === "ai" ? "rgba(0,212,170,0.2)" : "transparent", color: tab === "ai" ? "var(--clr-accent)" : "var(--clr-muted)", border: "1px solid var(--clr-border)", fontSize: "0.7rem" }}>AI Questions</button>
          <button className="btn btn-sm" onClick={() => setTab("quiz")} style={{ background: tab === "quiz" ? "rgba(0,212,170,0.2)" : "transparent", color: tab === "quiz" ? "var(--clr-accent)" : "var(--clr-muted)", border: "1px solid var(--clr-border)", fontSize: "0.7rem" }}>Moodle Quiz</button>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onClose}><X size={13} /></button>
      </div>

      {tab === "ai" && (
        <>
          {(aiQuestions || []).map(q => (
            <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "0.625rem 0.75rem", background: "var(--clr-bg)", borderRadius: "var(--radius-sm)", marginBottom: "0.375rem", gap: "0.75rem" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "0.8rem", marginBottom: "0.25rem" }}>{q.question_text}</p>
                <p className="text-muted" style={{ fontSize: "0.7rem" }}>Max marks: {q.max_marks} · Order: {q.order}</p>
              </div>
              <button className="btn btn-danger btn-sm" style={{ padding: "0.25rem 0.5rem", flexShrink: 0 }} onClick={() => delQ.mutate(q.id)}><Trash2 size={12} /></button>
            </div>
          ))}
          {!addingQ && <button className="btn btn-sm btn-outline" style={{ width: "100%", color: "var(--clr-accent)", borderColor: "rgba(0,212,170,0.3)" }} onClick={() => setAddingQ(true)}><Plus size={13} /> Add AI Question</button>}
          {addingQ && (
            <div style={{ padding: "0.75rem", background: "rgba(0,212,170,0.06)", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <textarea className="form-control" rows={3} placeholder="Question text *" value={qForm.question_text} onChange={e => setQForm(f => ({ ...f, question_text: e.target.value }))} />
              <textarea className="form-control" rows={3} placeholder="Mark scheme (provided to AI) *" value={qForm.markscheme} onChange={e => setQForm(f => ({ ...f, markscheme: e.target.value }))} style={{ fontFamily: "monospace", fontSize: "0.8rem" }} />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input className="form-control" type="number" placeholder="Max marks" value={qForm.max_marks} onChange={e => setQForm(f => ({ ...f, max_marks: Number(e.target.value) }))} />
                <input className="form-control" type="number" placeholder="Order" value={qForm.order} onChange={e => setQForm(f => ({ ...f, order: Number(e.target.value) }))} />
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-sm" style={{ background: "var(--clr-accent)", color: "#000" }} onClick={() => createQ.mutate(qForm)} disabled={createQ.isPending}><Save size={13} /> {createQ.isPending ? "Saving..." : "Save Question"}</button>
                <button className="btn btn-outline btn-sm" onClick={() => setAddingQ(false)}><X size={13} /></button>
              </div>
              {createQ.isError && <p className="form-error">{createQ.error?.response?.data?.detail || "Error saving question"}</p>}
            </div>
          )}
        </>
      )}

      {tab === "quiz" && (
        <>
          {(moodleQuizzes || []).map(q => (
            <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 0.75rem", background: "var(--clr-bg)", borderRadius: "var(--radius-sm)", marginBottom: "0.375rem" }}>
              <div>
                <p style={{ fontSize: "0.8rem", fontWeight: 600 }}>{q.title}</p>
                <p className="text-muted" style={{ fontSize: "0.7rem" }}>Moodle Quiz ID: {q.moodle_quiz_id} · Max attempts: {q.max_attempts}</p>
              </div>
              <button className="btn btn-danger btn-sm" style={{ padding: "0.25rem 0.5rem" }} onClick={() => delMoodle.mutate(q.id)}><Trash2 size={12} /></button>
            </div>
          ))}
          {!addingMoodle && <button className="btn btn-sm btn-outline" style={{ width: "100%", color: "var(--clr-accent)", borderColor: "rgba(0,212,170,0.3)" }} onClick={() => setAddingMoodle(true)}><Plus size={13} /> Link Moodle Quiz</button>}
          {addingMoodle && (
            <div style={{ padding: "0.75rem", background: "rgba(0,212,170,0.06)", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <p style={{ fontSize: "0.75rem", color: "var(--clr-muted)" }}>Find your Quiz ID in Moodle: Course → Quiz → URL contains <code>?id=N</code></p>
              <input className="form-control" type="number" placeholder="Moodle Quiz ID (e.g. 42) *" value={mForm.moodle_quiz_id} onChange={e => setMForm(f => ({ ...f, moodle_quiz_id: e.target.value }))} />
              <input className="form-control" placeholder="Quiz title *" value={mForm.title} onChange={e => setMForm(f => ({ ...f, title: e.target.value }))} />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input className="form-control" type="number" placeholder="Max attempts" value={mForm.max_attempts} onChange={e => setMForm(f => ({ ...f, max_attempts: Number(e.target.value) }))} />
                <input className="form-control" type="number" placeholder="Time limit (seconds, optional)" value={mForm.time_limit_secs} onChange={e => setMForm(f => ({ ...f, time_limit_secs: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-sm" style={{ background: "var(--clr-accent)", color: "#000" }} onClick={() => createMoodle.mutate(mForm)} disabled={createMoodle.isPending}><Save size={13} /> {createMoodle.isPending ? "Saving..." : "Save Quiz"}</button>
                <button className="btn btn-outline btn-sm" onClick={() => setAddingMoodle(false)}><X size={13} /></button>
              </div>
              {createMoodle.isError && <p className="form-error">{createMoodle.error?.response?.data?.detail || "Error saving quiz"}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Lesson Row ─────────────────────────────────────────────────────────────
function LessonRow({ lesson, moduleId, onDelete }) {
  const qc = useQueryClient();
  const [showBlocks, setShowBlocks] = useState(false);
  const [showAssessments, setShowAssessments] = useState(false);
  const [editing, setEditing] = useState(false);

  const update = useMutation({
    mutationFn: (data) => adminAPI.updateLesson(lesson.id, data),
    onSuccess: () => { qc.invalidateQueries(["course-admin"]); setEditing(false); },
  });

  return (
    <div style={{ paddingLeft: "1.5rem", borderLeft: "2px solid var(--clr-border)", margin: "0.375rem 0 0.375rem 1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0" }}>
        <ChevronRight size={12} color="var(--clr-muted)" />
        <span style={{ fontSize: "0.8rem", flex: 1 }}>{lesson.title}</span>
        <span style={{ fontSize: "0.7rem", color: lesson.is_published ? "var(--clr-success)" : "var(--clr-muted)" }}>{lesson.is_published ? "Published" : "Draft"}</span>
        <button className="btn btn-sm btn-outline" style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }} onClick={() => { setShowBlocks(s => !s); setShowAssessments(false); }}>
          {showBlocks ? "Hide Blocks" : "Content Blocks"}
        </button>
        <button className="btn btn-sm btn-outline" style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem", color: "var(--clr-accent)", borderColor: "rgba(0,212,170,0.4)" }} onClick={() => { setShowAssessments(s => !s); setShowBlocks(false); }}>
          {showAssessments ? "Hide Assessments" : "Assessments"}
        </button>
        <button className="btn btn-sm btn-outline" style={{ padding: "0.2rem 0.5rem" }} onClick={() => setEditing(e => !e)}><Edit2 size={11} /></button>
        <button className="btn btn-danger btn-sm" style={{ padding: "0.2rem 0.5rem" }} onClick={onDelete}><Trash2 size={11} /></button>
      </div>
      {editing && (
        <InlineForm
          fields={[
            { name: "title", label: "Title", placeholder: "Lesson title", default: lesson.title },
            { name: "order", label: "Order", type: "number", default: lesson.order, flex: "0 0 80px" },
            { name: "is_published", label: "Status", type: "select", default: lesson.is_published ? "true" : "false", flex: "0 0 110px",
              options: [{ value: "true", label: "Published" }, { value: "false", label: "Draft" }] },
            { name: "is_preview", label: "Preview", type: "select", default: lesson.is_preview ? "true" : "false", flex: "0 0 100px",
              options: [{ value: "false", label: "No" }, { value: "true", label: "Yes (free preview)" }] },
          ]}
          onSave={(vals) => update.mutate({ ...vals, is_published: vals.is_published === "true", is_preview: vals.is_preview === "true" })}
          onCancel={() => setEditing(false)}
          saving={update.isPending}
        />
      )}
      {showBlocks && <BlockEditor lessonId={lesson.id} onClose={() => setShowBlocks(false)} />}
      {showAssessments && <AssessmentsEditor lessonId={lesson.id} onClose={() => setShowAssessments(false)} />}
    </div>
  );
}

// ── Module Card ────────────────────────────────────────────────────────────
function ModuleCard({ mod, courseSlug }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [addLesson, setAddLesson] = useState(false);

  const delLesson = useMutation({
    mutationFn: (id) => adminAPI.deleteLesson(id),
    onSuccess: () => qc.invalidateQueries(["course-admin"]),
  });
  const createLesson = useMutation({
    mutationFn: (data) => adminAPI.createLesson(mod.id, data),
    onSuccess: () => { qc.invalidateQueries(["course-admin"]); setAddLesson(false); },
  });
  const delMod = useMutation({
    mutationFn: () => adminAPI.deleteModule(mod.id),
    onSuccess: () => qc.invalidateQueries(["course-admin"]),
  });

  return (
    <div style={{ border: "1px solid var(--clr-border)", borderRadius: "var(--radius-sm)", marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem", background: "var(--clr-surface)", cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span style={{ fontWeight: 600, flex: 1, fontSize: "0.9rem" }}>{mod.title}</span>
        <span className="text-muted" style={{ fontSize: "0.75rem" }}>{(mod.lessons || []).length} lessons</span>
        <button className="btn btn-primary btn-sm" style={{ padding: "0.25rem 0.625rem" }} onClick={e => { e.stopPropagation(); setAddLesson(a => !a); }}><Plus size={12} /> Lesson</button>
        <button className="btn btn-danger btn-sm" style={{ padding: "0.25rem 0.5rem" }} onClick={e => { e.stopPropagation(); if (confirm("Delete module?")) delMod.mutate(); }}><Trash2 size={12} /></button>
      </div>
      {open && (
        <div style={{ padding: "0.5rem 0 0.75rem", background: "var(--clr-bg)" }}>
          {addLesson && (
            <div style={{ padding: "0 1rem 0.5rem" }}>
              <InlineForm
                fields={[
                  { name: "title", label: "Lesson Title", placeholder: "New lesson" },
                  { name: "order", label: "Order", type: "number", default: (mod.lessons || []).length + 1, flex: "0 0 80px" },
                ]}
                onSave={createLesson.mutate}
                onCancel={() => setAddLesson(false)}
                saving={createLesson.isPending}
              />
            </div>
          )}
          {(mod.lessons || []).map(l => (
            <LessonRow key={l.id} lesson={l} moduleId={mod.id} onDelete={() => { if (confirm("Delete lesson?")) delLesson.mutate(l.id); }} />
          ))}
          {(mod.lessons || []).length === 0 && !addLesson && <p className="text-muted" style={{ fontSize: "0.8rem", padding: "0 1.5rem" }}>No lessons yet.</p>}
        </div>
      )}
    </div>
  );
}

// ── Course Editor ──────────────────────────────────────────────────────────
function CourseEditor({ course, onBack }) {
  const qc = useQueryClient();
  const [addMod, setAddMod] = useState(false);

  const { data: detail } = useQuery({
    queryKey: ["course-admin", course.slug],
    queryFn: () => coursesAPI.detail(course.slug).then(r => r.data),
  });

  const createMod = useMutation({
    mutationFn: (data) => adminAPI.createModule(course.slug, data),
    onSuccess: () => { qc.invalidateQueries(["course-admin", course.slug]); setAddMod(false); },
  });
  const togglePublish = useMutation({
    mutationFn: () => coursesAPI.update(course.slug, { status: detail?.status === "published" ? "draft" : "published" }),
    onSuccess: () => { qc.invalidateQueries(["courses"]); qc.invalidateQueries(["course-admin", course.slug]); },
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <button className="btn btn-outline btn-sm" onClick={onBack}>Back</button>
        <h3 style={{ margin: 0, flex: 1 }}>{course.title}</h3>
        <Link to={`/learn/${course.slug}`} target="_blank" className="btn btn-outline btn-sm">
          <Eye size={13} /> Preview Course
        </Link>
        <button className="btn btn-sm" onClick={() => togglePublish.mutate()}
          style={{ background: detail?.status === "published" ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)", color: detail?.status === "published" ? "var(--clr-danger)" : "var(--clr-success)" }}>
          {detail?.status === "published" ? "Unpublish" : "Publish"}
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => setAddMod(a => !a)}><Plus size={13} /> Module</button>
      </div>

      {addMod && (
        <InlineForm
          fields={[
            { name: "title", label: "Module Title", placeholder: "e.g. Introduction" },
            { name: "order", label: "Order", type: "number", default: (detail?.modules || []).length + 1, flex: "0 0 80px" },
          ]}
          onSave={createMod.mutate}
          onCancel={() => setAddMod(false)}
          saving={createMod.isPending}
        />
      )}

      {!detail && <div className="spinner" style={{ margin: "2rem auto" }} />}
      {(detail?.modules || []).map(m => <ModuleCard key={m.id} mod={m} courseSlug={course.slug} />)}
      {(detail?.modules || []).length === 0 && !addMod && (
        <div style={{ textAlign: "center", padding: "2rem", border: "1px dashed var(--clr-border)", borderRadius: "var(--radius-md)" }}>
          <p className="text-muted">No modules yet. Click "+ Module" to add one.</p>
        </div>
      )}
    </div>
  );
}

// ── Course Create Form ─────────────────────────────────────────────────────
function CourseCreateForm({ onDone }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ 
    title: "", 
    short_description: "", 
    description: "", 
    price: "0", 
    is_free: "true", 
    status: "draft",
    language: "English"
  });
  const [error, setError] = useState(null);
  const ch = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  
  const create = useMutation({
    mutationFn: () => coursesAPI.create({ 
      ...form, 
      is_free: form.is_free === "true", 
      price: parseFloat(form.price) 
    }),
    onSuccess: () => { 
      qc.invalidateQueries(["courses"]); 
      onDone(); 
    },
    onError: (err) => {
      const msg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      setError(msg);
    }
  });

  return (
    <div className="glass" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
      <h4 style={{ marginBottom: "1rem" }}>New Course</h4>
      {error && <div className="alert alert-error" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-control" name="title" placeholder="e.g. Mastering Django" value={form.title} onChange={ch} />
        </div>
        <div className="form-group">
          <label className="form-label">Short Description</label>
          <input className="form-control" name="short_description" placeholder="A one-sentence summary" value={form.short_description} onChange={ch} />
        </div>
        <div className="form-group">
          <label className="form-label">Full Description</label>
          <textarea className="form-control" name="description" placeholder="Detailed course description..." rows={3} value={form.description} onChange={ch} />
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Pricing</label>
            <select className="form-control" name="is_free" value={form.is_free} onChange={ch}>
              <option value="true">Free</option>
              <option value="false">Paid</option>
            </select>
          </div>
          {form.is_free === "false" && (
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Price (BDT)</label>
              <input className="form-control" name="price" type="number" value={form.price} onChange={ch} />
            </div>
          )}
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Status</label>
            <select className="form-control" name="status" value={form.status} onChange={ch}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <button className="btn btn-primary" onClick={() => create.mutate()} disabled={!form.title || create.isPending}>
            {create.isPending ? "Creating..." : "Create Course"}
          </button>
          <button className="btn btn-outline" onClick={onDone}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main CoursesSection ────────────────────────────────────────────────────
export default function CoursesSection() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: () => coursesAPI.list().then(r => Array.isArray(r.data) ? r.data : r.data?.results || []),
  });

  if (editing) return <CourseEditor course={editing} onBack={() => setEditing(null)} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h3 style={{ margin: 0 }}>Courses</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating(c => !c)}><Plus size={14} /> New Course</button>
      </div>

      {creating && <CourseCreateForm onDone={() => setCreating(false)} />}
      {isLoading && <div className="spinner" style={{ margin: "2rem auto" }} />}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {(data || []).map(c => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem 1.25rem", background: "var(--clr-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--clr-border)" }}>
            <BookOpen size={16} color="var(--clr-primary)" />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, marginBottom: "0.125rem" }}>{c.title}</p>
              <p className="text-muted" style={{ fontSize: "0.75rem" }}>{c.lesson_count} lessons · {c.is_free ? "Free" : `BDT ${c.price}`}</p>
            </div>
            <span className={`badge ${c.status === "published" ? "badge-success" : "badge-warning"}`}>{c.status}</span>
            
            <div style={{ display: "flex", gap: "0.375rem" }}>
              <Link to={`/courses/${c.slug}`} target="_blank" className="btn btn-outline btn-sm" title="View Landing Page">
                <Eye size={13} />
              </Link>
              <Link to={`/learn/${c.slug}`} target="_blank" className="btn btn-outline btn-sm" title="View Course Content">
                <ExternalLink size={13} />
              </Link>
              <button className="btn btn-primary btn-sm" onClick={() => setEditing(c)}>
                <Edit2 size={13} /> Manage
              </button>
            </div>
          </div>
        ))}
        {!isLoading && (data || []).length === 0 && <p className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>No courses yet.</p>}
      </div>
    </div>
  );
}
