import Navbar from "../../components/Navbar";
import { BarChart2, Users, BookOpen, TrendingUp } from "lucide-react";

export default function ManagerDashboard() {
  return (
    <div className="page">
      <Navbar />
      <div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Manager Dashboard</h2>
        <p className="text-muted" style={{ marginBottom: "2.5rem" }}>Platform analytics and oversight</p>
        <div className="grid-4">
          {[
            { icon: Users,    label: "Total Users",    value: "-", color: "var(--clr-primary)" },
            { icon: BookOpen, label: "Total Courses",  value: "-", color: "var(--clr-accent)" },
            { icon: TrendingUp, label: "Enrollments",  value: "-", color: "var(--clr-success)" },
            { icon: BarChart2, label: "Completions",   value: "-", color: "var(--clr-warning)" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="glass" style={{ padding: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ background: `${color}20`, borderRadius: "50%", padding: "0.75rem" }}><Icon size={22} color={color} /></div>
              <div>
                <p className="text-muted" style={{ fontSize: "0.8rem" }}>{label}</p>
                <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--clr-heading)" }}>{value}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="alert alert-info" style={{ marginTop: "2rem" }}>
          Analytics data will populate as students enroll and complete courses.
        </div>
      </div>
    </div>
  );
}
