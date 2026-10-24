import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authAPI } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { Save, Search, Trash2, KeyRound } from "lucide-react";

function errorText(e, fallback) {
  const d = e?.response?.data;
  if (!d) return fallback;
  if (typeof d === "string") return d;
  return d.detail || Object.values(d).flat().join(" ") || fallback;
}

const ROLES = ["student", "instructor", "manager", "admin"];
const ROLE_COLORS = { student: "var(--clr-accent)", instructor: "var(--clr-primary)", manager: "var(--clr-warning)", admin: "#f97316" };

export default function UsersSection() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [pwFor, setPwFor] = useState(null);      // user id getting a new password
  const [newPw, setNewPw] = useState("");
  const [notice, setNotice] = useState(null);    // { kind, text }
  const flash = (kind, text) => { setNotice({ kind, text }); setTimeout(() => setNotice(null), 4000); };
  const [editId, setEditId] = useState(null);
  const [newRole, setNewRole] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => authAPI.users().then(r => Array.isArray(r.data) ? r.data : r.data?.results || []),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }) => authAPI.updateUser(id, { role }),
    onSuccess: () => { qc.invalidateQueries(["all-users"]); qc.invalidateQueries(["platform-stats"]); setEditId(null); },
    onError: (e) => flash("error", errorText(e, "Couldn't change the role.")),
  });

  const setPassword = useMutation({
    mutationFn: ({ id, password }) => authAPI.updateUser(id, { password }),
    onSuccess: (_r, v) => { setPwFor(null); setNewPw(""); flash("success", `New password set for ${v.email}. Share it with them privately.`); },
    onError: (e) => flash("error", errorText(e, "Couldn't set the password.")),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }) => authAPI.updateUser(id, { is_active }),
    onSuccess: () => qc.invalidateQueries(["all-users"]),
    onError: (e) => flash("error", errorText(e, "Couldn't change the status.")),
  });

  const delUser = useMutation({
    mutationFn: (id) => authAPI.deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries(["all-users"]);
      qc.invalidateQueries(["platform-stats"]);
    },
  });

  const users = (data || []).filter(u =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h3 style={{ marginBottom: "1.25rem" }}>Users ({(data || []).length})</h3>
      <div style={{ position: "relative", marginBottom: "1.25rem", maxWidth: "360px" }}>
        <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--clr-muted)" }} />
        <input className="form-control" placeholder="Search by name, email, username..." style={{ paddingLeft: "2.25rem" }} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {notice && <div className={`alert ${notice.kind === "error" ? "alert-error" : "alert-success"}`} style={{ marginBottom: "1rem" }}>{notice.text}</div>}
      {isLoading && <div className="spinner" style={{ margin: "2rem auto" }} />}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--clr-border)" }}>
              {["Name", "Email", "Username", "Role", "Status", "Joined", "Actions"].map(h => (
                <th key={h} style={{ padding: "0.625rem 0.75rem", textAlign: "left", color: "var(--clr-muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--clr-border)" }}>
                <td style={{ padding: "0.75rem" }}>{u.first_name} {u.last_name}</td>
                <td style={{ padding: "0.75rem", color: "var(--clr-muted)" }}>{u.email}</td>
                <td style={{ padding: "0.75rem", color: "var(--clr-muted)" }}>{u.username}</td>
                <td style={{ padding: "0.75rem" }}>
                  {editId === u.id ? (
                    <div style={{ display: "flex", gap: "0.375rem" }}>
                      <select className="form-control" style={{ fontSize: "0.8rem", padding: "0.25rem" }} value={newRole} onChange={e => setNewRole(e.target.value)}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button className="btn btn-primary" style={{ padding: "0.25rem 0.5rem" }} onClick={() => updateRole.mutate({ id: u.id, role: newRole })} disabled={updateRole.isPending}><Save size={12} /></button>
                    </div>
                  ) : (
                    <span onClick={() => { if (u.id !== me?.id) { setEditId(u.id); setNewRole(u.role); } }} title={u.id === me?.id ? "This is you" : "Click to change role"}
                      style={{ cursor: "pointer", color: ROLE_COLORS[u.role] || "var(--clr-text)", fontWeight: 600, fontSize: "0.75rem", textTransform: "capitalize" }}>
                      {u.role}
                    </span>
                  )}
                </td>
                <td style={{ padding: "0.75rem" }}>
                  <button onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}
                    disabled={u.id === me?.id}
                    title={u.id === me?.id ? "This is you" : u.is_active ? "Click to disable" : "Click to enable"}
                    className="badge" style={{ cursor: u.id === me?.id ? "default" : "pointer", background: u.is_active ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: u.is_active ? "var(--clr-success)" : "var(--clr-danger)", border: "none" }}>
                    {u.is_active ? "Active" : "Disabled"}
                  </button>
                </td>
                <td style={{ padding: "0.75rem", color: "var(--clr-muted)", fontSize: "0.75rem" }}>{u.date_joined ? new Date(u.date_joined).toLocaleDateString() : "-"}</td>
                <td style={{ padding: "0.75rem" }}>
                  {pwFor === u.id ? (
                    <form style={{ display: "flex", gap: "0.375rem" }} onSubmit={(e) => { e.preventDefault(); setPassword.mutate({ id: u.id, email: u.email, password: newPw }); }}>
                      <input type="password" className="form-control" autoFocus autoComplete="new-password" placeholder="New password (10+ chars)"
                        style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem", minWidth: 170 }} value={newPw} onChange={e => setNewPw(e.target.value)} />
                      <button className="btn btn-primary btn-sm" style={{ padding: "0.2rem 0.5rem" }} disabled={!newPw || setPassword.isPending}>Set</button>
                      <button type="button" className="btn btn-outline btn-sm" style={{ padding: "0.2rem 0.5rem" }} onClick={() => { setPwFor(null); setNewPw(""); }}>Cancel</button>
                    </form>
                  ) : (
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    <button className="btn btn-outline btn-sm" style={{ padding: "0.2rem 0.5rem" }} title="Set a new password"
                      onClick={() => { setPwFor(u.id); setNewPw(""); }}>
                      <KeyRound size={12} />
                    </button>
                    {editId === u.id && (
                      <button className="btn btn-outline btn-sm" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }} onClick={() => setEditId(null)}>
                        Cancel
                      </button>
                    )}
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ padding: "0.2rem 0.5rem" }}
                      onClick={() => {
                        if (confirm(`Delete ${u.email}? This cannot be undone.`)) {
                          delUser.mutate(u.id);
                        }
                      }}
                      disabled={delUser.isPending || u.id === me?.id}
                      title={u.id === me?.id ? "You can't delete yourself" : "Delete user"}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && users.length === 0 && <p className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>No users found.</p>}
      </div>
    </div>
  );
}
