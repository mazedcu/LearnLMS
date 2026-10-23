import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2, ImagePlus, X } from "lucide-react";
import { coursesAPI } from "../../api";

/* ── Edit Details Panel ──────────────────────────────────────────── */
export function EditDetailsPanel({ detail, courseSlug, onSaved }) {
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
      qc.invalidateQueries({ queryKey: ["course-admin", courseSlug] });
      qc.invalidateQueries({ queryKey: ["builder-outline", courseSlug] });
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

/* ── Drawer wrapper used by the Course Builder ─────────────────── */
export default function CourseSettingsDrawer({ slug, onClose }) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ["course-admin", slug],
    queryFn: () => coursesAPI.detail(slug).then((r) => r.data),
  });
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <>
      <div className="cb-drawer-backdrop" onClick={onClose} />
      <aside className="cb-drawer" role="dialog" aria-label="Course settings">
        <div className="cb-drawer-head">
          <h3>Course settings</h3>
          <button className="cb-icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="cb-drawer-body">
          {isLoading || !detail ? <div className="spinner" style={{ margin: "2rem auto" }} /> : <EditDetailsPanel detail={detail} courseSlug={slug} />}
        </div>
      </aside>
    </>
  );
}
