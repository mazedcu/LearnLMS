import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Eye, Trash2, Edit2, Save, X, ImagePlus, Settings, LayoutList } from "lucide-react";
import { coursesAPI, adminAPI } from "../../../api";
import InlineForm from "./InlineForm";
import ModuleCard from "./ModuleCard";

/* ── Edit Details Panel ──────────────────────────────────────────── */
function EditDetailsPanel({ detail, courseSlug, onSaved }) {
  const qc = useQueryClient();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    title:             detail.title             || "",
    short_description: detail.short_description || "",
    description:       detail.description       || "",
    price:             detail.price             ?? "",
    is_free:           detail.is_free           ? "true" : "false",
    status:            detail.status            || "draft",
  });
  const [imageFile, setImageFile]       = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [success, setSuccess]           = useState(false);
  const [error, setError]               = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const save = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("title",             form.title);
      fd.append("short_description", form.short_description);
      fd.append("description",       form.description);
      fd.append("is_free",           form.is_free === "true" ? "true" : "false");
      fd.append("price",             form.is_free === "true" ? "0" : form.price || "0");
      fd.append("status",            form.status);
      if (imageFile) fd.append("thumbnail", imageFile);
      return coursesAPI.update(courseSlug, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries(["admin-courses"]);
      qc.invalidateQueries(["course-admin", courseSlug]);
      setSuccess(true);
      setImageFile(null);
      setTimeout(() => setSuccess(false), 2000);
      if (onSaved) onSaved();
    },
    onError: (err) => {
      const data = err.response?.data;
      setError(typeof data === "string" ? data : data?.detail || "Save failed.");
    },
  });

  const currentThumb = imagePreview || detail.thumbnail;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {error   && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">✓ Saved successfully!</div>}

      {/* Thumbnail */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Course Thumbnail</label>
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: "100%", aspectRatio: "16/9",
            borderRadius: "10px", overflow: "hidden",
            background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)",
            border: "2px dashed #C7D2FE",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", marginBottom: "0.6rem", position: "relative",
          }}
        >
          {currentThumb ? (
            <>
              <img src={currentThumb} alt="thumbnail"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <div style={{
                position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: "0.35rem", color: "#fff",
                opacity: 0, transition: "opacity 0.2s",
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0}
              >
                <ImagePlus size={24} />
                <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Click to change</span>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", color: "#A5B4FC", pointerEvents: "none" }}>
              <ImagePlus size={32} style={{ margin: "0 auto 0.4rem" }} />
              <p style={{ fontSize: "0.78rem", fontWeight: 600, margin: 0 }}>Click to upload thumbnail</p>
              <p style={{ fontSize: "0.7rem", margin: "3px 0 0", color: "#C7D2FE" }}>PNG, JPG, WEBP — 16:9 recommended</p>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="btn btn-outline btn-sm" style={{ flex: 1 }}
            onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={13} /> {currentThumb ? "Change Image" : "Upload Image"}
          </button>
          {currentThumb && (
            <button type="button" className="btn btn-sm"
              style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}
              onClick={removeImage}><Trash2 size={13} /></button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }} onChange={handleImageChange} />
        {imageFile && <p style={{ fontSize: "0.72rem", color: "#059669", marginTop: "0.3rem" }}>✓ {imageFile.name}</p>}
      </div>

      {/* Title */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Title</label>
        <input className="form-control" name="title" value={form.title} onChange={handleChange} />
      </div>

      {/* Short description */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Short Description</label>
        <textarea className="form-control" name="short_description" rows={2}
          value={form.short_description} onChange={handleChange}
          placeholder="Shown on course card" style={{ resize: "vertical" }} />
        <span style={{ fontSize: "0.72rem", color: "#9CA3AF", textAlign: "right", display: "block" }}>
          {form.short_description.length} / 200
        </span>
      </div>

      {/* Full description */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Full Description</label>
        <textarea className="form-control" name="description" rows={6}
          value={form.description} onChange={handleChange}
          placeholder="Detailed description shown on course detail page" style={{ resize: "vertical" }} />
      </div>

      {/* Pricing card */}
      <div style={{ border: "1.5px solid #E5E7EB", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ padding: "0.65rem 1rem", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
          <p style={{ fontWeight: 700, fontSize: "0.82rem", color: "#374151", margin: 0 }}>Pricing &amp; Status</p>
        </div>
        <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {/* Free / Paid */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {["true", "false"].map(val => (
              <label key={val} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                gap: "0.4rem", padding: "0.55rem",
                borderRadius: "8px", cursor: "pointer",
                border: `1.5px solid ${form.is_free === val
                  ? (val === "true" ? "rgba(16,185,129,0.4)" : "rgba(79,70,229,0.4)")
                  : "#E5E7EB"}`,
                background: form.is_free === val
                  ? (val === "true" ? "rgba(16,185,129,0.06)" : "rgba(79,70,229,0.06)")
                  : "#fff",
                transition: "all 0.15s",
              }}>
                <input type="radio" name="is_free" value={val}
                  checked={form.is_free === val} onChange={handleChange}
                  style={{ accentColor: val === "true" ? "#10B981" : "#4F46E5" }} />
                <span style={{ fontSize: "0.82rem", fontWeight: 600,
                  color: form.is_free === val
                    ? (val === "true" ? "#059669" : "#4F46E5")
                    : "#6B7280" }}>
                  {val === "true" ? "🎁 Free" : "💳 Paid"}
                </span>
              </label>
            ))}
          </div>

          {form.is_free === "false" && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Price (BDT)</label>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute", left: "0.85rem", top: "50%",
                  transform: "translateY(-50%)", color: "#9CA3AF", fontWeight: 600, fontSize: "0.85rem",
                }}>৳</span>
                <input className="form-control" name="price" type="number" min="0"
                  style={{ paddingLeft: "1.75rem" }}
                  value={form.price} onChange={handleChange} placeholder="e.g. 999" />
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Status</label>
            <select className="form-control" name="status" value={form.status} onChange={handleChange}>
              <option value="draft">Draft — hidden from students</option>
              <option value="published">Published — visible to all</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : <><Save size={14} /> Save Changes</>}
        </button>
      </div>
    </div>
  );
}

/* ── Main CourseEditor ───────────────────────────────────────────── */
export default function CourseEditor({ course, onBack }) {
  const qc = useQueryClient();
  const [tab, setTab]           = useState("modules"); // "modules" | "details"
  const [addMod, setAddMod]     = useState(false);

  const delCourse = useMutation({
    mutationFn: () => adminAPI.deleteCourse(course.slug),
    onSuccess: () => { qc.invalidateQueries(["admin-courses"]); onBack(); },
  });

  const { data: detail, isLoading } = useQuery({
    queryKey: ["course-admin", course.slug],
    queryFn:  () => coursesAPI.detail(course.slug).then((r) => r.data),
  });

  const createMod = useMutation({
    mutationFn: (data) => adminAPI.createModule(course.slug, data),
    onSuccess: () => { qc.invalidateQueries(["course-admin", course.slug]); setAddMod(false); },
  });

  const togglePublish = useMutation({
    mutationFn: () => coursesAPI.update(course.slug, {
      status: detail?.status === "published" ? "draft" : "published",
    }),
    onSuccess: () => {
      qc.invalidateQueries(["admin-courses"]);
      qc.invalidateQueries(["course-admin", course.slug]);
    },
  });

  const isPublished = detail?.status === "published";
  const modules     = detail?.modules || [];

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <button className="btn btn-outline btn-sm" onClick={onBack}>← Back</button>
        <h3 style={{ margin: 0, flex: 1, fontSize: "1rem" }}>{detail?.title || course.title}</h3>
        <a href={`/learn/${course.slug}`} target="_blank" rel="noopener noreferrer"
          className="btn btn-outline btn-sm"><Eye size={13} /> Preview</a>
        <button
          className="btn btn-sm" onClick={() => togglePublish.mutate()} disabled={togglePublish.isPending}
          style={{
            background: isPublished ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
            color: isPublished ? "var(--clr-danger)" : "var(--clr-success)",
          }}>
          {isPublished ? "Unpublish" : "Publish"}
        </button>
        <button className="btn btn-danger btn-sm"
          onClick={() => { if (confirm(`Delete "${course.title}"? This cannot be undone.`)) delCourse.mutate(); }}
          disabled={delCourse.isPending}><Trash2 size={13} /></button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0", marginBottom: "1.5rem", borderBottom: "2px solid #F3F4F6" }}>
        {[
          { key: "modules", icon: LayoutList, label: "Modules" },
          { key: "details", icon: Settings, label: "Edit Details" },
        ].map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.6rem 1.1rem", background: "none", border: "none",
              borderBottom: tab === key ? "2px solid var(--clr-primary)" : "2px solid transparent",
              marginBottom: "-2px",
              color: tab === key ? "var(--clr-primary)" : "#6B7280",
              fontWeight: tab === key ? 700 : 500, fontSize: "0.875rem",
              cursor: "pointer", transition: "all 0.15s",
            }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "details" && !isLoading && detail && (
        <EditDetailsPanel detail={detail} courseSlug={course.slug} />
      )}

      {tab === "modules" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
            <button className="btn btn-primary btn-sm" onClick={() => setAddMod(a => !a)}>
              <Plus size={13} /> Add Module
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
          {modules.map((m) => <ModuleCard key={m.id} mod={m} />)}
          {!isLoading && modules.length === 0 && !addMod && (
            <div style={{ textAlign: "center", padding: "2rem", border: "1px dashed var(--clr-border)", borderRadius: "var(--radius-md)" }}>
              <p className="text-muted">No modules yet. Click "+ Add Module" to add one.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
