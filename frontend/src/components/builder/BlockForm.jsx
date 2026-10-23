import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UploadCloud, X, Film } from "lucide-react";
import { builderAPI } from "../../api";
import { ACCEPT, BLOCK_META, fileName, titleFromFile } from "./shared";

// Pull the src out of pasted <iframe src="..."> markup.
function extractIframeSrc(text) {
  if (!text.includes("<iframe")) return text;
  const m = text.match(/src=["']([^"']+)["']/);
  return m ? m[1].replace(/&amp;/g, "&") : text;
}

function FilePicker({ type, file, existing, onFile }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  if (file) {
    return (
      <div className="cb-file-chosen">
        <UploadCloud size={15} color="var(--clr-primary)" />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
        <span className="text-muted" style={{ fontSize: "0.72rem" }}>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
        <button className="cb-icon-btn" aria-label="Remove file" onClick={() => onFile(null)}><X size={14} /></button>
      </div>
    );
  }
  return (
    <>
      <div
        className={`cb-dropzone cb-dropzone-sm${over ? " over" : ""}`}
        style={{ marginBottom: "0.85rem" }}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      >
        <UploadCloud size={18} />
        <span>
          <strong>{existing ? "Replace file" : "Choose a file"}</strong> or drag it here
          {existing && <><br /><span style={{ fontSize: "0.72rem" }}>Current: {fileName(existing)}</span></>}
        </span>
      </div>
      <input ref={input} type="file" accept={ACCEPT[type]} hidden onChange={(e) => onFile(e.target.files?.[0] || null)} />
    </>
  );
}

function VideoLibraryPicker({ value, onPick }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["video-library"],
    queryFn: () => builderAPI.videoLibrary().then((r) => (Array.isArray(r.data) ? r.data : r.data?.results || [])),
  });
  if (isLoading) return <div className="spinner" style={{ margin: "1rem auto" }} />;
  if (error) return <p className="cb-error">Couldn't load the video library.</p>;
  const videos = (data || []).filter((v) => v.media_type !== "audio");
  if (!videos.length) return <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "0.85rem" }}>Your video library is empty. Upload videos in the Video Library tab, or upload directly here.</p>;
  return (
    <div className="cb-library">
      {videos.map((v) => (
        <button key={v.id} className={value === v.embed_url ? "on" : ""} onClick={() => onPick(v)}>
          <Film size={15} /> <span style={{ flex: 1 }}>{v.title}</span>
          <span className="text-muted" style={{ fontSize: "0.72rem" }}>{v.size_mb} MB</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Add or edit one content block.
 * onSubmit(formData, { title }) is called with a ready-to-send FormData.
 */
export default function BlockForm({ type, block, initialFile, onSubmit, onCancel, saving, error }) {
  const isEdit = !!block;
  const initialSource = () => {
    if (type === "html") return block && !block.file && block.html_content ? "paste" : "upload";
    if (type === "video") {
      if (block?.video_url?.includes("/api/media/videos/")) return "library";
      if (block?.video_url) return "link";
      return "upload";
    }
    if (type === "h5p") return block?.h5p_embed_url && !block?.file ? "link" : "upload";
    return "upload";
  };
  const [source, setSource] = useState(initialSource);
  const [title, setTitle] = useState(block?.title || (initialFile ? titleFromFile(initialFile) : ""));
  const [file, setFile] = useState(initialFile || null);
  const [html, setHtml] = useState(block?.html_content || "");
  const [link, setLink] = useState(type === "h5p" ? block?.h5p_embed_url || "" : block?.video_url || "");
  const [localError, setLocalError] = useState("");

  const sources = {
    html: [["upload", "Upload file"], ["paste", "Paste HTML"]],
    video: [["upload", "Upload video"], ["link", "YouTube / Vimeo"], ["library", "Video library"]],
    h5p: [["upload", "Upload .h5p"], ["link", "Embed link"]],
  }[type];

  const submit = () => {
    setLocalError("");
    const fd = new FormData();
    fd.append("block_type", type);
    fd.append("title", title.trim());

    if (source === "upload") {
      if (!file && !(isEdit && block.file)) return setLocalError("Choose a file to upload.");
      if (file) fd.append("file", file);
      if (type === "video") fd.append("video_url", "");
      if (type === "h5p") fd.append("h5p_embed_url", "");
      if (type === "html") fd.append("html_content", "");
    } else if (source === "paste") {
      if (!html.trim()) return setLocalError("Paste some HTML.");
      fd.append("html_content", html);
      if (isEdit && block.file) fd.append("file", ""); // clear the old upload
    } else {
      const url = link.trim();
      if (!/^https?:\/\//i.test(url)) return setLocalError("Enter a full link starting with https://");
      fd.append(type === "h5p" ? "h5p_embed_url" : "video_url", url);
      if (isEdit && block.file) fd.append("file", "");
    }
    onSubmit(fd, { title: title.trim() });
  };

  return (
    <div>
      {sources && (
        <div className="cb-seg" role="tablist">
          {sources.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={source === key} className={source === key ? "on" : ""} onClick={() => setSource(key)}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="cb-field">
        <label htmlFor="cb-block-title">Title <span className="text-muted" style={{ fontWeight: 400 }}>(shown to students)</span></label>
        <input id="cb-block-title" className="cb-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`e.g. ${BLOCK_META[type].label} — Introduction`} />
      </div>

      {source === "upload" && (
        <FilePicker type={type} file={file} existing={isEdit ? block.file : null}
          onFile={(f) => { setFile(f); if (f && !title) setTitle(titleFromFile(f)); }} />
      )}

      {source === "paste" && (
        <div className="cb-field">
          <label htmlFor="cb-block-html">HTML</label>
          <textarea id="cb-block-html" value={html} onChange={(e) => setHtml(e.target.value)} placeholder="<h2>Today's topic</h2>…" />
        </div>
      )}

      {source === "link" && (
        <div className="cb-field">
          <label htmlFor="cb-block-link">{type === "h5p" ? "H5P embed link" : "Video link"}</label>
          <input id="cb-block-link" className="cb-input" value={link}
            onChange={(e) => setLink(extractIframeSrc(e.target.value))}
            placeholder={type === "h5p" ? "https://…/embed.php?id=…  (or paste the iframe code)" : "https://youtube.com/watch?v=…  (or paste the iframe code)"} />
        </div>
      )}

      {source === "library" && (
        <VideoLibraryPicker value={link} onPick={(v) => { setLink(v.embed_url); if (!title) setTitle(v.title); }} />
      )}

      {(localError || error) && <p className="cb-error">{localError || error}</p>}

      <div className="cb-form-actions">
        <button className="cb-btn cb-btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="cb-btn cb-btn-primary" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Add to lesson"}
        </button>
      </div>
    </div>
  );
}
