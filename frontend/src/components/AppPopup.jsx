import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { BookOpen, CheckCircle, Download, Smartphone, X } from "lucide-react";
import QRCode from "qrcode";
import { APK_PATH, OPEN_EVENT, apkAvailable, isAndroid, isIOS, isInApp } from "./getApp";

const KEY = "get-app-popup-dismissed-at";
const QUIET_DAYS = 7;
const DELAY_MS = 4000;
// Pages where the popup may open on its own (never mid-lesson, quiz or in the admin area)
const AUTO_ON = [/^\/$/, /^\/login/, /^\/register/, /^\/courses\//, /^\/dashboard\/student/];

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(KEY) || 0);
    return Date.now() - at < QUIET_DAYS * 864e5;
  } catch { return false; }
}

/** "Get the app" popup: opens by itself once a week on the main pages, or from any "Get app" link. */
export default function AppPopup() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(false);
  const [qr, setQr] = useState("");
  const android = isAndroid();
  const ios = isIOS();
  const apkUrl = typeof window !== "undefined" ? window.location.origin + APK_PATH : APK_PATH;

  useEffect(() => { apkAvailable().then(setAvailable); }, []);

  // Opened from a "Get app" link anywhere on the site
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  // Opens by itself after a few seconds (Android phones and computers; the app is Android-only)
  useEffect(() => {
    if (!available || ios || isInApp() || recentlyDismissed() || !AUTO_ON.some((re) => re.test(pathname))) return;
    const t = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(t);
  }, [available, ios, pathname]);

  useEffect(() => {
    if (!open || android || ios || qr) return;
    QRCode.toDataURL(apkUrl, { margin: 1, width: 360, color: { dark: "#111827", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [open, android, ios, qr, apkUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || isInApp()) return null;

  function close() {
    setOpen(false);
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* private mode */ }
  }

  return (
    <div className="getapp-backdrop" onClick={close}>
      <div className="getapp" role="dialog" aria-modal="true" aria-labelledby="getapp-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="getapp-close" aria-label="Close" onClick={close}><X size={18} /></button>
        <div className="getapp-icon"><BookOpen size={30} /></div>
        <h3 id="getapp-title">Get the LearnwithHasan app</h3>
        <p className="getapp-sub">Your courses, one tap away on your Android phone.</p>
        <ul className="getapp-points">
          <li><CheckCircle size={16} /> Stay signed in — no password every time</li>
          <li><CheckCircle size={16} /> Opens straight to your lessons</li>
          <li><CheckCircle size={16} /> Full-screen videos and activities</li>
        </ul>

        {!available ? (
          <p className="getapp-note">The app will be ready to download very soon.</p>
        ) : ios ? (
          <p className="getapp-note">
            The app is for Android phones. On iPhone, tap <b>Share</b> then <b>Add to Home Screen</b> to keep LearnwithHasan one tap away.
          </p>
        ) : android ? (
          <>
            <a className="getapp-download" href={APK_PATH} download onClick={() => setTimeout(close, 300)}>
              <Download size={18} /> Download the app
            </a>
            <p className="getapp-note">When it's downloaded, open the file and tap <b>Install</b>. If your phone asks, allow installing from your browser.</p>
          </>
        ) : (
          <div className="getapp-desktop">
            {qr ? <img src={qr} alt="QR code to download the Android app" width="150" height="150" /> : <div className="getapp-qr-skel" />}
            <div>
              <p><Smartphone size={16} /> <b>Scan with your Android phone's camera</b> to download the app.</p>
              <a className="getapp-link" href={APK_PATH} download>Or download the file (APK)</a>
            </div>
          </div>
        )}

        <button type="button" className="getapp-later" onClick={close}>Not now</button>
      </div>
    </div>
  );
}
