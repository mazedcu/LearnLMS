import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mediaAPI } from "../../api";
import {
  Upload, Video, Trash2, Copy, Check,
  Film, Search, X, Play, AlertCircle, Music,
  Mic, Filter,
} from "lucide-react";

/* ── Helpers ──────────────────────────────────────────────────── */
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

function fmtSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const AUDIO_EXTS = [".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a", ".opus"];
const VIDEO_EXTS = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v"];

function detectType(file) {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return AUDIO_EXTS.includes(ext) ? "audio" : "video";
}

/* ── Upload Panel ─────────────────────────────────────────────── */
function UploadPanel({ onDone }) {
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  const [file, setFile]   = useState(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc]   = useState("");
  const [error, setError] = useState("");
  const [mediaType, setMediaType] = useState("video");

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("file",        file);
      fd.append("title",       title || file.name.replace(/\.[^.]+$/, ""));
      fd.append("description", desc);
      return mediaAPI.uploadVideo(fd);
    },
    onSuccess: () => { qc.invalidateQueries(["media-library"]); onDone(); },
    onError: (err) => {
      const d = err.response?.data;
      setError(typeof d === "string" ? d : d?.detail || "Upload failed.");
    },
  });

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    setMediaType(detectType(f));
    setError("");
  };

  const isAudio = mediaType === "audio";

  return (
    <div style={{
      background: "#fff", border: "1px solid #E5E7EB",
      borderRadius: "16px", overflow: "hidden", marginBottom: "1.5rem",
      boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
    }}>
      <div style={{
        padding: "1rem 1.5rem", borderBottom: "1px solid #F3F4F6",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <h4 style={{ margin: 0, fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Upload size={18} color="var(--clr-primary)" /> Upload Media
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
              {isAudio
                ? <Music size={36} color="#7C3AED" style={{ margin: "0 auto 0.5rem" }} />
                : <Film  size={36} color="#4F46E5" style={{ margin: "0 auto 0.5rem" }} />
              }
              <p style={{ fontWeight: 600, color: "#374151", margin: 0 }}>{file.name}</p>
              <p style={{ fontSize: "0.78rem", color: "#9CA3AF", marginTop: "4px" }}>
                {fmtSize(file.size)} · {isAudio ? "Audio" : "Video"}
              </p>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginBottom: "0.6rem" }}>
                <Film  size={28} color="#A5B4FC" />
                <Music size={28} color="#C4B5FD" />
              </div>
              <p style={{ fontWeight: 600, color: "#374151", margin: 0 }}>Click or drag a file here</p>
              <p style={{ fontSize: "0.75rem", color: "#9CA3AF", marginTop: "4px" }}>
                <strong>Video:</strong> MP4, WebM, MOV, AVI, MKV &nbsp;|&nbsp;
                <strong>Audio:</strong> MP3, WAV, OGG, AAC, FLAC, M4A
              </p>
            </div>
          )}
        </div>

        {/* Hidden file input — accepts both */}
        <input
          ref={fileInputRef} type="file"
          accept="video/*,audio/*,.mp3,.wav,.ogg,.aac,.flac,.m4a,.opus,.mp4,.webm,.mov,.avi,.mkv"
          style={{ display: "none" }}
          onChange={e => handleFile(e.target.files[0])}
        />

        {/* Detected type badge */}
        {file && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#6B7280" }}>Detected type:</span>
            <span style={{
              padding: "2px 10px", borderRadius: "100px", fontSize: "0.72rem", fontWeight: 700,
              background: isAudio ? "rgba(124,58,237,0.1)" : "rgba(79,70,229,0.1)",
              color: isAudio ? "#7C3AED" : "#4F46E5",
              border: `1px solid ${isAudio ? "rgba(124,58,237,0.25)" : "rgba(79,70,229,0.25)"}`,
            }}>
              {isAudio ? "🎵 Audio" : "🎬 Video"}
            </span>
          </div>
        )}

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Title</label>
          <input className="form-control" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Lecture 1 — Introduction" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Description (optional)</label>
          <textarea className="form-control" rows={2} value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Brief note..." style={{ resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
          <button className="btn btn-outline" onClick={onDone}>Cancel</button>
          <button className="btn btn-primary" disabled={!file || upload.isPending}
            onClick={() => upload.mutate()}>
            <Upload size={15} /> {upload.isPending ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Media Card ───────────────────────────────────────────────── */
function MediaCard({ item, onDelete }) {
  const { copied, copy } = useCopy();
  const [playing, setPlaying] = useState(false);
  const isAudio = item.media_type === "audio";

  const CopyBtn = ({ text, label, id }) => (
    <button
      className="btn btn-sm"
      style={{
        flex: 1,
        background: copied === id ? "rgba(16,185,129,0.08)" : "rgba(79,70,229,0.06)",
        color: copied === id ? "#059669" : "var(--clr-primary)",
        border: `1px solid ${copied === id ? "rgba(16,185,129,0.25)" : "rgba(79,70,229,0.15)"}`,
        fontSize: "0.72rem", transition: "all 0.2s",
      }}
      onClick={() => copy(text, id)}
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
      {/* Preview area */}
      {isAudio ? (
        /* Audio card — gradient + waveform style */
        <div style={{
          background: "linear-gradient(135deg,#4C1D95,#5B21B6,#6D28D9)",
          padding: "1.25rem",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem",
        }}>
          <div style={{
            width: "52px", height: "52px", borderRadius: "50%",
            background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid rgba(255,255,255,0.25)",
          }}>
            <Music size={22} color="#fff" />
          </div>
          {/* Inline audio player */}
          <audio
            controls
            src={item.file_url}
            style={{ width: "100%", height: "36px", outline: "none", borderRadius: "8px" }}
          />
        </div>
      ) : (
        /* Video card — dark preview */
        <div style={{
          position: "relative", aspectRatio: "16/9",
          background: "linear-gradient(135deg,#1E1B4B,#312E81)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}
          onClick={() => setPlaying(p => !p)}
        >
          {playing ? (
            <video src={item.file_url} controls autoPlay={false}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
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
                {fmtSize(item.size_bytes)}
              </div>
            </>
          )}
        </div>
      )}

      {/* Info + copy buttons */}
      <div style={{ padding: "0.85rem 1rem" }}>
        {/* Type badge + title */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
          <span style={{
            fontSize: "0.65rem", fontWeight: 700, padding: "1px 6px", borderRadius: "100px",
            background: isAudio ? "rgba(124,58,237,0.1)" : "rgba(79,70,229,0.1)",
            color: isAudio ? "#7C3AED" : "#4F46E5",
            border: `1px solid ${isAudio ? "rgba(124,58,237,0.2)" : "rgba(79,70,229,0.2)"}`,
          }}>
            {isAudio ? "AUDIO" : "VIDEO"}
          </span>
          <p style={{
            fontWeight: 700, fontSize: "0.88rem", color: "#111827",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
          }}>
            {item.title}
          </p>
        </div>
        {item.description && (
          <p style={{ fontSize: "0.74rem", color: "#9CA3AF", marginBottom: "0.4rem",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.description}
          </p>
        )}
        <p style={{ fontSize: "0.68rem", color: "#C4C9D4", marginBottom: "0.75rem" }}>
          {fmtSize(item.size_bytes)} · {new Date(item.uploaded_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}
        </p>

        {/* Copy buttons */}
        <div className="copy-buttons" style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
          <CopyBtn text={item.file_url}  label="Direct Link" id={`dl-${item.id}`} />
          <CopyBtn text={item.embed_url} label="Embed URL"   id={`eu-${item.id}`} />
        </div>
        <div className="copy-buttons" style={{ display: "flex", gap: "0.35rem", marginBottom: "0.5rem" }}>
          <CopyBtn text={item.embed_code} label="Embed Code"  id={`ec-${item.id}`} />
          <CopyBtn text={`${window.location.origin}/api/media/videos/${item.id}/stream/`}
            label="Stream URL" id={`su-${item.id}`} />
        </div>

        <button className="btn btn-sm" onClick={onDelete}
          style={{
            width: "100%",
            background: "rgba(239,68,68,0.06)", color: "#EF4444",
            border: "1px solid rgba(239,68,68,0.18)", fontSize: "0.74rem",
          }}>
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </div>
  );
}

/* ── Main MediaLibrarySection ─────────────────────────────────── */
export default function VideoLibrarySection() {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState("all"); // all | video | audio

  const { data, isLoading } = useQuery({
    queryKey: ["media-library"],
    queryFn: () => mediaAPI.listVideos().then(r =>
      Array.isArray(r.data) ? r.data : (r.data?.results || [])
    ),
  });

  const deleteItem = useMutation({
    mutationFn: (id) => mediaAPI.deleteVideo(id),
    onSuccess: () => qc.invalidateQueries(["media-library"]),
  });

  const all    = data || [];
  const videos = all.filter(v => v.media_type === "video" || !v.media_type);
  const audios = all.filter(v => v.media_type === "audio");

  const items = all
    .filter(v => filter === "all" || v.media_type === filter || (filter === "video" && !v.media_type))
    .filter(v => !search || v.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Film size={20} color="var(--clr-primary)" /> Media Library
          </h3>
          <p className="text-muted" style={{ fontSize: "0.82rem", marginTop: "2px" }}>
            Upload videos &amp; audio — copy direct links or embed codes to use anywhere
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setUploading(u => !u)}>
          <Upload size={15} /> Upload Media
        </button>
      </div>

      {uploading && <UploadPanel onDone={() => setUploading(false)} />}

      {/* Filter tabs + search */}
      {all.length > 0 && (
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center",
          marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {[
            { key: "all",   label: `All (${all.length})`,       icon: Filter },
            { key: "video", label: `Videos (${videos.length})`, icon: Film },
            { key: "audio", label: `Audio (${audios.length})`,  icon: Music },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{
                display: "flex", alignItems: "center", gap: "0.35rem",
                padding: "0.4rem 0.9rem", borderRadius: "100px", fontSize: "0.8rem",
                fontWeight: filter === key ? 700 : 500, cursor: "pointer",
                background: filter === key ? "var(--clr-primary)" : "#fff",
                color: filter === key ? "#fff" : "#6B7280",
                border: `1px solid ${filter === key ? "var(--clr-primary)" : "#E5E7EB"}`,
                transition: "all 0.15s",
              }}>
              <Icon size={13} /> {label}
            </button>
          ))}

          {/* Search */}
          <div style={{ position: "relative", marginLeft: "auto" }} className="search-container">
            <Search size={14} style={{ position: "absolute", left: "0.75rem",
              top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }} />
            <input className="form-control" placeholder="Search…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: "2rem", width: "200px", fontSize: "0.85rem" }} />
          </div>
        </div>
      )}

      {/* Stats */}
      {all.length > 0 && (
        <div style={{
          display: "flex", gap: "1.5rem", marginBottom: "1.5rem",
          padding: "0.75rem 1.25rem",
          background: "rgba(79,70,229,0.04)", borderRadius: "10px",
          border: "1px solid rgba(79,70,229,0.1)", flexWrap: "wrap",
        }}>
          <span style={{ fontSize: "0.8rem", color: "#374151" }}>
            <Film size={13} style={{ verticalAlign: "middle", marginRight: "4px" }} color="var(--clr-primary)" />
            <strong>{videos.length}</strong> video{videos.length !== 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: "0.8rem", color: "#374151" }}>
            <Music size={13} style={{ verticalAlign: "middle", marginRight: "4px" }} color="#7C3AED" />
            <strong>{audios.length}</strong> audio file{audios.length !== 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>
            Total: {fmtSize(all.reduce((s, v) => s + (v.size_bytes || 0), 0))}
          </span>
        </div>
      )}

      {isLoading && <div className="spinner" style={{ margin: "3rem auto" }} />}

      {!isLoading && items.length === 0 && (
        <div style={{ textAlign: "center", padding: "4rem 2rem",
          border: "2px dashed #E5E7EB", borderRadius: "16px" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <Film size={40} color="#D1D5DB" />
            <Music size={40} color="#D1D5DB" />
          </div>
          <p style={{ fontWeight: 600, color: "#374151", marginBottom: "0.4rem" }}>
            {search || filter !== "all" ? "No files match" : "No media uploaded yet"}
          </p>
          <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: "1.25rem" }}>
            {search || filter !== "all"
              ? "Try a different search or filter."
              : "Upload videos or audio files to build your media library."}
          </p>
          {!search && filter === "all" && (
            <button className="btn btn-primary" onClick={() => setUploading(true)}>
              <Upload size={15} /> Upload First File
            </button>
          )}
        </div>
      )}

      <div className="media-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "1.25rem",
      }}>
        {items.map(v => (
          <MediaCard key={v.id} item={v}
            onDelete={() => {
              if (confirm(`Delete "${v.title}"? This cannot be undone.`)) deleteItem.mutate(v.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}
