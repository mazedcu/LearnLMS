import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isInApp } from "./getApp";

const DASHBOARD = { admin: "/dashboard/admin", instructor: "/dashboard/instructor", manager: "/dashboard/manager" };

// True only for the first page load after the app is launched (sessionStorage
// lives as long as the app's web view, so reloads don't count as a launch).
let launch = false;
if (isInApp()) {
  try {
    launch = !sessionStorage.getItem("app-launched") && window.location.pathname === "/";
    sessionStorage.setItem("app-launched", "1");
  } catch { /* storage blocked: behave like the website */ }
}

/**
 * The home route. Inside the Android app the first screen after launch is the
 * sign-in page (or the dashboard when already signed in); later visits to the
 * home page, and the website itself, show the normal home page.
 */
export default function AppStart({ children }) {
  const { user, loading } = useAuth();
  const redirect = launch;
  useEffect(() => { if (!loading) launch = false; }, [loading]);
  if (!redirect) return children;
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  return <Navigate to={user ? DASHBOARD[user.role] || "/dashboard/student" : "/login"} replace />;
}
