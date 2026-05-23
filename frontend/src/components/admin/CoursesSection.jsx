import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, BookOpen, Eye, ExternalLink, Trash2 } from "lucide-react";
import { coursesAPI, adminAPI } from "../../api";
import CourseEditor from "./coursesSection/CourseEditor";
import CourseCreateForm from "./coursesSection/CourseCreateForm";

function CourseListItem({ course, onManage, onDelete }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem 1.25rem", background: "var(--clr-surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--clr-border)" }}>
      <BookOpen size={16} color="var(--clr-primary)" />
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 600, marginBottom: "0.125rem" }}>{course.title}</p>
        <p className="text-muted" style={{ fontSize: "0.75rem" }}>
          {course.lesson_count} lessons · {course.is_free ? "Free" : `BDT ${course.price}`}
        </p>
      </div>
      <span className={`badge ${course.status === "published" ? "badge-success" : "badge-warning"}`}>
        {course.status}
      </span>
      <div style={{ display: "flex", gap: "0.375rem" }}>
        <a
          href={`/courses/${course.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-sm"
          title="View Landing Page"
        >
          <Eye size={13} />
        </a>
        <a
          href={`/learn/${course.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-sm"
          title="View Course Content"
        >
          <ExternalLink size={13} />
        </a>
        <button className="btn btn-primary btn-sm" onClick={onManage}>
          <Edit2 size={13} /> Manage
        </button>
        <button
          className="btn btn-danger btn-sm"
          style={{ padding: "0.25rem 0.5rem" }}
          onClick={onDelete}
          title="Delete course"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export default function CoursesSection() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const delCourse = useMutation({
    mutationFn: (slug) => adminAPI.deleteCourse(slug),
    onSuccess: () => qc.invalidateQueries(["admin-courses"]),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: () =>
      coursesAPI.list().then((r) =>
        Array.isArray(r.data) ? r.data : r.data?.results || []
      ),
  });

  if (editing) {
    return <CourseEditor course={editing} onBack={() => setEditing(null)} />;
  }

  const courses = data || [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h3 style={{ margin: 0 }}>Courses</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating((c) => !c)}>
          <Plus size={14} /> New Course
        </button>
      </div>

      {creating && <CourseCreateForm onDone={() => setCreating(false)} />}
      {isLoading && <div className="spinner" style={{ margin: "2rem auto" }} />}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {courses.map((c) => (
          <CourseListItem
            key={c.id}
            course={c}
            onManage={() => setEditing(c)}
            onDelete={() => {
              if (confirm(`Delete "${c.title}"? This cannot be undone.`)) {
                delCourse.mutate(c.slug);
              }
            }}
          />
        ))}
        {!isLoading && courses.length === 0 && (
          <p className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>
            No courses yet.
          </p>
        )}
      </div>
    </div>
  );
}
