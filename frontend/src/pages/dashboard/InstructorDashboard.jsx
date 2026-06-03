import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";
import { coursesAPI } from "../../api";
import { BookOpen, Users, BarChart2, PlusCircle, Pencil, X, Check, AlertCircle, ImagePlus, Trash2 } from "lucide-react";
import { useState, useRef } from "react";

/* ── Edit Course Modal ───────────────────────────────────────────── */
function EditCourseModal({ courseSlug, onClose }) {
  const queryClient = useQueryClient();

  // Fetch full detail so description & thumbnail are populated
  const { data: fullCourse, isLoading: detailLoading } = useQuery({
    queryKey: ["course-detail-edit", courseSlug],
    queryFn: () => coursesAPI.detail(courseSlug).then(r => r.data),
  });

  const [form, setForm]           = useState(null);
  const [imageFile, setImageFile] = useState(null);    // new File to upload
  const [imagePreview, setImagePreview] = useState(null); // local preview URL
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState("");
  const fileInputRef              = useRef(null);

  // Populate form once detail is loaded
  if (fullCourse && !form) {
    setForm({
      title:             fullCourse.title             || "",
      short_description: fullCourse.short_description || "",
      description:       fullCourse.description       || "",
      price:             fullCourse.price             ?? "",
      is_free:           fullCourse.is_free           ?? false,
      status:            fullCourse.status            || "draft",
    });
  }

  const mutation = useMutation({
    mutationFn: (payload) => {
      // Use FormData so thumbnail file is sent as multipart
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== null && v !== undefined) fd.append(k, v);
      });
      return coursesAPI.update(courseSlug, fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["my-courses"]);
      queryClient.invalidateQueries(["course-detail-edit", courseSlug]);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); }, 1200);
    },
    onError: (err) => {
      const data = err.response?.data;
      const msg = typeof data === "string"
        ? data
        : data?.detail || Object.values(data || {}).flat().join(" ") || "Failed to save.";
      setError(msg);
    },
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    const payload = { ...form };
    if (imageFile) payload.thumbnail = imageFile;
    mutation.mutate(payload);
  };


  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
    >
      {/* Modal panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "640px",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1.5rem 1.75rem",
          borderBottom: "1px solid #F3F4F6",
          position: "sticky", top: 0, background: "#fff", zIndex: 1,
          borderRadius: "20px 20px 0 0",
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Edit Course</h3>
            <p style={{ color: "#9CA3AF", fontSize: "0.8rem", margin: "2px 0 0" }}>
              {fullCourse?.title || courseSlug}
            </p>
          </div>
          <button onClick={onClose} style={{ padding: "0.4rem", borderRadius: "8px", color: "#6B7280", transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
          >
            <X size={20} />
          </button>
        </div>

        {/* Loading state */}
        {(detailLoading || !form) ? (
          <div style={{ padding: "3rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="spinner" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {success && (
            <div className="alert alert-success">
              <Check size={16} /> Saved successfully!
            </div>
          )}

          {/* Title */}
          <div className="form-group">
            <label className="form-label">Course Title</label>
            <input name="title" className="form-control" value={form.title} onChange={handleChange} placeholder="e.g. Bangla Grammar Master Class" />
          </div>

          {/* ── Course Thumbnail ── */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Course Thumbnail</label>

            {/* Preview area */}
            <div style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16/9",
              borderRadius: "12px",
              overflow: "hidden",
              background: "linear-gradient(135deg, #EEF2FF, #F5F3FF)",
              border: "2px dashed #C7D2FE",
              marginBottom: "0.75rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
              onClick={() => fileInputRef.current?.click()}
            >
              {/* Show new preview OR existing thumbnail */}
              {(imagePreview || fullCourse?.thumbnail) ? (
                <>
                  <img
                    src={imagePreview || fullCourse.thumbnail}
                    alt="thumbnail preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  {/* Overlay on hover */}
                  <div style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,0.4)",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    gap: "0.5rem", color: "#fff",
                    opacity: 0, transition: "opacity 0.2s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0}
                  >
                    <ImagePlus size={28} />
                    <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Click to change</span>
                  </div>
                </>
              ) : (
                /* Empty state */
                <div style={{ textAlign: "center", color: "#A5B4FC", pointerEvents: "none" }}>
                  <ImagePlus size={36} style={{ margin: "0 auto 0.5rem" }} />
                  <p style={{ fontSize: "0.8rem", fontWeight: 600, margin: 0 }}>Click to upload thumbnail</p>
                  <p style={{ fontSize: "0.72rem", margin: "4px 0 0", color: "#C7D2FE" }}>PNG, JPG, WEBP — 16:9 recommended</p>
                </div>
              )}
            </div>

            {/* Buttons row */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => fileInputRef.current?.click()}
                style={{ flex: 1 }}
              >
                <ImagePlus size={14} /> {imagePreview || fullCourse?.thumbnail ? "Change Image" : "Upload Image"}
              </button>
              {(imagePreview || fullCourse?.thumbnail) && (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}
                  onClick={handleRemoveImage}
                  title="Remove thumbnail"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={handleImageChange}
            />

            {imageFile && (
              <p style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: "0.4rem" }}>
                ✓ New image selected: <strong>{imageFile.name}</strong>
              </p>
            )}
          </div>

          {/* Short Description */}
          <div className="form-group">
            <label className="form-label">Short Description</label>
            <textarea
              name="short_description"
              className="form-control"
              rows={3}
              value={form.short_description}
              onChange={handleChange}
              placeholder="A brief one-liner shown on the course card (max ~200 chars)"
              style={{ resize: "vertical" }}
            />
            <span style={{ fontSize: "0.75rem", color: "#9CA3AF", textAlign: "right" }}>
              {form.short_description.length} / 200
            </span>
          </div>

          {/* Full Description */}
          <div className="form-group">
            <label className="form-label">Full Description</label>
            <textarea
              name="description"
              className="form-control"
              rows={8}
              value={form.description}
              onChange={handleChange}
              placeholder="Detailed description shown on the course detail page. Supports plain text."
              style={{ resize: "vertical" }}
            />
          </div>

          {/* ── Pricing & Status card ── */}
          <div style={{
            border: "1.5px solid #E5E7EB", borderRadius: "14px", overflow: "hidden",
          }}>
            {/* Section header */}
            <div style={{ padding: "0.85rem 1.25rem", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
              <p style={{ fontWeight: 700, fontSize: "0.85rem", color: "#374151", margin: 0 }}>Pricing &amp; Availability</p>
            </div>
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

              {/* Free toggle — shown first, disables price when on */}
              <label style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", userSelect: "none",
                padding: "0.75rem 1rem",
                borderRadius: "10px",
                background: form.is_free ? "rgba(16,185,129,0.06)" : "#fff",
                border: `1.5px solid ${form.is_free ? "rgba(16,185,129,0.25)" : "#E5E7EB"}`,
                transition: "all 0.2s",
              }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "#111827", margin: 0 }}>Free Course</p>
                  <p style={{ fontSize: "0.75rem", color: "#9CA3AF", margin: "2px 0 0" }}>Students can enroll without payment</p>
                </div>
                <input
                  type="checkbox" name="is_free" checked={form.is_free} onChange={handleChange}
                  style={{ width: "18px", height: "18px", accentColor: "#10B981", cursor: "pointer" }}
                />
              </label>

              {/* Price input — disabled & greyed out when free */}
              <div className="form-group" style={{ marginBottom: 0, opacity: form.is_free ? 0.45 : 1, transition: "opacity 0.2s" }}>
                <label className="form-label">Course Price (BDT)</label>
                <div style={{ position: "relative" }}>
                  <span style={{
                    position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)",
                    color: "#9CA3AF", fontWeight: 600, fontSize: "0.875rem", pointerEvents: "none",
                  }}>৳</span>
                  <input
                    name="price" type="number" min="0" step="1"
                    className="form-control"
                    style={{ paddingLeft: "2rem" }}
                    value={form.is_free ? "" : form.price}
                    onChange={handleChange}
                    disabled={form.is_free}
                    placeholder="e.g. 999"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Publish Status</label>
                <select name="status" className="form-control" value={form.status} onChange={handleChange}>
                  <option value="draft">Draft — hidden from students</option>
                  <option value="published">Published — visible to all</option>
                </select>
              </div>

            </div>
          </div>

          {/* Footer buttons */}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", paddingTop: "0.5rem", borderTop: "1px solid #F3F4F6" }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : <><Check size={15} /> Save Changes</>}
            </button>
          </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Main Dashboard ──────────────────────────────────────────────── */
