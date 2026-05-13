import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserPlus } from "lucide-react";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", username: "", first_name: "", last_name: "", password: "", password2: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (form.password !== form.password2) { setError("Passwords do not match."); return; }
    setError(""); setLoading(true);
    try {
      await register(form);
      navigate("/dashboard/student", { replace: true });
    } catch (err) {
      const d = err.response?.data;
      setError(d ? Object.values(d).flat().join(" ") : "Registration failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="page" style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div className="glass" style={{ width: "100%", maxWidth: "480px", padding: "2.5rem" }}>
        <Link to="/" style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--clr-heading)", display: "block", marginBottom: "2rem" }}>
          Learn<span style={{ color: "var(--clr-primary)" }}>LMS</span>
        </Link>
        <h2 style={{ marginBottom: "0.5rem" }}>Create Account</h2>
        <p className="text-muted" style={{ marginBottom: "2rem" }}>Join thousands of learners today</p>

        {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="grid-2" style={{ gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input name="first_name" className="form-control" value={form.first_name} onChange={handleChange} placeholder="John" />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input name="last_name" className="form-control" value={form.last_name} onChange={handleChange} placeholder="Doe" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input name="email" type="email" className="form-control" value={form.email} onChange={handleChange} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input name="username" className="form-control" value={form.username} onChange={handleChange} placeholder="johndoe" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input name="password" type="password" className="form-control" value={form.password} onChange={handleChange} placeholder="Min 8 characters" required />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input name="password2" type="password" className="form-control" value={form.password2} onChange={handleChange} placeholder="Repeat password" required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "0.75rem", marginTop: "0.5rem" }}>
            {loading ? "Creating account..." : <><UserPlus size={16} /> Create Account</>}
          </button>
        </form>

        <p className="text-muted" style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.875rem" }}>
          Already have an account? <Link to="/login" style={{ color: "var(--clr-primary)" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
