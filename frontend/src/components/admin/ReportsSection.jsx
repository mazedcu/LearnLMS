import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsAPI } from "../../api";
import { FileBarChart, Activity, ClipboardList, ChevronDown, ChevronUp, Search } from "lucide-react";

const TABS = [
  { key: "users", label: "User Activity", icon: FileBarChart },
  { key: "quizzes", label: "Quiz Results", icon: ClipboardList },
  { key: "recent", label: "Recent Activity", icon: Activity },
];

export default function ReportsSection() {
  const [tab, setTab] = useState("users");
  const [search, setSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState(null);

  const { data: userReport, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-report", "users"],
    queryFn: () => reportsAPI.userActivity().then((r) => r.data),
  });

  const { data: quizReport, isLoading: quizzesLoading } = useQuery({
    queryKey: ["admin-report", "quizzes"],
    queryFn: () => reportsAPI.quizResults().then((r) => r.data),
  });

  const { data: recentActivity, isLoading: recentLoading } = useQuery({
    queryKey: ["admin-report", "recent"],
    queryFn: () => reportsAPI.recentActivity().then((r) => r.data),
  });

  const filteredUsers = (userReport || []).filter((u) => {
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.full_name && u.full_name.toLowerCase().includes(q))
    );
  });

  const filteredQuizzes = (quizReport || []).filter((q) => {
    const s = search.toLowerCase();
    return (
      q.student_email.toLowerCase().includes(s) ||
      q.quiz_title.toLowerCase().includes(s)
    );
  });

  const formatDate = (d) => (d ? new Date(d).toLocaleString() : "—");

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className="btn btn-sm"
            onClick={() => { setTab(key); setSearch(""); }}
            style={{
              background: tab === key ? "var(--clr-primary)" : "transparent",
              color: tab === key ? "#fff" : "var(--clr-muted)",
              border: "1px solid var(--clr-border)",
              display: "flex", alignItems: "center", gap: "0.5rem",
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: "1.5rem", position: "relative" }}>
        <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--clr-muted)" }} />
        <input
          className="form-control"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: "2.25rem" }}
        />
      </div>

      {/* User Activity Tab */}
      {tab === "users" && (
        <div>
          {usersLoading ? (
            <p className="text-muted">Loading...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {filteredUsers.map((u) => (
                <div
                  key={u.user_id}
                  style={{
                    background: "var(--clr-surface)",
                    border: "1px solid var(--clr-border)",
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setExpandedUser(expandedUser === u.user_id ? null : u.user_id)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "1rem",
                      padding: "0.875rem 1.25rem", background: "transparent", border: "none",
                      cursor: "pointer", textAlign: "left", color: "var(--clr-text)",
                    }}
                  >
                    {expandedUser === u.user_id ? <ChevronUp size={16} color="var(--clr-primary)" /> : <ChevronDown size={16} color="var(--clr-muted)" />}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: "0.9rem" }}>{u.full_name || u.email}</p>
                      <p style={{ margin: "0.125rem 0 0", fontSize: "0.75rem", color: "var(--clr-muted)" }}>
                        {u.email} · {u.role} · Joined {formatDate(u.date_joined)}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: "1.5rem", textAlign: "center" }}>
                      <div>
                        <p style={{ fontWeight: 700, margin: 0, fontSize: "0.9rem", color: "var(--clr-primary)" }}>{u.total_enrollments}</p>
                        <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--clr-muted)" }}>Enrollments</p>
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, margin: 0, fontSize: "0.9rem", color: "var(--clr-success)" }}>{u.total_quizzes_taken}</p>
                        <p style={{ margin: 0, fontSize: "0.65rem", color: "var(--clr-muted)" }}>Quizzes</p>
                      </div>
                    </div>
                  </button>

                  {expandedUser === u.user_id && (
                    <div style={{ padding: "0 1.25rem 1.25rem" }}>
                      {/* Enrollments */}
                      {u.enrollments.length > 0 && (
                        <div style={{ marginBottom: "1rem" }}>
                          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--clr-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "0.5rem" }}>Enrollments</p>
                          <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid var(--clr-border)" }}>
                                <th style={{ textAlign: "left", padding: "0.375rem 0.5rem" }}>Course</th>
                                <th style={{ textAlign: "center", padding: "0.375rem 0.5rem" }}>Progress</th>
                                <th style={{ textAlign: "right", padding: "0.375rem 0.5rem" }}>Enrolled</th>
                              </tr>
                            </thead>
                            <tbody>
                              {u.enrollments.map((e, i) => (
                                <tr key={i} style={{ borderBottom: "1px solid var(--clr-border)" }}>
                                  <td style={{ padding: "0.375rem 0.5rem" }}>{e.course_title}</td>
                                  <td style={{ textAlign: "center", padding: "0.375rem 0.5rem" }}>
                                    {e.percent_complete}%
                                    <span style={{ fontSize: "0.7rem", color: "var(--clr-muted)" }}> ({e.lessons_completed}/{e.lessons_total})</span>
                                  </td>
                                  <td style={{ textAlign: "right", padding: "0.375rem 0.5rem", color: "var(--clr-muted)" }}>{formatDate(e.enrolled_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Quiz Results */}
                      {u.quiz_results.length > 0 && (
                        <div>
                          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--clr-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "0.5rem" }}>Quiz Results</p>
                          <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid var(--clr-border)" }}>
                                <th style={{ textAlign: "left", padding: "0.375rem 0.5rem" }}>Quiz</th>
                                <th style={{ textAlign: "center", padding: "0.375rem 0.5rem" }}>Score</th>
                                <th style={{ textAlign: "right", padding: "0.375rem 0.5rem" }}>Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {u.quiz_results.map((q, i) => (
                                <tr key={i} style={{ borderBottom: "1px solid var(--clr-border)" }}>
                                  <td style={{ padding: "0.375rem 0.5rem" }}>{q.quiz_title}</td>
                                  <td style={{ textAlign: "center", padding: "0.375rem 0.5rem", fontWeight: 600, color: q.score_percent >= 70 ? "var(--clr-success)" : "var(--clr-warning)" }}>
                                    {q.score_percent}% ({q.score}/{q.total_marks})
                                  </td>
                                  <td style={{ textAlign: "right", padding: "0.375rem 0.5rem", color: "var(--clr-muted)" }}>{formatDate(q.finished_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {u.enrollments.length === 0 && u.quiz_results.length === 0 && (
                        <p className="text-muted" style={{ fontSize: "0.8rem" }}>No activity recorded.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {filteredUsers.length === 0 && <p className="text-muted">No users match your search.</p>}
            </div>
          )}
        </div>
      )}

      {/* Quiz Results Tab */}
      {tab === "quizzes" && (
        <div>
          {quizzesLoading ? (
            <p className="text-muted">Loading...</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse", background: "var(--clr-surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--clr-border)" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--clr-border)", background: "rgba(108,99,255,0.06)" }}>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Student</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Quiz</th>
                    <th style={{ textAlign: "center", padding: "0.75rem 1rem" }}>Score</th>
                    <th style={{ textAlign: "center", padding: "0.75rem 1rem" }}>Status</th>
                    <th style={{ textAlign: "right", padding: "0.75rem 1rem" }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuizzes.map((q) => (
                    <tr key={q.submission_id} style={{ borderBottom: "1px solid var(--clr-border)" }}>
                      <td style={{ padding: "0.625rem 1rem" }}>
                        <p style={{ margin: 0, fontWeight: 500 }}>{q.student_name || q.student_email}</p>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--clr-muted)" }}>{q.student_email}</p>
                      </td>
                      <td style={{ padding: "0.625rem 1rem" }}>{q.quiz_title}</td>
                      <td style={{ textAlign: "center", padding: "0.625rem 1rem", fontWeight: 600, color: q.score_percent >= 70 ? "var(--clr-success)" : q.score_percent >= 50 ? "var(--clr-warning)" : "var(--clr-danger)" }}>
                        {q.score_percent}%
                      </td>
                      <td style={{ textAlign: "center", padding: "0.625rem 1rem" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 600,
                          background: q.status === 'marked' ? 'rgba(40,167,69,0.15)' : q.status === 'submitted' ? 'rgba(255,193,7,0.15)' : 'rgba(108,117,125,0.15)',
                          color: q.status === 'marked' ? 'var(--clr-success)' : q.status === 'submitted' ? 'var(--clr-warning)' : 'var(--clr-muted)',
                          textTransform: "capitalize",
                        }}>
                          {q.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", padding: "0.625rem 1rem", color: "var(--clr-muted)", fontSize: "0.8rem" }}>{formatDate(q.finished_at)}</td>
                    </tr>
                  ))}
                  {filteredQuizzes.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--clr-muted)" }}>No quiz results found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recent Activity Tab */}
      {tab === "recent" && (
        <div>
          {recentLoading ? (
            <p className="text-muted">Loading...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {(recentActivity || []).map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "center", gap: "1rem",
                    padding: "0.875rem 1.25rem",
                    background: "var(--clr-surface)",
                    border: "1px solid var(--clr-border)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <span style={{
                    width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0,
                    background: a.type === 'enrollment' ? 'var(--clr-primary)' : a.type === 'completion' ? 'var(--clr-success)' : 'var(--clr-warning)',
                  }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: "0.85rem" }}>
                      <strong>{a.user_name || a.user_email}</strong> — {a.detail}
                    </p>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--clr-muted)", whiteSpace: "nowrap" }}>
                    {formatDate(a.timestamp)}
                  </p>
                </div>
              ))}
              {(recentActivity || []).length === 0 && <p className="text-muted">No recent activity.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
