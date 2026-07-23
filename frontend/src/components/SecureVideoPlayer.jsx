import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
} from "lucide-react";

/* ── Helpers ───────────────────────────────────────────────────── */
function fmtTime(s) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/* ── Secure Video Player ──────────────────────────────────────── */
export default function SecureVideoPlayer({ src, title }) {
  const videoRef     = useRef(null);
  const containerRef = useRef(null);
  const progressRef  = useRef(null);
  const hideTimer    = useRef(null);

  const [playing,     setPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [volume,      setVolume]      = useState(1);
  const [muted,       setMuted]       = useState(false);
  const [fullscreen,  setFullscreen]  = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered,    setBuffered]    = useState(0);

  /* ── Hide controls after inactivity ── */
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  useEffect(() => { resetHideTimer(); }, [playing, resetHideTimer]);
  useEffect(() => () => clearTimeout(hideTimer.current), []);

  /* ── Video events ── */
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.buffered.length > 0) {
      setBuffered((v.buffered.end(v.buffered.length - 1) / v.duration) * 100);
    }
  };

  const onLoadedMetadata = () => {
    setDuration(videoRef.current?.duration || 0);
  };

  const onEnded = () => setPlaying(false);

  /* ── Controls ── */
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  };

  const seek = (e) => {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar) return;
    const rect = bar.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * duration;
  };

  const changeVolume = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
    setMuted(val === 0);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const progressPct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => playing && setShowControls(false)}
      onContextMenu={e => e.preventDefault()}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16/9",
        background: "#000",
        borderRadius: "10px",
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* ── Raw video — no native controls ── */}
      <video
        ref={videoRef}
        src={src}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        onClick={togglePlay}
        preload="metadata"
        playsInline
        /* No controls = no download button in ANY browser */
      />

      {/* ── Big play overlay (shown when paused) ── */}
      {!playing && (
        <div
          onClick={togglePlay}
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <div style={{
            width: "68px", height: "68px", borderRadius: "50%",
            background: "rgba(255,255,255,0.18)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid rgba(255,255,255,0.35)",
            transition: "transform 0.15s",
          }}>
            <Play size={28} color="#fff" style={{ marginLeft: "4px" }} />
          </div>
        </div>
      )}

      {/* ── Controls bar ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "0.6rem 0.85rem 0.75rem",
        background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
        display: "flex", flexDirection: "column", gap: "0.5rem",
        opacity: showControls ? 1 : 0,
        transition: "opacity 0.3s",
        pointerEvents: showControls ? "auto" : "none",
      }}>

        {/* Progress bar */}
        <div
          ref={progressRef}
          onClick={seek}
          style={{
            height: "5px", borderRadius: "100px",
            background: "rgba(255,255,255,0.25)",
            cursor: "pointer", position: "relative",
          }}
        >
          {/* Buffered */}
          <div style={{
            position: "absolute", height: "100%", borderRadius: "100px",
            background: "rgba(255,255,255,0.3)",
            width: `${buffered}%`,
          }} />
          {/* Played */}
          <div style={{
            position: "absolute", height: "100%", borderRadius: "100px",
            background: "var(--clr-primary, #4F46E5)",
            width: `${progressPct}%`,
          }} />
          {/* Thumb */}
          <div style={{
            position: "absolute", top: "50%", transform: "translate(-50%,-50%)",
            width: "13px", height: "13px", borderRadius: "50%",
            background: "#fff", left: `${progressPct}%`,
            boxShadow: "0 0 4px rgba(0,0,0,0.4)",
          }} />
        </div>

        {/* Bottom row */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>

          {/* Play / Pause */}
          <button onClick={togglePlay} style={{
            background: "none", border: "none", color: "#fff",
            cursor: "pointer", padding: "2px", display: "flex", alignItems: "center",
          }}>
            {playing
              ? <Pause size={18} fill="#fff" />
              : <Play  size={18} fill="#fff" style={{ marginLeft: "2px" }} />}
          </button>

          {/* Time */}
          <span style={{ color: "#fff", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>

          <div style={{ flex: 1 }} />

          {/* Volume */}
          <button onClick={toggleMute} style={{
            background: "none", border: "none", color: "#fff",
            cursor: "pointer", padding: "2px", display: "flex", alignItems: "center",
          }}>
            {muted || volume === 0
              ? <VolumeX size={17} />
              : <Volume2 size={17} />}
          </button>
          <input
            type="range" min="0" max="1" step="0.05"
            value={muted ? 0 : volume}
            onChange={changeVolume}
            style={{ width: "70px", accentColor: "var(--clr-primary, #4F46E5)", cursor: "pointer" }}
          />

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} style={{
            background: "none", border: "none", color: "#fff",
            cursor: "pointer", padding: "2px", display: "flex", alignItems: "center",
          }}>
            {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </button>
        </div>
      </div>
    </div>
  );
}
