import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Eye, EyeOff, Pencil, Trash2, ArrowUp, ArrowDown, UploadCloud, Lock, Clock } from "lucide-react";
import { adminAPI, builderAPI, lessonsAPI } from "../../api";
import { BlockRenderer } from "../lesson/LessonBlocks";
import NativeQuizEditor from "../admin/coursesSection/quiz/NativeQuizEditor";
import BlockForm from "./BlockForm";
import {
  BLOCK_META, ACCEPT_ANY, TypeIcon, Switch, RowMenu, describeBlock,
  detectBlockType, titleFromFile, dropPosition, apiErrorMessage,
} from "./shared";

/* ── Unlock rule ─────────────────────────────────────────────── */
const RULES = [
  ["", "Open as soon as the student enrolls"],
  ["completion", "After finishing another lesson"],
  ["time", "A number of days after enrolling"],
  ["quiz_score", "After passing a quiz"],
  ["manual", "When I unlock it for each student"],
];

function UnlockRule({ lesson, allLessons, onSaved, toast }) {
  const rule = lesson.drip_rule;
  const fromRule = () => ({
    type: rule?.criteria_type || "",
    required_lesson: rule?.required_lesson || "",
    unlock_after_days: rule?.unlock_after_days ?? 7,
    required_quiz: rule?.required_quiz || "",
    required_score: rule?.required_score ?? 70,
  });
  const [form, setForm] = useState(fromRule);
  useEffect(() => { setForm(fromRule()); }, [lesson.id, JSON.stringify(rule)]); // eslint-disable-line react-hooks/exhaustive-deps

  const others = allLessons.filter((l) => l.id !== lesson.id);
  const quizzes = allLessons.flatMap((l) => (l.quizzes || []).map((q) => ({ ...q, lessonTitle: l.title })));
  const dirty = JSON.stringify(form) !== JSON.stringify(fromRule());

  const save = useMutation({
    mutationFn: async () => {
      if (!form.type) return rule ? builderAPI.deleteDrip(lesson.id) : null;
      const data = {
        lesson: lesson.id,
        criteria_type: form.type,
        required_lesson: form.type === "completion" ? form.required_lesson || null : null,
        unlock_after_days: form.type === "time" ? Number(form.unlock_after_days) || 0 : null,
        required_quiz: form.type === "quiz_score" ? form.required_quiz || null : null,
        required_score: form.type === "quiz_score" ? Number(form.required_score) || 0 : null,
        is_globally_locked: form.type === "manual",
      };
      return rule ? builderAPI.updateDrip(lesson.id, data) : builderAPI.createDrip(data);
    },
    onSuccess: () => { onSaved(); toast("Unlock rule saved"); },
    onError: (e) => toast(apiErrorMessage(e, "Couldn't save the unlock rule."), "error"),
  });

  const invalid =
    (form.type === "completion" && !form.required_lesson) ||
    (form.type === "quiz_score" && !form.required_quiz);

  return (
    <div className="cb-rule">
      <span className="cb-rule-label"><Lock size={14} /> Unlock</span>
      <select className="cb-select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} aria-label="Unlock rule">
        {RULES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>

      {form.type === "completion" && (
        <select className="cb-select" value={form.required_lesson} onChange={(e) => setForm((f) => ({ ...f, required_lesson: e.target.value }))} aria-label="Required lesson">
          <option value="">Choose lesson…</option>
          {others.map((l) => <option key={l.id} value={l.id}>{l.moduleTitle} › {l.title}</option>)}
        </select>
      )}
      {form.type === "time" && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem" }}>
          <input className="cb-input" type="number" min="0" style={{ width: 70 }} value={form.unlock_after_days}
            onChange={(e) => setForm((f) => ({ ...f, unlock_after_days: e.target.value }))} aria-label="Days" /> days
        </span>
      )}
      {form.type === "quiz_score" && (
        <>
          <select className="cb-select" value={form.required_quiz} onChange={(e) => setForm((f) => ({ ...f, required_quiz: e.target.value }))} aria-label="Required quiz">
            <option value="">Choose quiz…</option>
            {quizzes.map((q) => <option key={q.id} value={q.id}>{q.lessonTitle} › {q.title}</option>)}
          </select>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem" }}>
            min <input className="cb-input" type="number" min="0" max="100" style={{ width: 64 }} value={form.required_score}
              onChange={(e) => setForm((f) => ({ ...f, required_score: e.target.value }))} aria-label="Minimum score" /> %
          </span>
        </>
      )}

      <span className="cb-settings-spacer" />
      {dirty && (
        <button className="cb-btn cb-btn-primary" onClick={() => save.mutate()} disabled={save.isPending || invalid}>
          {save.isPending ? "Saving…" : "Save rule"}
        </button>
      )}
      {form.type === "quiz_score" && quizzes.length === 0 && (
        <span className="cb-rule-note">No quizzes in this course yet — add one to a lesson first.</span>
      )}
      {form.type === "manual" && (
        <span className="cb-rule-note">Students see "Your teacher will unlock this lesson" until you unlock it for them.</span>
      )}
    </div>
  );
}

