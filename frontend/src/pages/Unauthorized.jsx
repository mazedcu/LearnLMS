import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { ShieldOff } from "lucide-react";

export default function Unauthorized() {
  return (
    <div className="page">
      <Navbar />
      <div style={{ textAlign: "center", padding: "6rem 2rem" }}>
        <ShieldOff size={56} color="var(--clr-danger)" style={{ margin: "0 auto 1.5rem" }} />
        <h2 style={{ marginBottom: "0.75rem" }}>Access Denied</h2>
        <p className="text-muted" style={{ marginBottom: "2rem" }}>You do not have permission to view this page.</p>
        <Link to="/" className="btn btn-primary">Back to Home</Link>
      </div>
    </div>
  );
}
