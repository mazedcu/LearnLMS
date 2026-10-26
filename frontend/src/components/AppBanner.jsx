import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Smartphone, X } from "lucide-react";

const APK = "/app/learnwithhasan.apk";
const KEY = "app-banner-dismissed";
const SHOW_ON = [/^\/$/, /^\/login/, /^\/register/, /^\/courses\//, /^\/dashboard\/student/];

/** "Get the Android app" bar for Android phone browsers (never inside the app). */
export default function AppBanner() {
  const { pathname } = useLocation();
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  });
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const eligible = /Android/i.test(ua) && !/LearnwithHasanApp/.test(ua);

  useEffect(() => {
    if (!eligible || dismissed) return;
    let gone = false;
    // The SPA fallback answers every path with index.html, so check it's really the APK
    fetch(APK, { method: "HEAD" })
      .then((r) => { if (!gone) setAvailable(r.ok && !(r.headers.get("content-type") || "").includes("text/html")); })
      .catch(() => {});
    return () => { gone = true; };
  }, [eligible, dismissed]);

  if (!eligible || dismissed || !available || !SHOW_ON.some((re) => re.test(pathname))) return null;

  const close = () => {
    setDismissed(true);
    try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ }
  };

  return (
    <div className="app-banner" role="region" aria-label="Android app">
      <span className="app-banner-icon"><Smartphone size={18} /></span>
      <span className="app-banner-text"><b>LearnwithHasan app</b><small>Quicker, stays signed in</small></span>
      <a className="app-banner-get" href={APK} download>Get the app</a>
      <button type="button" className="app-banner-close" aria-label="Not now" onClick={close}><X size={16} /></button>
    </div>
  );
}
