import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogIn, BookOpen } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard/student";

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const user = await login(form);
      const dest = { admin: "/dashboard/admin", instructor: "/dashboard/instructor", manager: "/dashboard/manager" }[user.role] || "/dashboard/student";
      navigate(from !== "/dashboard/student" ? from : dest, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed. Please check your credentials.");
    } finally { setLoading(false); }
  };

  return (
    <div className="page" style={{ display: "flex", minHeight: "100vh" }}>
      <div style={{ flex: 1, background: "linear-gradient(135deg,#1a1040,#0d0f14)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ textAlign: "center", color: "white" }}>
          <BookOpen size={48} color="#6c63ff" style={{ marginBottom: "1.5rem" }} />
          <h2 style={{ marginBottom: "1rem" }}>Welcome Back</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", maxWidth: "280px" }}>Continue your learning journey where you left off.</p>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ width: "100%", maxWidth: "400px" }}>
          <Link to="/" style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--clr-heading)", display: "block", marginBottom: "2rem" }}>
            Learn<span style={{ color: "var(--clr-primary)" }}>LMS</span>
          </Link>
          <h2 style={{ marginBottom: "0.5rem" }}>Sign In</h2>
          <p className="text-muted" style={{ marginBottom: "2rem" }}>Enter your credentials to continue</p>

          {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input id="email" name="email" type="email" className="form-control" value={form.email} onChange={handleChange} placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input id="password" name="password" type="password" className="form-control" value={form.password} onChange={handleChange} placeholder="Your password" required />
            </div>
            <button id="login-btn" type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "0.75rem" }}>
              {loading ? "Signing in..." : <><LogIn size={16} /> Sign In</>}
            </button>
          </form>

          <p className="text-muted" style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem" }}>
            No account? <Link to="/register" style={{ color: "var(--clr-primary)" }}>Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
