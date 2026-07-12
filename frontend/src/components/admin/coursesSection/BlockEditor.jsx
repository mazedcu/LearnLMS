import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, X, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { adminAPI, lessonsAPI } from "../../../api";
import { apiErrorMessage } from "./apiError";

const BLOCK_TYPES = ["html", "h5p", "video", "document", "image"];

// Extract iframe src if user pastes <iframe src="..."> markup.
function extractIframeSrc(text) {
  if (!text.includes("<iframe")) return text;
  const match = text.match(/src="([^"]+)"/);
  return match ? match[1].replace(/&amp;/g, "&") : text;
}

const DEFAULT_FORM = {
  title: "",
  html_content: "",
  h5p_embed_url: "",
  video_url: "",
  is_fullscreen: true,
  order: 1,
};

export default function BlockEditor({ lessonId, onClose }) {
  const qc = useQueryClient();
  const { data: blocks } = useQuery({
    queryKey: ["blocks", lessonId],
    queryFn: () =>
      lessonsAPI.blocks(lessonId).then((r) => (Array.isArray(r.data) ? r.data : r.data?.results || [])),
  });

  const [adding, setAdding] = useState(false);
  const [type, setType] = useState("html");
  const [form, setForm] = useState(DEFAULT_FORM);
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
      return editId ? adminAPI.updateBlock(editId, fd) : adminAPI.createBlock(lessonId, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries(["blocks", lessonId]);
      setAdding(false);
      setEditId(null);
      setFile(null);
      setForm(DEFAULT_FORM);
    },
  });

  const del = useMutation({
    mutationFn: (id) => adminAPI.deleteBlock(id),
    onSuccess: () => qc.invalidateQueries(["blocks", lessonId]),
  });

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const moveBlock = (index, direction) => {
    if (!blocks) return;
    const newBlocks = [...blocks];
    if (direction === "up" && index > 0) {
      const temp = newBlocks[index];
      newBlocks[index] = newBlocks[index - 1];
      newBlocks[index - 1] = temp;
    } else if (direction === "down" && index < newBlocks.length - 1) {
      const temp = newBlocks[index];
      newBlocks[index] = newBlocks[index + 1];
      newBlocks[index + 1] = temp;
    } else {
      return;
    }
    
    // Update the backend orders for swapped blocks
    const promises = newBlocks.map((b, i) => {
      if (b.order !== i + 1) {
        return adminAPI.updateBlock(b.id, { order: i + 1 });
      }
      return null;
    }).filter(Boolean);
    
    Promise.all(promises).then(() => qc.invalidateQueries(["blocks", lessonId]));
  };

  return (
    <div style={{ padding: "1rem", background: "var(--clr-surface)", border: "1px solid var(--clr-border)", borderRadius: "var(--radius-md)", marginTop: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h5 style={{ margin: 0 }}>Content Blocks</h5>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setAdding(true);
              setEditId(null);
              setFile(null);
            }}
          >
            <Plus size={13} /> Add Block
          </button>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={13} /></button>
        </div>
      </div>

      {adding && (
        <div style={{ marginBottom: "1rem", padding: "1rem", background: "rgba(108,99,255,0.06)", borderRadius: "var(--radius-sm)" }}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            {BLOCK_TYPES.map((t) => (
              <button
                key={t}
                className="btn btn-sm"
                onClick={() => setType(t)}
                style={{
                  background: type === t ? "var(--clr-primary)" : "transparent",
                  color: type === t ? "#fff" : "var(--clr-muted)",
                  border: "1px solid var(--clr-border)",
                  textTransform: "capitalize",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input
              className="form-control"
              placeholder="Block title (optional)"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
            />

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                className="form-control"
                placeholder="Order"
                type="number"
                value={form.order}
                onChange={(e) => updateField("order", e.target.value)}
                style={{ flex: 1 }}
              />
              {type === "html" && (
                <label style={{ display: "flex", gap: "0.375rem", alignItems: "center", fontSize: "0.75rem", flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={form.is_fullscreen}
                    onChange={(e) => updateField("is_fullscreen", e.target.checked)}
                  />
                  Fullscreen
                </label>
              )}
            </div>

            {type === "html" && (
              <>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Paste HTML content here..."
                  value={form.html_content}
                  onChange={(e) => updateField("html_content", e.target.value)}
                  style={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                />
                <div style={{ padding: "0.5rem", border: "1px dashed var(--clr-border)", borderRadius: "4px" }}>
                  <p style={{ fontSize: "0.7rem", color: "var(--clr-muted)", marginBottom: "0.25rem" }}>
                    OR Upload HTML File:
                  </p>
                  <input
                    type="file"
                    accept=".html"
                    onChange={(e) => setFile(e.target.files[0])}
                    style={{ fontSize: "0.7rem" }}
                  />
                </div>
              </>
            )}

            {type === "h5p" && (
              <>
                <input
                  className="form-control"
                  placeholder="Paste H5P URL or iframe code..."
                  value={form.h5p_embed_url}
                  onChange={(e) => updateField("h5p_embed_url", extractIframeSrc(e.target.value))}
                  style={{ marginBottom: "0.5rem" }}
                />
                <div style={{ padding: "0.5rem", border: "1px dashed var(--clr-border)", borderRadius: "4px" }}>
                  <p style={{ fontSize: "0.7rem", color: "var(--clr-muted)", marginBottom: "0.25rem" }}>
                    OR Upload H5P File (.h5p):
                  </p>
                  <input
                    type="file"
                    accept=".h5p"
                    onChange={(e) => setFile(e.target.files[0])}
                    style={{ fontSize: "0.7rem" }}
                  />
                </div>
              </>
            )}

            {type === "video" && (
              <>
                <input
                  className="form-control"
                  placeholder="YouTube/Vimeo URL or iframe code..."
                  value={form.video_url}
                  onChange={(e) => updateField("video_url", extractIframeSrc(e.target.value))}
                />
                <p style={{ fontSize: "0.7rem", color: "var(--clr-muted)", textAlign: "center" }}>- OR -</p>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files[0])}
                  style={{ fontSize: "0.7rem" }}
                />
              </>
            )}

            {(type === "document" || type === "image") && (
              <input
                type="file"
                accept={type === "image" ? "image/*" : ".pdf,.doc,.docx"}
                onChange={(e) => setFile(e.target.files[0])}
                style={{ fontSize: "0.7rem" }}
              />
            )}

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => save.mutate(form)}
                disabled={save.isPending}
              >
                <Save size={13} /> {save.isPending ? "Saving..." : "Save Block"}
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => setAdding(false)}>
                <X size={13} />
              </button>
            </div>
            {save.isError && (
              <p className="form-error" style={{ fontSize: "0.7rem", marginTop: "0.5rem" }}>
                {apiErrorMessage(save.error, "Error saving block. Please check the fields.")}
              </p>
            )}
          </div>
        </div>
      )}

      {(blocks || []).length === 0 && !adding && (
        <p className="text-muted" style={{ fontSize: "0.8rem" }}>No content blocks yet.</p>
      )}
      {(blocks || []).map((b, index) => (
        <div
          key={b.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.625rem 0.75rem",
            background: "var(--clr-bg)",
            borderRadius: "var(--radius-sm)",
            marginBottom: "0.375rem",
          }}
        >
          <span style={{ fontSize: "0.8rem" }}>
            <span style={{ background: "rgba(108,99,255,0.15)", color: "var(--clr-primary)", borderRadius: "4px", padding: "1px 6px", fontSize: "0.7rem", marginRight: "0.5rem", textTransform: "capitalize" }}>
              {b.block_type}
            </span>
            {b.title || "(untitled)"}
          </span>
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <button
              className="btn btn-outline btn-sm"
              style={{ padding: "0.25rem 0.5rem" }}
              disabled={index === 0}
              onClick={() => moveBlock(index, "up")}
            >
              <ArrowUp size={12} />
            </button>
            <button
              className="btn btn-outline btn-sm"
              style={{ padding: "0.25rem 0.5rem" }}
              disabled={index === blocks.length - 1}
              onClick={() => moveBlock(index, "down")}
            >
              <ArrowDown size={12} />
            </button>
            <button
              className="btn btn-danger btn-sm"
              style={{ padding: "0.25rem 0.5rem", marginLeft: "0.25rem" }}
              onClick={() => del.mutate(b.id)}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
