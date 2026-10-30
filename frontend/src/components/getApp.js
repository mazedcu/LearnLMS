// Shared helpers for the "Get the app" popup and links.
export const APK_PATH = "/app/learnwithhasan.apk";
export const OPEN_EVENT = "open-get-app";

const ua = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);
export const isInApp = () => /LearnwithHasanApp/.test(ua());
export const isAndroid = () => /Android/i.test(ua());
export const isIOS = () =>
  /iPhone|iPad|iPod/i.test(ua()) || (/Macintosh/.test(ua()) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);

let checking = null;
/** Resolves true when the server really has the APK (the SPA answers every path with index.html). */
export function apkAvailable() {
  if (isInApp()) return Promise.resolve(false);
  if (!checking) {
    checking = fetch(APK_PATH, { method: "HEAD", cache: "no-store" })
      .then((r) => r.ok && !(r.headers.get("content-type") || "").includes("text/html"))
      .catch(() => false);
  }
  return checking;
}

export const openGetApp = () => window.dispatchEvent(new Event(OPEN_EVENT));
