import { useState, useRef, useEffect } from "react";
import { Maximize, Minimize } from "lucide-react";
import SecureVideoPlayer from "../SecureVideoPlayer";

/*
 * Lesson content renderers shared by the student Learn page and the
 * teacher's Course Builder preview, so both always look the same.
 */

// ── HTML Block ─────────────────────────────────────────────────────────────
export function HTMLBlock({ block }) {
  const frameRef = useRef(null);
  const [fs, toggleFs, fsSupported] = useFullscreen(frameRef);

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
    <BlockFrame frameRef={frameRef} title={block.title || (src ? "HTML page" : "Notes")} isFs={fs} onToggleFs={toggleFs} fsSupported={fsSupported}>
      <div className="lesson-block-body">
        {src ? (
          <iframe
            src={src}
            sandbox={sandbox}
            title={block.title || "HTML page"}
            className="lesson-block-embed"
            style={{ height: fs ? "calc(100vh - 52px)" : "600px" }}
            loading="lazy"
          />
        ) : (
          <iframe
            srcDoc={srcDoc}
            sandbox={sandbox}
            title={block.title || "Notes"}
            className="lesson-block-embed"
            style={{ height: fs ? "calc(100vh - 52px)" : "600px" }}
            loading="lazy"
            onLoad={e => {
              try { e.target.style.height = e.target.contentDocument.body.scrollHeight + 40 + "px"; } catch {}
            }}
          />
        )}
      </div>
    </BlockFrame>
  );
}

// ── Fullscreen helper ──────────────────────────────────────────────────────
// Tracks real fullscreen state, so pressing Esc also resets the button.
function useFullscreen(ref) {
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [ref]);
  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else ref.current?.requestFullscreen?.().catch(() => {});
  };
  const supported = typeof document !== "undefined" && !!document.fullscreenEnabled;
  return [isFs, toggle, supported];
}

function BlockFrame({ frameRef, title, label, isFs, onToggleFs, fsSupported, children }) {
  return (
    <div ref={frameRef} className={`lesson-block${isFs ? " is-fullscreen" : ""}`}>
      <div className="lesson-block-head">
        <span className="lesson-block-title">
          {label && <span className="lesson-block-label">{label}</span>}
          {title}
        </span>
        {fsSupported && (
          <button onClick={onToggleFs} className="btn btn-sm btn-outline" title={isFs ? "Exit fullscreen" : "Fullscreen"}>
            {isFs ? <Minimize size={14} /> : <Maximize size={14} />} {isFs ? "Exit" : "Fullscreen"}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ── H5P Block ──────────────────────────────────────────────────────────────
// Uploaded .h5p packages are unpacked on the server and played here with
// h5p-standalone. The player sizes its frame to the activity, so short
// activities stay short and long ones aren't cut off.
export function H5PBlock({ block }) {
  const frameRef = useRef(null);
  const containerRef = useRef(null);
  const [isFs, toggleFs, fsSupported] = useFullscreen(frameRef);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const h5pPath = block.h5p_extracted_path;
  const embedUrl = block.h5p_embed_url || (block.moodle_resource_id
    ? `https://campus.rawdatun.org/mod/hvp/embed.php?id=${block.moodle_resource_id}`
    : null);
  const version = block.updated_at || block.created_at || "";

  // Ask H5P to re-measure itself (after fullscreen or width changes)
  const resizeH5P = () => {
    const frame = containerRef.current?.querySelector("iframe");
    try {
      const H5P = frame?.contentWindow?.H5P;
      (H5P?.instances || []).forEach((inst) => H5P.trigger(inst, "resize"));
    } catch { /* frame not ready */ }
  };

  useEffect(() => {
    if (!h5pPath || !containerRef.current) { setLoading(false); return; }
    let cancelled = false;
    const el = containerRef.current;
    el.innerHTML = "";
    setLoading(true);
    setError(null);

    import("h5p-standalone")
      .then(({ H5P }) => {
        if (cancelled) return;
        return new H5P(el, {
          h5pJsonPath: `/media/${h5pPath}`,
          frameJs: "/h5p-standalone/frame.bundle.js",
          frameCss: "/h5p-standalone/styles/h5p.css",
          frame: false,      // no "Reuse / Embed / Rights" bar
          copyright: false,
          export: false,
          embed: false,
        });
      })
      .then(() => { if (!cancelled) { setLoading(false); setTimeout(resizeH5P, 300); } })
      .catch((err) => {
        if (cancelled) return;
        console.error("H5P render error:", err);
        setError(err?.message || "unknown error");
        setLoading(false);
      });

    // Keep the activity sized to the available width
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resizeH5P()) : null;
    ro?.observe(el);

    return () => { cancelled = true; ro?.disconnect(); el.innerHTML = ""; };
  }, [h5pPath, block.id, version]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setTimeout(resizeH5P, 150); }, [isFs]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = block.title || "Interactive activity";

  // Embedded from another site (e.g. Moodle): we can't measure it, so give it room
  if (!h5pPath && embedUrl) {
    return (
      <BlockFrame frameRef={frameRef} title={title} label="H5P" isFs={isFs} onToggleFs={toggleFs} fsSupported={fsSupported}>
        <iframe
          src={embedUrl}
          allowFullScreen
          allow="fullscreen; autoplay"
          title={title}
          className="lesson-block-embed"
          style={{ height: isFs ? "calc(100vh - 52px)" : "560px" }}
          loading="lazy"
        />
      </BlockFrame>
    );
  }

  if (!h5pPath) {
    return <div className="alert alert-info">This interactive activity hasn't been set up yet.</div>;
  }

  return (
    <BlockFrame frameRef={frameRef} title={title} label="H5P" isFs={isFs} onToggleFs={toggleFs} fsSupported={fsSupported}>
      <div className="lesson-block-body h5p-body">
        {loading && (
          <div className="h5p-loading">
            <div className="spinner" /> Loading activity…
          </div>
        )}
        {error && (
          <div className="h5p-error">
            <strong>This activity couldn't be loaded.</strong>
            <span>Please refresh the page. If it keeps happening, let your teacher know.</span>
          </div>
        )}
        <div ref={containerRef} className="h5p-mount" aria-busy={loading} />
      </div>
    </BlockFrame>
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
