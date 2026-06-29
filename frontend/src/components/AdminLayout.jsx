import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, BookOpen, Users, CreditCard,
  FileBarChart, LogOut, ChevronRight, Menu, X, Film
} from "lucide-react";

const NAV = [
  { key: "overview",  label: "Overview",        icon: LayoutDashboard },
  { key: "courses",   label: "Courses",          icon: BookOpen },
  { key: "videos",    label: "Video Library",    icon: Film },
  { key: "payments",  label: "Payments",         icon: CreditCard },
  { key: "users",     label: "Users",            icon: Users },
  { key: "reports",   label: "Reports",          icon: FileBarChart },
];

export default function AdminLayout({ section, setSection, children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--clr-bg)" }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? "64px" : "220px", transition: "width 0.2s",
        background: "var(--clr-surface)", borderRight: "1px solid var(--clr-border)",
        display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        {/* Brand */}
        <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid var(--clr-border)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button onClick={() => setCollapsed(c => !c)} style={{ background: "none", border: "none", color: "var(--clr-muted)", cursor: "pointer", padding: "0.25rem" }}>
            {collapsed ? <Menu size={18} /> : <X size={18} />}
          </button>
          {!collapsed && <span style={{ fontWeight: 800, color: "var(--clr-heading)", fontSize: "1rem" }}>Learnwith<span style={{ color: "var(--clr-primary)" }}>Hasan</span></span>}
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: "0.75rem 0" }}>
          {NAV.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setSection(key)}
              title={collapsed ? label : ""}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: "0.75rem",
                padding: collapsed ? "0.75rem" : "0.75rem 1.25rem",
                background: section === key ? "rgba(108,99,255,0.12)" : "transparent",
                border: "none", borderLeft: section === key ? "3px solid var(--clr-primary)" : "3px solid transparent",
                color: section === key ? "var(--clr-primary)" : "var(--clr-muted)",
                fontWeight: section === key ? 600 : 400, fontSize: "0.875rem",
                justifyContent: collapsed ? "center" : "flex-start",
                cursor: "pointer", transition: "background 0.15s",
              }}>
              <Icon size={16} />
              {!collapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: "0.75rem", borderTop: "1px solid var(--clr-border)" }}>
          <button onClick={() => { logout(); navigate("/"); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem", color: "var(--clr-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem", justifyContent: collapsed ? "center" : "flex-start" }}>
            <LogOut size={16} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <header style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--clr-border)", background: "var(--clr-surface)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--clr-heading)", textTransform: "capitalize" }}>
            {NAV.find(n => n.key === section)?.label || "Admin"}
          </h3>
          <Link to="/" className="btn btn-outline btn-sm">View Site</Link>
        </header>
        <main style={{ flex: 1, overflowY: "auto", padding: "1.75rem" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
