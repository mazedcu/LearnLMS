import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Navbar from "../../components/Navbar";
import EnrollmentsModal from "../../components/admin/EnrollmentsModal";
import { authAPI } from "../../api";
import { BookOpen, Search, Users } from "lucide-react";

/** Manager: find a student and admit them to courses (or remove access). */
export default function ManagerDashboard() {
  const [search, setSearch] = useState("");
  const [coursesFor, setCoursesFor] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => authAPI.users().then((r) => (Array.isArray(r.data) ? r.data : r.data?.results || [])),
  });
  const q = search.trim().toLowerCase();
  const students = (data || []).filter((u) => u.role === "student").filter((u) =>
    !q || u.email?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) ||
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(q)
  );
  const nameOf = (u) => `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.username;

  return (
    <div className="page">
      <Navbar />
      <div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem", maxWidth: 960 }}>
        <h2 style={{ marginBottom: "0.35rem" }}>Students &amp; enrollments</h2>
        <p className="text-muted" style={{ marginBottom: "1.75rem" }}>
          Find a student, then use <b>Courses</b> to admit them to subjects or remove access. No payment needed.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 420 }}>
            <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--clr-muted)" }} />
            <input className="form-control" style={{ paddingLeft: "2.25rem" }} placeholder="Search by name, email or username…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <span className="text-muted" style={{ fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
            <Users size={15} /> {students.length} student{students.length === 1 ? "" : "s"}
          </span>
        </div>

        {isLoading && <div className="spinner" style={{ margin: "2rem auto" }} />}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {students.map((u) => (
            <div key={u.id} className="glass" style={{ padding: "0.8rem 1rem", display: "flex", alignItems: "center", gap: "0.9rem", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <p style={{ fontWeight: 600, margin: 0 }}>{nameOf(u)}</p>
                <p className="text-muted" style={{ fontSize: "0.8rem", margin: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</p>
              </div>
              {!u.is_active && <span className="badge badge-danger">Disabled</span>}
              <span className="text-muted" style={{ fontSize: "0.75rem" }}>Joined {u.date_joined ? new Date(u.date_joined).toLocaleDateString() : "-"}</span>
              <button className="btn btn-primary btn-sm" onClick={() => setCoursesFor({ id: u.id, email: u.email, name: nameOf(u) })}>
                <BookOpen size={14} /> Courses
              </button>
            </div>
          ))}
          {!isLoading && students.length === 0 && <p className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>No students found.</p>}
        </div>
      </div>
      {coursesFor && <EnrollmentsModal student={coursesFor} onClose={() => setCoursesFor(null)} />}
    </div>
  );
}
