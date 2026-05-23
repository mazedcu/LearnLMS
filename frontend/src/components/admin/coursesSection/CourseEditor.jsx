import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Eye, Trash2, Edit2, Save, X } from "lucide-react";
import { coursesAPI, adminAPI } from "../../../api";
import InlineForm from "./InlineForm";
import ModuleCard from "./ModuleCard";

export default function CourseEditor({ course, onBack }) {
  const qc = useQueryClient();
  const [addMod, setAddMod] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(course.title);

  const delCourse = useMutation({
    mutationFn: () => adminAPI.deleteCourse(course.slug),
    onSuccess: () => {
      qc.invalidateQueries(["admin-courses"]);
      onBack();
    },
  });

  const { data: detail, isLoading } = useQuery({
    queryKey: ["course-admin", course.slug],
    queryFn: () => coursesAPI.detail(course.slug).then((r) => r.data),
  });

  const createMod = useMutation({
    mutationFn: (data) => adminAPI.createModule(course.slug, data),
    onSuccess: () => {
      qc.invalidateQueries(["course-admin", course.slug]);
      setAddMod(false);
    },
  });

  const togglePublish = useMutation({
    mutationFn: () =>
      coursesAPI.update(course.slug, {
        status: detail?.status === "published" ? "draft" : "published",
      }),
    onSuccess: () => {
      qc.invalidateQueries(["admin-courses"]);
      qc.invalidateQueries(["course-admin", course.slug]);
    },
  });

  const updateTitle = useMutation({
    mutationFn: (title) => coursesAPI.update(course.slug, { title }),
    onSuccess: () => {
      qc.invalidateQueries(["admin-courses"]);
      qc.invalidateQueries(["course-admin", course.slug]);
      setEditingTitle(false);
    },
  });

  const isPublished = detail?.status === "published";
  const modules = detail?.modules || [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <button className="btn btn-outline btn-sm" onClick={onBack}>Back</button>
        {editingTitle ? (
          <div style={{ display: "flex", gap: "0.5rem", flex: 1, alignItems: "center" }}>
            <input
              className="form-control"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              style={{ fontSize: "1.1rem", fontWeight: 600 }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") updateTitle.mutate(titleInput);
                if (e.key === "Escape") {
                  setEditingTitle(false);
                  setTitleInput(course.title);
                }
              }}
            />
            <button
              className="btn btn-success btn-sm"
              onClick={() => updateTitle.mutate(titleInput)}
              disabled={updateTitle.isPending}
            >
              <Save size={13} />
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setEditingTitle(false);
                setTitleInput(course.title);
              }}
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
            <h3 style={{ margin: 0 }}>{detail?.title || course.title}</h3>
            <button
              className="btn btn-outline btn-sm"
              style={{ padding: "0.25rem 0.5rem" }}
              onClick={() => {
                setTitleInput(detail?.title || course.title);
                setEditingTitle(true);
              }}
              title="Edit course title"
            >
              <Edit2 size={13} />
            </button>
          </div>
        )}
        <a
          href={`/learn/${course.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-sm"
        >
          <Eye size={13} /> Preview Course
        </a>
        <button
          className="btn btn-sm"
          onClick={() => togglePublish.mutate()}
          disabled={togglePublish.isPending}
          style={{
            background: isPublished ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
            color: isPublished ? "var(--clr-danger)" : "var(--clr-success)",
          }}
        >
          {isPublished ? "Unpublish" : "Publish"}
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => setAddMod((a) => !a)}>
          <Plus size={13} /> Module
        </button>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => {
            if (confirm(`Delete "${course.title}"? This cannot be undone.`)) {
              delCourse.mutate();
            }
          }}
          disabled={delCourse.isPending}
          title="Delete course"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {addMod && (
        <InlineForm
          fields={[
            { name: "title", label: "Module Title", placeholder: "e.g. Introduction" },
            { name: "order", label: "Order", type: "number", default: modules.length + 1, flex: "0 0 80px" },
          ]}
          onSave={createMod.mutate}
          onCancel={() => setAddMod(false)}
          saving={createMod.isPending}
        />
      )}

      {isLoading && <div className="spinner" style={{ margin: "2rem auto" }} />}
      {modules.map((m) => (
        <ModuleCard key={m.id} mod={m} />
      ))}
      {!isLoading && modules.length === 0 && !addMod && (
        <div style={{ textAlign: "center", padding: "2rem", border: "1px dashed var(--clr-border)", borderRadius: "var(--radius-md)" }}>
          <p className="text-muted">No modules yet. Click "+ Module" to add one.</p>
        </div>
      )}
    </div>
  );
}
