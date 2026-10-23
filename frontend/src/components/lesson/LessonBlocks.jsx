import { useState, useRef, useEffect } from "react";
import { Maximize, Minimize } from "lucide-react";
import SecureVideoPlayer from "../SecureVideoPlayer";

/*
 * Lesson content renderers shared by the student Learn page and the
 * teacher's Course Builder preview, so both always look the same.
 */

// ── HTML Block ─────────────────────────────────────────────────────────────
export function HTMLBlock({ block }) {
  const [fs, setFs] = useState(false);
  const ref = useRef(null);

  const toggleFs = () => {
    if (!fs) { ref.current?.requestFullscreen?.(); setFs(true); }
    else { document.exitFullscreen?.(); setFs(false); }
  };

  const rawSrc = block.file;
  let src = rawSrc && rawSrc.startsWith('http')
    ? new URL(rawSrc).pathname
    : rawSrc;
    
  if (src) {
    const version = block.updated_at || block.created_at;
    if (version) src = src + (src.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(version);
  }

  const srcDoc = !src
    ? `<!DOCTYPE html><html><head><meta charset='UTF-8'><style>body{font-family:system-ui,sans-serif;padding:1.5rem;line-height:1.7;color:#1a1a1a;margin:0}img{max-width:100%}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}</style></head><body>${block.html_content}</body></html>`
    : null;

  const sandbox = src
    ? "allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"
    : "allow-same-origin allow-scripts allow-presentation";

  return (
    <div style={{ position: "relative", border: "1px solid var(--clr-border)", borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 1rem", background: "var(--clr-surface)", borderBottom: "1px solid var(--clr-border)" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--clr-muted)" }}>{block.title || (src ? "HTML File" : "HTML Content")}</span>
        <button onClick={toggleFs} className="btn btn-sm btn-outline" title={fs ? "Exit Fullscreen" : "Fullscreen"}>
          {fs ? <Minimize size={14} /> : <Maximize size={14} />} {fs ? "Exit" : "Fullscreen"}
        </button>
      </div>
      <div ref={ref} style={{ background: "#fff", color: "#000", height: fs ? "100vh" : "auto" }}>
        {src ? (
          <iframe
            src={src}
            sandbox={sandbox}
            style={{ width: "100%", height: fs ? "100vh" : "600px", border: "none", display: "block" }}
            loading="lazy"
          />
        ) : (
          <iframe
            srcDoc={srcDoc}
            sandbox={sandbox}
            style={{ width: "100%", height: fs ? "100vh" : "600px", border: "none", display: "block" }}
            loading="lazy"
            onLoad={e => {
              if (!fs) {
                try { e.target.style.height = e.target.contentDocument.body.scrollHeight + 40 + "px"; } catch {}
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── H5P Block ──────────────────────────────────────────────────────────────
export function H5PBlock({ block }) {
  const containerRef = useRef(null);
  const h5pInstanceRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Determine the H5P content path
  const h5pPath = block.h5p_extracted_path;
  const embedUrl = block.h5p_embed_url || (block.moodle_resource_id
    ? `https://campus.rawdatun.org/mod/hvp/embed.php?id=${block.moodle_resource_id}`
    : null);

  useEffect(() => {
    let isMounted = true;
    // If using extracted local H5P content
    if (h5pPath && containerRef.current) {
      setLoading(true);
      setError(null);
      // Clear previous instance
      containerRef.current.innerHTML = '';
      h5pInstanceRef.current = null;

      import('h5p-standalone').then(({ H5P }) => {
        if (!isMounted || !containerRef.current) return;
        new H5P(containerRef.current, {
          h5pJsonPath: `/media/${h5pPath}`,
          frameJs: '/h5p-standalone/frame.bundle.js',
          frameCss: '/h5p-standalone/styles/h5p.css',
        })
          .then(() => {
            if (!isMounted) return;
            h5pInstanceRef.current = true;
            setLoading(false);
          })
          .catch((err) => {
            if (!isMounted) return;
            console.error('H5P render error:', err);
            setError(err.message || 'Failed to render H5P content');
            setLoading(false);
          });
      }).catch((err) => {
        if (!isMounted) return;
        console.error('H5P import error:', err);
        setError('Failed to load H5P player library');
        setLoading(false);
      });
    } else if (!h5pPath && !embedUrl) {
      setLoading(false);
    } else {
      setLoading(false);
    }
    
    return () => {
      isMounted = false;
    };
  }, [h5pPath, block.id]);

  // Fallback: embed URL (Moodle or external)
  if (!h5pPath && embedUrl) {
    return (
      <div className="h5p-container">
        {block.title && <p style={{ padding: "0.75rem 1rem", background: "var(--clr-surface)", borderBottom: "1px solid var(--clr-border)", fontSize: "0.875rem", fontWeight: 600 }}>{block.title}</p>}
        <iframe 
          src={embedUrl} 
          allowFullScreen 
          title={block.title || "H5P Activity"} 
          style={{ width: "100%", minHeight: "480px", border: "none" }}
          loading="lazy"
        />
      </div>
    );
  }

  // No content at all
  if (!h5pPath && !embedUrl) {
    return <div className="alert alert-info">H5P activity not configured.</div>;
  }

  // Local H5P rendering
  return (
    <div className="h5p-container">
      {block.title && <p style={{ padding: "0.75rem 1rem", background: "var(--clr-surface)", borderBottom: "1px solid var(--clr-border)", fontSize: "0.875rem", fontWeight: 600 }}>{block.title}</p>}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "var(--clr-muted)" }}>
          <div className="spinner" style={{ marginRight: "0.75rem" }} /> Loading H5P content…
        </div>
      )}
      {error && (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--clr-danger, #c0392b)" }}>
          Failed to load H5P content: {error}
        </div>
      )}
      <div ref={containerRef} style={{ minHeight: loading ? 0 : "400px" }} />
    </div>
  );
}

// ── Video Block ────────────────────────────────────────────────────────────
export function VideoBlock({ block }) {
  const getEmbedUrl = (url) => {
    if (!url) return null;
    let vidId = "";
    if (url.includes("youtube.com/watch?v=")) {
      vidId = url.split("v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${vidId}?autoplay=0&rel=0`;
    }
    if (url.includes("youtu.be/")) {
      vidId = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${vidId}?autoplay=0&rel=0`;
    }
    if (url.includes("vimeo.com/")) {
      vidId = url.split("vimeo.com/")[1]?.split("?")[0];
      return `https://player.vimeo.com/video/${vidId}?autoplay=0`;
    }
    return url;
  };

  const embedUrl = getEmbedUrl(block.video_url);

  if (embedUrl) return (
    <div className="video-container" style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: "var(--radius-md)", overflow: "hidden", background: "#000" }}>
      <iframe 
        src={embedUrl} 
        allowFullScreen 
        title={block.title} 
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
  if (block.file) return (
    <SecureVideoPlayer src={block.file} title={block.title} />
  );
  return <div className="alert alert-info">No video source configured.</div>;
}

// ── Content Block Renderer ─────────────────────────────────────────────────
export function BlockRenderer({ block }) {
  switch (block.block_type) {
    case "html":      return <HTMLBlock block={block} />;
    case "h5p":       return <H5PBlock block={block} />;
    case "video":     return <VideoBlock block={block} />;
    case "document":  return block.file ? <iframe src={block.file} style={{ width: "100%", height: "600px", border: "none", borderRadius: "var(--radius-md)" }} loading="lazy" /> : null;
    case "image":     return block.file ? <img src={block.file} alt={block.title} style={{ width: "100%", borderRadius: "var(--radius-md)" }} /> : null;
    default:          return null;
  }
}
