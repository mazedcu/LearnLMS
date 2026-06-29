import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mediaAPI } from "../../api";
import {
  Upload, Video, Link2, Code2, Trash2, Copy, Check,
  Film, Search, X, Play, AlertCircle,
} from "lucide-react";

/* ── Tiny copy-to-clipboard hook ──────────────────────────────── */
function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };
  return { copied, copy };
}

/* ── Format bytes ─────────────────────────────────────────────── */
function fmtSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/* ── Upload Panel ─────────────────────────────────────────────── */
function UploadPanel({ onDone }) {
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  const [file, setFile]       = useState(null);
  const [title, setTitle]     = useState("");
  const [desc, setDesc]       = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError]     = useState("");

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("file",        file);
      fd.append("title",       title || file.name.replace(/\.[^.]+$/, ""));
      fd.append("description", desc);
      return mediaAPI.uploadVideo(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries(["video-library"]);
      onDone();
    },
    onError: (err) => {
      const d = err.response?.data;
      setError(typeof d === "string" ? d : d?.detail || "Upload failed.");
    },
  });

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    setError("");
  };

  return (
    <div style={{
      background: "#fff", border: "1px solid #E5E7EB",
      borderRadius: "16px", overflow: "hidden", marginBottom: "1.5rem",
      boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
    }}>
      {/* Header */}
      <div style={{
        padding: "1rem 1.5rem", borderBottom: "1px solid #F3F4F6",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <h4 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Upload size={18} color="var(--clr-primary)" /> Upload Video
        </h4>
        <button className="btn btn-outline btn-sm" onClick={onDone}><X size={14} /></button>
      </div>

      <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        {error && <div className="alert alert-error"><AlertCircle size={15} /> {error}</div>}

        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "#6366F1"; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = "#C7D2FE"; }}
          onDrop={e => {
            e.preventDefault();
            e.currentTarget.style.borderColor = "#C7D2FE";
            handleFile(e.dataTransfer.files[0]);
          }}
          style={{
            border: "2px dashed #C7D2FE", borderRadius: "12px",
            padding: "2rem", textAlign: "center", cursor: "pointer",
            background: file ? "rgba(79,70,229,0.03)" : "#FAFBFF",
            transition: "border-color 0.2s",
          }}
        >
          {file ? (
            <div>
              <Film size={36} color="#4F46E5" style={{ margin: "0 auto 0.5rem" }} />
              <p style={{ fontWeight: 600, color: "#374151", margin: 0 }}>{file.name}</p>
              <p style={{ fontSize: "0.78rem", color: "#9CA3AF", marginTop: "4px" }}>{fmtSize(file.size)}</p>
            </div>
          ) : (
            <div>
              <Upload size={36} color="#A5B4FC" style={{ margin: "0 auto 0.6rem" }} />
              <p style={{ fontWeight: 600, color: "#374151", margin: 0 }}>Click or drag a video here</p>
              <p style={{ fontSize: "0.75rem", color: "#9CA3AF", marginTop: "4px" }}>MP4, WebM, MOV, AVI, MKV supported</p>
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }}
          onChange={e => handleFile(e.target.files[0])} />

        {/* Meta fields */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Video Title</label>
          <input className="form-control" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Introduction to Django" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Description (optional)</label>
          <textarea className="form-control" rows={2} value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Brief note about this video..." style={{ resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onDone}>Cancel</button>
          <button className="btn btn-primary" disabled={!file || upload.isPending}
            onClick={() => upload.mutate()}>
            <Upload size={15} /> {upload.isPending ? "Uploading…" : "Upload Video"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Video Card ───────────────────────────────────────────────── */
function VideoCard({ video, onDelete }) {
  const { copied, copy } = useCopy();
  const [showPreview, setShowPreview] = useState(false);

  const directUrl  = video.file_url;
  const embedUrl   = video.embed_url;
  const embedCode  = video.embed_code;
  const streamUrl  = window.location.origin + mediaAPI.streamUrl(video.id);

  const CopyBtn = ({ text, label, id }) => (
    <button
      className="btn btn-sm"
      style={{
        flex: 1,
        background: copied === id ? "rgba(16,185,129,0.08)" : "rgba(79,70,229,0.06)",
        color: copied === id ? "#059669" : "var(--clr-primary)",
        border: `1px solid ${copied === id ? "rgba(16,185,129,0.25)" : "rgba(79,70,229,0.18)"}`,
        fontSize: "0.75rem", gap: "0.3rem",
        transition: "all 0.2s",
      }}
      onClick={() => copy(text, id)}
      title={`Copy ${label}`}
    >
      {copied === id ? <Check size={12} /> : <Copy size={12} />}
      {copied === id ? "Copied!" : label}
    </button>
  );

  return (
    <div style={{
      background: "#fff", border: "1px solid #E5E7EB",
      borderRadius: "14px", overflow: "hidden",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      transition: "box-shadow 0.2s, transform 0.2s",
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.10)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Thumbnail / Preview */}
      <div style={{
        position: "relative", aspectRatio: "16/9",
        background: "linear-gradient(135deg,#1E1B4B,#312E81)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
      }}
        onClick={() => setShowPreview(p => !p)}
      >
        {showPreview ? (
          <video
            src={directUrl} controls autoPlay
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        ) : (
          <>
            <div style={{
              width: "52px", height: "52px", borderRadius: "50%",
              background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid rgba(255,255,255,0.3)",
            }}>
              <Play size={22} color="#fff" style={{ marginLeft: "3px" }} />
            </div>
            <div style={{
              position: "absolute", bottom: "0.5rem", right: "0.6rem",
              background: "rgba(0,0,0,0.55)", color: "#fff",
              fontSize: "0.7rem", padding: "2px 7px", borderRadius: "4px",
            }}>
              {fmtSize(video.size_bytes)}
            </div>
          </>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "0.85rem 1rem" }}>
        <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827", marginBottom: "0.2rem",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {video.title}
        </p>
        {video.description && (
          <p style={{ fontSize: "0.75rem", color: "#9CA3AF", marginBottom: "0.5rem",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {video.description}
          </p>
        )}
        <p style={{ fontSize: "0.7rem", color: "#C4C9D4", marginBottom: "0.75rem" }}>
          {new Date(video.uploaded_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}
        </p>

        {/* Copy buttons */}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
          <CopyBtn text={directUrl} label="Direct Link" id={`direct-${video.id}`} />
          <CopyBtn text={embedUrl}  label="Embed URL"   id={`eurl-${video.id}`} />
        </div>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <CopyBtn text={embedCode} label="Embed Code" id={`ecode-${video.id}`} />
          <CopyBtn text={streamUrl} label="Stream URL" id={`stream-${video.id}`} />
        </div>

        {/* Delete */}
        <button
          className="btn btn-sm"
          style={{
            width: "100%", marginTop: "0.6rem",
            background: "rgba(239,68,68,0.06)", color: "#EF4444",
            border: "1px solid rgba(239,68,68,0.18)", fontSize: "0.75rem",
          }}
          onClick={onDelete}
        >
          <Trash2 size={13} /> Delete Video
        </button>
      </div>
    </div>
  );
}

/* ── Main VideoLibrarySection ─────────────────────────────────── */
export default function VideoLibrarySection() {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [search, setSearch]       = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["video-library"],
    queryFn: () => mediaAPI.listVideos().then(r =>
      Array.isArray(r.data) ? r.data : (r.data?.results || [])
    ),
  });

  const deleteVideo = useMutation({
    mutationFn: (id) => mediaAPI.deleteVideo(id),
    onSuccess: () => qc.invalidateQueries(["video-library"]),
  });

  const videos = (data || []).filter(v =>
    !search || v.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Film size={20} color="var(--clr-primary)" /> Video Library
          </h3>
          <p className="text-muted" style={{ fontSize: "0.82rem", marginTop: "2px" }}>
            Upload videos, copy direct links or embed codes to use anywhere
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setUploading(u => !u)}>
          <Upload size={15} /> Upload Video
        </button>
      </div>

      {/* Upload panel */}
      {uploading && <UploadPanel onDone={() => setUploading(false)} />}

      {/* Search */}
      {(data?.length > 0) && (
        <div style={{ position: "relative", marginBottom: "1.5rem", maxWidth: "340px" }}>
          <Search size={15} style={{ position: "absolute", left: "0.85rem", top: "50%",
            transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
          <input className="form-control" placeholder="Search videos…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: "2.2rem" }} />
        </div>
      )}

      {/* Stats bar */}
      {data?.length > 0 && (
        <div style={{
          display: "flex", gap: "1.5rem", marginBottom: "1.5rem",
          padding: "0.85rem 1.25rem",
          background: "rgba(79,70,229,0.04)", borderRadius: "10px",
          border: "1px solid rgba(79,70,229,0.1)", flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Film size={15} color="var(--clr-primary)" />
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>
              {data.length} video{data.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.82rem", color: "#6B7280" }}>
              Total: {fmtSize(data.reduce((sum, v) => sum + (v.size_bytes || 0), 0))}
            </span>
          </div>
        </div>
      )}

      {/* Grid */}
      {isLoading && <div className="spinner" style={{ margin: "3rem auto" }} />}

      {!isLoading && videos.length === 0 && (
        <div style={{
          textAlign: "center", padding: "4rem 2rem",
          border: "2px dashed #E5E7EB", borderRadius: "16px",
        }}>
          <Film size={48} color="#D1D5DB" style={{ margin: "0 auto 1rem" }} />
          <p style={{ fontWeight: 600, color: "#374151", marginBottom: "0.4rem" }}>
            {search ? "No videos match your search" : "No videos uploaded yet"}
          </p>
          <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: "1.25rem" }}>
            {search ? "Try a different search term." : "Upload your first video to build your media library."}
          </p>
          {!search && (
            <button className="btn btn-primary" onClick={() => setUploading(true)}>
              <Upload size={15} /> Upload First Video
            </button>
          )}
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "1.25rem",
      }}>
        {videos.map(v => (
          <VideoCard
            key={v.id}
            video={v}
            onDelete={() => {
              if (confirm(`Delete "${v.title}"? This cannot be undone.`)) {
                deleteVideo.mutate(v.id);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
