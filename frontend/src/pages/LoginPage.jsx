import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogIn, BookOpen, ArrowRight } from "lucide-react";

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
      {/* Left decorative panel */}
      <div style={{ 
        flex: 1, 
        background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        padding: "3rem",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Abstract circles */}
        <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "300px", height: "300px", borderRadius: "50%", background: "rgba(255,255,255,0.08)" }}></div>
        <div style={{ position: "absolute", bottom: "-15%", right: "-5%", width: "250px", height: "250px", borderRadius: "50%", background: "rgba(255,255,255,0.05)" }}></div>
        <div style={{ position: "absolute", top: "50%", left: "60%", width: "150px", height: "150px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }}></div>
        
        <div style={{ textAlign: "center", color: "white", position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "2rem", padding: "0.5rem 1.25rem", borderRadius: "100px", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)" }}>
            <BookOpen size={18} />
            <span style={{ fontWeight: 700, fontSize: "1rem" }}>LearnwithHasan</span>
          </div>
          <h2 style={{ marginBottom: "1rem", fontSize: "2rem", fontWeight: 800, color: "#fff" }}>Welcome Back</h2>
          <p style={{ color: "rgba(255,255,255,0.8)", maxWidth: "300px", lineHeight: "1.7", fontSize: "1rem" }}>
            Continue your learning journey where you left off. Knowledge awaits.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem", background: "#fff" }}>
        <div style={{ width: "100%", maxWidth: "400px" }}>
          <Link to="/" style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--clr-heading)", display: "inline-flex", alignItems: "center", gap: "0.35rem", marginBottom: "2.5rem" }}>
            <BookOpen size={20} color="var(--clr-primary)" />
            Learnwith<span className="gradient-text">Hasan</span>
          </Link>
          <h2 style={{ marginBottom: "0.5rem", fontSize: "1.75rem" }}>Sign In</h2>
          <p className="text-muted" style={{ marginBottom: "2rem" }}>Enter your credentials to continue</p>

          {error && <div className="alert alert-error" style={{ marginBottom: "1.25rem" }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input id="email" name="email" type="email" className="form-control" value={form.email} onChange={handleChange} placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input id="password" name="password" type="password" className="form-control" value={form.password} onChange={handleChange} placeholder="Enter your password" required />
            </div>
            <button id="login-btn" type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "0.8rem", marginTop: "0.25rem" }}>
              {loading ? "Signing in..." : <>Sign In <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="text-muted" style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.875rem" }}>
            Don't have an account?{" "}
            <Link to="/register" style={{ color: "var(--clr-primary)", fontWeight: 600 }}>Create one free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
