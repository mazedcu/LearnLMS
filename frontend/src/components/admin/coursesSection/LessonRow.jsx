import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Edit2, Trash2 } from "lucide-react";
import { adminAPI } from "../../../api";
import InlineForm from "./InlineForm";
import BlockEditor from "./BlockEditor";
import NativeQuizEditor from "./quiz/NativeQuizEditor";

export default function LessonRow({ lesson, onDelete }) {
  const qc = useQueryClient();
  const [showBlocks, setShowBlocks] = useState(false);
  const [showAssessments, setShowAssessments] = useState(false);
  const [editing, setEditing] = useState(false);

  const update = useMutation({
    mutationFn: (data) => adminAPI.updateLesson(lesson.id, data),
    onSuccess: () => {
      qc.invalidateQueries(["course-admin"]);
      setEditing(false);
    },
  });

  return (
    <div style={{ paddingLeft: "1.5rem", borderLeft: "2px solid var(--clr-border)", margin: "0.375rem 0 0.375rem 1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0" }}>
        <ChevronRight size={12} color="var(--clr-muted)" />
        <span style={{ fontSize: "0.8rem", flex: 1 }}>{lesson.title}</span>
        <span style={{ fontSize: "0.7rem", color: lesson.is_published ? "var(--clr-success)" : "var(--clr-muted)" }}>
          {lesson.is_published ? "Published" : "Draft"}
        </span>
        <button
          className="btn btn-sm btn-outline"
          style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}
          onClick={() => {
            setShowBlocks((s) => !s);
            setShowAssessments(false);
          }}
        >
          {showBlocks ? "Hide Blocks" : "Content Blocks"}
        </button>
        <button
          className="btn btn-sm btn-outline"
          style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem", color: "var(--clr-accent)", borderColor: "rgba(0,212,170,0.4)" }}
          onClick={() => {
            setShowAssessments((s) => !s);
            setShowBlocks(false);
          }}
        >
          {showAssessments ? "Hide Assessments" : "Assessments"}
        </button>
        <button
          className="btn btn-sm btn-outline"
          style={{ padding: "0.2rem 0.5rem" }}
          onClick={() => setEditing((e) => !e)}
        >
          <Edit2 size={11} />
        </button>
        <button className="btn btn-danger btn-sm" style={{ padding: "0.2rem 0.5rem" }} onClick={onDelete}>
          <Trash2 size={11} />
        </button>
      </div>
      {editing && (
        <InlineForm
          fields={[
            { name: "title", label: "Title", placeholder: "Lesson title", default: lesson.title },
            { name: "order", label: "Order", type: "number", default: lesson.order, flex: "0 0 80px" },
            {
              name: "is_published",
              label: "Status",
              type: "select",
              default: lesson.is_published ? "true" : "false",
              flex: "0 0 110px",
              options: [
                { value: "true", label: "Published" },
                { value: "false", label: "Draft" },
              ],
            },
            {
              name: "is_preview",
              label: "Preview",
              type: "select",
              default: lesson.is_preview ? "true" : "false",
              flex: "0 0 100px",
              options: [
                { value: "false", label: "No" },
                { value: "true", label: "Yes (free preview)" },
              ],
            },
          ]}
          onSave={(vals) =>
            update.mutate({
              ...vals,
              is_published: vals.is_published === "true",
              is_preview: vals.is_preview === "true",
            })
          }
          onCancel={() => setEditing(false)}
          saving={update.isPending}
        />
      )}
      {showBlocks && <BlockEditor lessonId={lesson.id} onClose={() => setShowBlocks(false)} />}
      {showAssessments && (
        <NativeQuizEditor lessonId={lesson.id} onClose={() => setShowAssessments(false)} />
      )}
    </div>
  );
}
