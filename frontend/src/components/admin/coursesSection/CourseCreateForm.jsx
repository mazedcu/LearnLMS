import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { coursesAPI } from "../../../api";
import { apiErrorMessage } from "./apiError";
import { ImagePlus, Trash2, BookOpen } from "lucide-react";

export default function CourseCreateForm({ onDone }) {
  const qc = useQueryClient();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    title: "",
    short_description: "",
    description: "",
    price: "0",
    is_free: "true",
    status: "draft",
    language: "English",
  });
  const [imageFile, setImageFile]     = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError]             = useState(null);

  const change = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

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

  const create = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("title",             form.title);
      fd.append("short_description", form.short_description);
      fd.append("description",       form.description);
      fd.append("is_free",           form.is_free === "true" ? "true" : "false");
      fd.append("price",             form.is_free === "true" ? "0" : form.price || "0");
      fd.append("status",            form.status);
      fd.append("language",          form.language);
      if (imageFile) fd.append("thumbnail", imageFile);
      return coursesAPI.create(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries(["admin-courses"]);
      qc.invalidateQueries(["my-courses"]);
      onDone();
    },
    onError: (err) => setError(apiErrorMessage(err, "Failed to create course.")),
  });

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #E5E7EB",
      borderRadius: "16px",
      overflow: "hidden",
      marginBottom: "1.5rem",
      boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
    }}>
      {/* Header */}
      <div style={{
        padding: "1.25rem 1.5rem",
        borderBottom: "1px solid #F3F4F6",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <h4 style={{ margin: 0, fontSize: "1rem" }}>Create New Course</h4>
        <button className="btn btn-outline btn-sm" onClick={onDone}>Cancel</button>
      </div>

      <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {error && (
          <div className="alert alert-error" style={{ fontSize: "0.85rem" }}>{error}</div>
        )}

        {/* Title */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Course Title *</label>
          <input
            className="form-control" name="title"
            placeholder="e.g. Mastering Django REST Framework"
            value={form.title} onChange={change}
          />
        </div>

        {/* Thumbnail upload */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Course Thumbnail</label>
          {/* Preview / drop zone */}
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
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(0,0,0,0.4)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: "0.35rem", color: "#fff",
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
              <ImagePlus size={13} /> {imagePreview ? "Change Image" : "Upload Image"}
            </button>
            {imagePreview && (
              <button type="button" className="btn btn-sm"
                style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}
                onClick={removeImage}><Trash2 size={13} /></button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }} onChange={handleImageChange} />
          {imageFile && (
            <p style={{ fontSize: "0.72rem", color: "#6B7280", marginTop: "0.3rem" }}>
              ✓ {imageFile.name}
            </p>
          )}
        </div>

        {/* Short description */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Short Description</label>
          <input className="form-control" name="short_description"
            placeholder="A one-sentence summary shown on the course card"
            value={form.short_description} onChange={change} />
        </div>

        {/* Full description */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Full Description</label>
          <textarea className="form-control" name="description"
            placeholder="Detailed course description..." rows={4}
            value={form.description} onChange={change}
            style={{ resize: "vertical" }} />
        </div>

        {/* Pricing card */}
        <div style={{ border: "1.5px solid #E5E7EB", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "0.75rem 1.1rem", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
            <p style={{ fontWeight: 700, fontSize: "0.82rem", color: "#374151", margin: 0 }}>Pricing &amp; Availability</p>
          </div>
          <div style={{ padding: "1.1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>

            {/* Free / Paid toggle */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {["true", "false"].map(val => (
                <label key={val} style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  gap: "0.4rem", padding: "0.6rem 0.75rem",
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
                    checked={form.is_free === val} onChange={change}
                    style={{ accentColor: val === "true" ? "#10B981" : "#4F46E5" }} />
                  <span style={{ fontSize: "0.85rem", fontWeight: 600,
                    color: form.is_free === val
                      ? (val === "true" ? "#059669" : "#4F46E5")
                      : "#6B7280" }}>
                    {val === "true" ? "🎁 Free" : "💳 Paid"}
                  </span>
                </label>
              ))}
            </div>

            {/* Price input — only when paid */}
            {form.is_free === "false" && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Price (BDT)</label>
                <div style={{ position: "relative" }}>
                  <span style={{
                    position: "absolute", left: "0.85rem", top: "50%",
                    transform: "translateY(-50%)", color: "#9CA3AF", fontWeight: 600, fontSize: "0.85rem",
                  }}>৳</span>
                  <input className="form-control" name="price" type="number" min="0" step="1"
                    style={{ paddingLeft: "1.75rem" }}
                    value={form.price} onChange={change} placeholder="e.g. 999" />
                </div>
              </div>
            )}

            {/* Status */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Publish Status</label>
              <select className="form-control" name="status" value={form.status} onChange={change}>
                <option value="draft">Draft — hidden from students</option>
                <option value="published">Published — visible to all</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end", paddingTop: "0.25rem" }}>
          <button className="btn btn-outline" onClick={onDone}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => create.mutate()}
            disabled={!form.title || create.isPending}
          >
            {create.isPending ? "Creating…" : "Create Course"}
          </button>
        </div>
      </div>
    </div>
  );
}