/* ── One content block ───────────────────────────────────────── */
function BlockCard({ block, index, count, onMove, onDelete, onSaved, dragProps, dropClass, toast }) {
  const [mode, setMode] = useState(null); // null | 'preview' | 'edit'
  const [progress, setProgress] = useState(null);

  const save = useMutation({
    mutationFn: (fd) => builderAPI.updateBlock(block.id, fd, setProgress),
    onSuccess: () => { setMode(null); setProgress(null); onSaved(); toast("Saved"); },
    onError: () => setProgress(null),
  });

  return (
    <div className={`cb-block${mode === "edit" ? " editing" : ""}${dropClass}`} {...dragProps} draggable={!mode}>
      <div className="cb-block-row">
        <span className="cb-handle" aria-hidden><GripVertical size={15} /></span>
        <TypeIcon type={block.block_type} />
        <div className="cb-block-body">
          <div className="cb-block-title">{block.title || BLOCK_META[block.block_type]?.label}</div>
          <div className="cb-block-sub">{BLOCK_META[block.block_type]?.label} · {describeBlock(block)}</div>
        </div>
        <div className="cb-block-actions">
          <button className="cb-icon-btn" title={mode === "preview" ? "Hide preview" : "Preview"} aria-label="Preview"
            onClick={() => setMode(mode === "preview" ? null : "preview")}>
            {mode === "preview" ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button className="cb-icon-btn" title="Edit" aria-label="Edit" onClick={() => setMode(mode === "edit" ? null : "edit")}>
            <Pencil size={15} />
          </button>
          <RowMenu
            label="Content actions"
            items={[
              { label: "Move up", icon: ArrowUp, disabled: index === 0, onClick: () => onMove(index, index - 1) },
              { label: "Move down", icon: ArrowDown, disabled: index === count - 1, onClick: () => onMove(index, index + 1) },
              "divider",
              { label: "Delete", icon: Trash2, danger: true, onClick: onDelete },
            ]}
          />
        </div>
      </div>
      {mode === "preview" && (
        <div className="cb-block-preview">
          <BlockRenderer block={block} />
        </div>
      )}
      {mode === "edit" && (
        <div className="cb-block-form">
          <BlockForm
            type={block.block_type}
            block={block}
            saving={save.isPending}
            error={save.isError ? apiErrorMessage(save.error, "Couldn't save.") : ""}
            onCancel={() => setMode(null)}
            onSubmit={(fd) => save.mutate(fd)}
          />
          {progress !== null && progress < 100 && <div className="cb-progress"><div style={{ width: `${progress}%` }} /></div>}
        </div>
      )}
    </div>
  );
}

/* ── Lesson editor ───────────────────────────────────────────── */
export default function LessonPanel({ lesson, moduleTitle, allLessons, slug, toast, onLessonChanged, onDeleteLesson }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(lesson.title);
  const [duration, setDuration] = useState(lesson.estimated_duration_mins || "");
  const [adding, setAdding] = useState(null);       // { type, file? }
  const [uploads, setUploads] = useState([]);       // [{ key, name, type, progress, error }]
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);           // { id, pos }
  const [fileOver, setFileOver] = useState(false);
  const [quizStart, setQuizStart] = useState(0);    // bump to open "create quiz"
  const fileInput = useRef(null);
  const quizRef = useRef(null);
  const addFormRef = useRef(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    setTitle(lesson.title);
    setDuration(lesson.estimated_duration_mins || "");
    setAdding(null);
  }, [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocksKey = ["builder-blocks", lesson.id];
  const { data: blocks = [], isLoading } = useQuery({
    queryKey: blocksKey,
    queryFn: () => lessonsAPI.blocks(lesson.id).then((r) => (Array.isArray(r.data) ? r.data : r.data?.results || [])),
  });

  const refreshBlocks = () => {
    qc.invalidateQueries({ queryKey: blocksKey });
    qc.invalidateQueries({ queryKey: ["blocks", lesson.id] }); // student view cache
    onLessonChanged();
  };

  const updateLesson = useMutation({
    mutationFn: (data) => adminAPI.updateLesson(lesson.id, data),
    onSuccess: () => onLessonChanged(),
    onError: (e) => toast(apiErrorMessage(e, "Couldn't save the lesson."), "error"),
  });

  const createBlock = useMutation({
    mutationFn: (fd) => builderAPI.createBlock(lesson.id, fd),
    onSuccess: () => { setAdding(null); refreshBlocks(); toast("Added to lesson"); },
  });

  const deleteBlock = useMutation({
    mutationFn: (id) => adminAPI.deleteBlock(id),
    onSuccess: () => { refreshBlocks(); toast("Deleted"); },
  });

  // Optimistic reorder
  const reorder = (from, to) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    qc.setQueryData(blocksKey, next);
    builderAPI.reorderBlocks(lesson.id, next.map((b) => b.id))
      .then(refreshBlocks)
      .catch(() => { toast("Couldn't save the new order.", "error"); refreshBlocks(); });
  };

  // Upload files dropped/chosen straight into the lesson
  const uploadFiles = (files) => {
    const list = Array.from(files || []);
    const skipped = [];
    list.forEach((file) => {
      const type = detectBlockType(file);
      if (!type) { skipped.push(file.name); return; }
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      setUploads((u) => [...u, { key, name: file.name, type, progress: 0 }]);
      const fd = new FormData();
      fd.append("block_type", type);
      fd.append("title", titleFromFile(file));
      fd.append("file", file);
      builderAPI.createBlock(lesson.id, fd, (p) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: p } : x))))
        .then(() => { setUploads((u) => u.filter((x) => x.key !== key)); refreshBlocks(); })
        .catch((e) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: apiErrorMessage(e, "Upload failed") } : x))));
    });
    if (skipped.length) toast(`Can't add ${skipped.join(", ")} — use HTML, video, PDF/Doc, image or .h5p files.`, "error");
  };

  const isFileDrag = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");

  const saveTitle = () => {
    const t = title.trim();
    if (!t) return setTitle(lesson.title);
    if (t !== lesson.title) updateLesson.mutate({ title: t });
  };
  const saveDuration = () => {
    const d = Number(duration) || 0;
    if (d !== (lesson.estimated_duration_mins || 0)) updateLesson.mutate({ estimated_duration_mins: d });
  };

  const startAdd = (type) => {
    if (type === "quiz") {
      setQuizStart((n) => n + 1);
      setTimeout(() => quizRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return;
    }
    setAdding({ type });
    setTimeout(() => addFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  return (
    <div
      className="cb-main-inner"
      onDragEnter={(e) => { if (isFileDrag(e)) { dragDepth.current += 1; setFileOver(true); } }}
      onDragLeave={(e) => { if (isFileDrag(e)) { dragDepth.current -= 1; if (dragDepth.current <= 0) setFileOver(false); } }}
      onDragOver={(e) => { if (isFileDrag(e)) e.preventDefault(); }}
      onDrop={(e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault(); dragDepth.current = 0; setFileOver(false);
        uploadFiles(e.dataTransfer.files);
      }}
    >
      {fileOver && <div className="cb-drop-overlay"><UploadCloud size={22} style={{ marginRight: 8 }} /> Drop to add to "{lesson.title}"</div>}

      {/* Header */}
      <div className="cb-lesson-header">
        <div className="cb-crumb">{moduleTitle}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          className="cb-title-input"
          value={title}
          aria-label="Lesson title"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setTitle(lesson.title); e.currentTarget.blur(); } }}
        />
        <a className="cb-btn cb-btn-ghost" href={`/learn/${slug}/${lesson.id}`} target="_blank" rel="noopener noreferrer" title="Open this lesson as a student sees it">
          <Eye size={15} /> <span className="cb-label">View as student</span>
        </a>
        <RowMenu label="Lesson actions" items={[{ label: "Delete lesson", icon: Trash2, danger: true, onClick: onDeleteLesson }]} />
        </div>
      </div>

      <div className="cb-settings">
        <Switch checked={lesson.is_published} onChange={(v) => updateLesson.mutate({ is_published: v })}
          label="Published" hint={lesson.is_published ? "students can see it" : "hidden from students"} />
        <Switch checked={lesson.is_preview} onChange={(v) => updateLesson.mutate({ is_preview: v })}
          label="Free preview" hint="open to anyone" />
        <span className="cb-duration">
          <Clock size={14} color="var(--clr-muted)" />
          <input type="number" min="0" value={duration} placeholder="0" aria-label="Duration in minutes"
            onChange={(e) => setDuration(e.target.value)} onBlur={saveDuration}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} /> min
        </span>
      </div>

      <UnlockRule lesson={lesson} allLessons={allLessons} onSaved={onLessonChanged} toast={toast} />

      {/* Content */}
      <section className="cb-section">
        <div className="cb-section-head">
          <div>
            <h3>Lesson content</h3>
            <p>Students see these in order. Drag to rearrange.</p>
          </div>
        </div>

        {isLoading && <div className="spinner" style={{ margin: "1.5rem auto" }} />}

        <div className="cb-blocks" onDragOver={(e) => dragId && e.preventDefault()}
          onDrop={(e) => {
            if (!dragId || !over) return;
            e.preventDefault();
            const from = blocks.findIndex((b) => b.id === dragId);
            let to = blocks.findIndex((b) => b.id === over.id) + (over.pos === "after" ? 1 : 0);
            if (from < to) to -= 1;
            reorder(from, to);
            setDragId(null); setOver(null);
          }}>
          {blocks.map((b, i) => (
            <BlockCard
              key={b.id}
              block={b}
              index={i}
              count={blocks.length}
              toast={toast}
              onMove={reorder}
              onSaved={refreshBlocks}
              onDelete={() => { if (confirm(`Delete "${b.title || BLOCK_META[b.block_type]?.label}"?`)) deleteBlock.mutate(b.id); }}
              dropClass={over?.id === b.id && dragId && dragId !== b.id ? ` cb-drop-line cb-drop-${over.pos}` : ""}
              dragProps={{
                draggable: true,
                onDragStart: (e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", b.id);
                  setDragId(b.id);
                },
                onDragEnd: () => { setDragId(null); setOver(null); },
                onDragOver: (e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  setOver({ id: b.id, pos: dropPosition(e) });
                },
              }}
            />
          ))}

          {uploads.map((u) => (
            <div key={u.key} className="cb-block">
              <div className="cb-block-row">
                <span className="cb-handle" />
                <TypeIcon type={u.type} />
                <div className="cb-block-body">
                  <div className="cb-block-title">{u.name}</div>
                  {u.error ? (
                    <div className="cb-block-sub" style={{ color: "var(--clr-danger)" }}>{u.error}</div>
                  ) : (
                    <>
                      <div className="cb-block-sub">Uploading… {u.progress}%</div>
                      <div className="cb-progress"><div style={{ width: `${u.progress}%` }} /></div>
                    </>
                  )}
                </div>
                {u.error && (
                  <button className="cb-icon-btn" aria-label="Dismiss" onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add form for a chosen type */}
        {adding && (
          <div ref={addFormRef} className="cb-block editing" style={{ marginTop: blocks.length ? "0.625rem" : 0 }}>
            <div className="cb-block-row">
              <span className="cb-handle" />
              <TypeIcon type={adding.type} />
              <div className="cb-block-body">
                <div className="cb-block-title">New {BLOCK_META[adding.type].label.toLowerCase()}</div>
                <div className="cb-block-sub">{BLOCK_META[adding.type].hint}</div>
              </div>
            </div>
            <div className="cb-block-form">
              <BlockForm
                type={adding.type}
                initialFile={adding.file}
                saving={createBlock.isPending}
                error={createBlock.isError ? apiErrorMessage(createBlock.error, "Couldn't add this.") : ""}
                onCancel={() => { setAdding(null); createBlock.reset(); }}
                onSubmit={(fd) => createBlock.mutate(fd)}
              />
            </div>
          </div>
        )}

        {/* Add bar */}
        {!adding && (
          <div style={{ marginTop: blocks.length || uploads.length ? "1rem" : 0 }}>
            {blocks.length === 0 && uploads.length === 0 && !isLoading && (
              <div className="cb-dropzone" style={{ marginBottom: "0.75rem" }} onClick={() => fileInput.current?.click()}>
                <UploadCloud size={26} />
                <strong>Drop files here to build this lesson</strong>
                <span>HTML pages, videos, PDFs, images and .h5p files — add several at once</span>
              </div>
            )}
            <div className="cb-add-grid">
              {Object.entries(BLOCK_META).map(([type, meta]) => (
                <button key={type} className="cb-add-tile" onClick={() => startAdd(type)} title={meta.hint}>
                  <TypeIcon type={type} size={17} />
                  {meta.label}
                </button>
              ))}
            </div>
            {(blocks.length > 0 || uploads.length > 0) && (
              <button className="cb-btn cb-btn-ghost" style={{ marginTop: "0.6rem", width: "100%" }} onClick={() => fileInput.current?.click()}>
                <UploadCloud size={15} /> Upload files (or drag them anywhere on this page)
              </button>
            )}
            <input ref={fileInput} type="file" multiple accept={ACCEPT_ANY} hidden
              onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }} />
          </div>
        )}
      </section>

      {/* Quizzes */}
      <section className="cb-section" ref={quizRef}>
        <div className="cb-section-head">
          <div>
            <h3>Quizzes</h3>
            <p>Shown after the lesson content. Students are marked automatically.</p>
          </div>
        </div>
        <div className="cb-quiz-area">
          <NativeQuizEditor key={lesson.id} lessonId={lesson.id} startCreating={quizStart} onChanged={onLessonChanged} />
        </div>
      </section>
    </div>
  );
}
