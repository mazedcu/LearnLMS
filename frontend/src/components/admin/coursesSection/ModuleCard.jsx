import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ChevronDown, ChevronRight, Edit2, Save, X } from "lucide-react";
import { adminAPI } from "../../../api";
import InlineForm from "./InlineForm";
import LessonRow from "./LessonRow";

export default function ModuleCard({ mod }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [addLesson, setAddLesson] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(mod.title);

  const invalidateCourse = () => qc.invalidateQueries(["course-admin"]);

  const delLesson = useMutation({
    mutationFn: (id) => adminAPI.deleteLesson(id),
    onSuccess: invalidateCourse,
  });

  const createLesson = useMutation({
    mutationFn: (data) => adminAPI.createLesson(mod.id, data),
    onSuccess: () => {
      invalidateCourse();
      setAddLesson(false);
    },
  });

  const delMod = useMutation({
    mutationFn: () => adminAPI.deleteModule(mod.id),
    onSuccess: invalidateCourse,
  });

  const updateTitle = useMutation({
    mutationFn: (title) => adminAPI.updateModule(mod.id, { title }),
    onSuccess: () => {
      invalidateCourse();
      setEditingTitle(false);
    },
  });

  const lessons = mod.lessons || [];

  return (
    <div style={{ border: "1px solid var(--clr-border)", borderRadius: "var(--radius-sm)", marginBottom: "0.75rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.875rem 1rem",
          background: "var(--clr-surface)",
          cursor: "pointer",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {editingTitle ? (
          <div style={{ display: "flex", gap: "0.5rem", flex: 1, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
            <input
              className="form-control"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              style={{ fontSize: "0.9rem", fontWeight: 600 }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") updateTitle.mutate(titleInput);
                if (e.key === "Escape") {
                  setEditingTitle(false);
                  setTitleInput(mod.title);
                }
              }}
            />
            <button className="btn btn-success btn-sm" onClick={() => updateTitle.mutate(titleInput)} disabled={updateTitle.isPending}>
              <Save size={12} />
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => { setEditingTitle(false); setTitleInput(mod.title); }}>
              <X size={12} />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }} onClick={(e) => e.stopPropagation()}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{mod.title}</span>
            <button
              className="btn btn-outline btn-sm"
              style={{ padding: "0.2rem 0.4rem" }}
              onClick={(e) => {
                e.stopPropagation();
                setTitleInput(mod.title);
                setEditingTitle(true);
              }}
              title="Edit module title"
            >
              <Edit2 size={12} />
            </button>
          </div>
        )}
        <span className="text-muted" style={{ fontSize: "0.75rem" }}>{lessons.length} lessons</span>
        <button
          className="btn btn-primary btn-sm"
          style={{ padding: "0.25rem 0.625rem" }}
          onClick={(e) => {
            e.stopPropagation();
            setAddLesson((a) => !a);
            setOpen(true);
          }}
        >
          <Plus size={12} /> Lesson
        </button>
        <button
          className="btn btn-danger btn-sm"
          style={{ padding: "0.25rem 0.5rem" }}
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Delete module?")) delMod.mutate();
          }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {open && (
        <div style={{ padding: "0.5rem 0 0.75rem", background: "var(--clr-bg)" }}>
          {addLesson && (
            <div style={{ padding: "0 1rem 0.5rem" }}>
              <InlineForm
                fields={[
                  { name: "title", label: "Lesson Title", placeholder: "New lesson" },
                  { name: "order", label: "Order", type: "number", default: lessons.length + 1, flex: "0 0 80px" },
                ]}
                onSave={createLesson.mutate}
                onCancel={() => setAddLesson(false)}
                saving={createLesson.isPending}
              />
            </div>
          )}
          {lessons.map((l) => (
            <LessonRow
              key={l.id}
              lesson={l}
              onDelete={() => {
                if (confirm("Delete lesson?")) delLesson.mutate(l.id);
              }}
            />
          ))}
          {lessons.length === 0 && !addLesson && (
            <p className="text-muted" style={{ fontSize: "0.8rem", padding: "0 1.5rem" }}>
              No lessons yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