export default function InstructorDashboard() {
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ["my-courses"], queryFn: () => coursesAPI.list().then(r => r.data) });
  const courses = Array.isArray(data) ? data : (data?.results || []);
  const myCourses = courses.filter(c => c.instructor_id === user?.id || !c.instructor_id);

  const [editingCourse, setEditingCourse] = useState(null);

  return (
    <div className="page">
      <Navbar />

      {/* Edit modal */}
      {editingCourse && (
        <EditCourseModal courseSlug={editingCourse} onClose={() => setEditingCourse(null)} />
      )}

      <div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div>
            <h2 style={{ marginBottom: "0.25rem" }}>Instructor Dashboard</h2>
            <p className="text-muted">Manage your courses and review student submissions</p>
          </div>
          <Link to="/courses/create" className="btn btn-primary"><PlusCircle size={16} /> New Course</Link>
        </div>

        <div className="grid-3" style={{ marginBottom: "2.5rem" }}>
          {[
            { icon: BookOpen,  label: "My Courses",     value: myCourses.length, color: "var(--clr-primary)" },
            { icon: Users,     label: "Total Students", value: "-",              color: "var(--clr-accent)" },
            { icon: BarChart2, label: "Avg Completion", value: "-",              color: "var(--clr-warning)" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="glass" style={{ padding: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ background: `${color}20`, borderRadius: "50%", padding: "0.75rem" }}><Icon size={22} color={color} /></div>
              <div>
                <p className="text-muted" style={{ fontSize: "0.8rem" }}>{label}</p>
                <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--clr-heading)" }}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        <h3 style={{ marginBottom: "1rem" }}>Your Courses</h3>
        {myCourses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", border: "1px dashed var(--clr-border)", borderRadius: "var(--radius-md)" }}>
            <BookOpen size={40} style={{ opacity: 0.3, margin: "0 auto 1rem" }} />
            <p className="text-muted">No courses yet.</p>
            <Link to="/courses/create" className="btn btn-primary" style={{ marginTop: "1rem" }}>Create Your First Course</Link>
          </div>
        ) : (
          <div className="grid-3">
            {myCourses.map(c => (
              <div key={c.id} className="card">
                <div className="card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <h4 style={{ flex: 1, paddingRight: "0.5rem" }}>{c.title}</h4>
                    <span className={`badge ${c.status === "published" ? "badge-success" : "badge-warning"}`}>{c.status}</span>
                  </div>

                  {/* Short description preview */}
                  {c.short_description && (
                    <p style={{
                      fontSize: "0.8rem", color: "#9CA3AF", marginBottom: "0.75rem",
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {c.short_description}
                    </p>
                  )}

                  <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>{c.lesson_count} lessons</p>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Link to={`/courses/${c.slug}`} className="btn btn-outline btn-sm">View</Link>
                    <button
                      className="btn btn-sm"
                      style={{ background: "rgba(79,70,229,0.08)", color: "var(--clr-primary)", border: "1px solid rgba(79,70,229,0.15)" }}
                      onClick={() => setEditingCourse(c.slug)}
                    >
                      <Pencil size={13} /> Edit Details
                    </button>
                    <Link to={`/dashboard/instructor/courses/${c.slug}/analytics`} className="btn btn-sm" style={{ background: "rgba(16,185,129,0.08)", color: "#059669", border: "1px solid rgba(16,185,129,0.15)" }}>
                      Analytics
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

