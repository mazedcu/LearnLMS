import { useEffect, useRef, useState, useCallback } from "react";
import { FileCode2, PlayCircle, FileText, Image as ImageIcon, Puzzle, ListChecks, MoreHorizontal } from "lucide-react";
export { apiErrorMessage } from "../admin/coursesSection/apiError";

/* ── Content types ───────────────────────────────────────────── */
export const BLOCK_META = {
  html:     { label: "HTML page",     icon: FileCode2,  hint: "Interactive HTML file or pasted HTML" },
  video:    { label: "Video",         icon: PlayCircle, hint: "Upload, YouTube/Vimeo, or video library" },
  document: { label: "PDF / Doc",     icon: FileText,   hint: "PDF or document" },
  image:    { label: "Image",         icon: ImageIcon,  hint: "PNG, JPG, WEBP, GIF" },
  h5p:      { label: "H5P activity",  icon: Puzzle,     hint: ".h5p package or embed link" },
  quiz:     { label: "Quiz",          icon: ListChecks, hint: "Auto-marked questions" },
};

export function TypeIcon({ type, size = 18 }) {
  const Icon = BLOCK_META[type]?.icon || FileText;
  return (
    <span className={`cb-block-icon cb-type-${type}`}>
      <Icon size={size} />
    </span>
  );
}

export const ACCEPT = {
  html: ".html,.htm",
  video: "video/*",
  document: ".pdf,.doc,.docx,.ppt,.pptx",
  image: "image/*",
  h5p: ".h5p",
};
export const ACCEPT_ANY = Object.values(ACCEPT).join(",");

/** Guess the block type for a dropped file; null if unsupported. */
export function detectBlockType(file) {
  const name = (file?.name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  if (["html", "htm"].includes(ext)) return "html";
  if (ext === "h5p") return "h5p";
  if (["pdf", "doc", "docx", "ppt", "pptx"].includes(ext)) return "document";
  if (file?.type?.startsWith("video/") || ["mp4", "webm", "mov", "m4v", "mkv", "ogv"].includes(ext)) return "video";
  if (file?.type?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  return null;
}

export function titleFromFile(file) {
  return (file?.name || "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

export function fileName(url) {
  if (!url) return "";
  try { return decodeURIComponent(url.split("?")[0].split("/").pop()); } catch { return url; }
}

/** One-line description of where a block's content comes from. */
export function describeBlock(b) {
  if (b.block_type === "video") {
    if (b.video_url?.includes("youtu")) return "YouTube video";
    if (b.video_url?.includes("vimeo")) return "Vimeo video";
    if (b.video_url?.includes("/api/media/videos/")) return "From video library";
    if (b.video_url) return b.video_url;
    if (b.file) return `Uploaded · ${fileName(b.file)}`;
    return "No video source yet";
  }
  if (b.block_type === "h5p") {
    if (b.file || b.h5p_extracted_path) return `H5P package${b.file ? ` · ${fileName(b.file)}` : ""}`;
    if (b.h5p_embed_url) return "Embedded H5P";
    return "Not configured";
  }
  if (b.file) return `Uploaded · ${fileName(b.file)}`;
  if (b.block_type === "html" && b.html_content) return "Pasted HTML";
  return "Empty";
}

/* ── Small UI pieces ─────────────────────────────────────────── */
export function Switch({ checked, onChange, label, hint, disabled }) {
  return (
    <label className="cb-switch" style={disabled ? { opacity: 0.6, cursor: "default" } : undefined}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="cb-switch-track" />
      <span>
        {label}
        {hint && <span className="cb-switch-hint"> · {hint}</span>}
      </span>
    </label>
  );
}

/** "⋯" button with a dropdown. items: [{label, icon, onClick, danger, disabled} | "divider"] */
export function RowMenu({ items, label = "More actions" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="cb-menu-wrap" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button className="cb-icon-btn" aria-label={label} title={label} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="cb-menu" role="menu">
          {items.filter(Boolean).map((it, i) =>
            it === "divider" ? <hr key={i} /> : (
              <button
                key={i}
                role="menuitem"
                className={it.danger ? "danger" : ""}
                disabled={it.disabled}
                onClick={() => { setOpen(false); it.onClick(); }}
              >
                {it.icon && <it.icon size={14} />} {it.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

/** Text that turns into an input on click; saves on Enter/blur, cancels on Escape. */
export function InlineEdit({ value, onSave, className, placeholder, autoEdit = false, onCancel }) {
  const [editing, setEditing] = useState(autoEdit);
  const [draft, setDraft] = useState(value || "");
  useEffect(() => { if (!editing) setDraft(value || ""); }, [value, editing]);
  const commit = () => {
    const v = draft.trim();
    setEditing(false);
    if (v && v !== value) onSave(v);
    else if (!v) onCancel?.();
  };
  if (editing) {
    return (
      <input
        className="cb-inline-input"
        autoFocus
        value={draft}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setEditing(false); setDraft(value || ""); onCancel?.(); }
        }}
      />
    );
  }
  return (
    <button className={className} onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }} title="Double-click to rename">
      {value || placeholder}
    </button>
  );
}

/* ── Toast ───────────────────────────────────────────────────── */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const show = useCallback((message, kind = "info") => {
    clearTimeout(timer.current);
    setToast({ message, kind });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  const node = toast ? <div className={`cb-toast ${toast.kind === "error" ? "error" : ""}`} role="status">{toast.message}</div> : null;
  return [show, node];
}

/* ── Drag position helper ────────────────────────────────────── */
export function dropPosition(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
}
