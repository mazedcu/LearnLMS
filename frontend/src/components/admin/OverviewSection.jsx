import { useQuery } from "@tanstack/react-query";
import { authAPI } from "../../api";
import { Users, BookOpen, TrendingUp, CreditCard, Award, GraduationCap } from "lucide-react";

export default function OverviewSection() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: () => authAPI.platformStats().then(r => r.data),
  });

  const cards = [
    { label: "Total Users",        value: stats?.total_users,        icon: Users,         color: "var(--clr-primary)" },
    { label: "Students",           value: stats?.total_students,     icon: GraduationCap, color: "var(--clr-accent)" },
    { label: "Instructors",        value: stats?.total_instructors,  icon: Users,         color: "var(--clr-warning)" },
    { label: "Total Courses",      value: stats?.total_courses,      icon: BookOpen,      color: "#a78bfa" },
    { label: "Active Enrollments", value: stats?.total_enrollments,  icon: TrendingUp,    color: "var(--clr-success)" },
    { label: "Pending Payments",   value: stats?.pending_payments,   icon: CreditCard,    color: "#f97316", highlight: stats?.pending_payments > 0 },
    { label: "Certificates",       value: stats?.total_certificates, icon: Award,         color: "#06b6d4" },
    { label: "Published Courses",  value: stats?.published_courses,  icon: BookOpen,      color: "#8b5cf6" },
  ];

  if (isLoading) return <div className="spinner" style={{ margin: "3rem auto" }} />;

  return (
    <div>
      <h3 style={{ marginBottom: "1.5rem" }}>Platform Overview</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
        {cards.map(({ label, value, icon: Icon, color, highlight }) => (
          <div key={label} className="glass" style={{ padding: "1.25rem", border: highlight ? "1px solid #f97316" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p className="text-muted" style={{ fontSize: "0.75rem", marginBottom: "0.375rem" }}>{label}</p>
                <p style={{ fontSize: "2rem", fontWeight: 800, color: "var(--clr-heading)" }}>{value ?? "-"}</p>
              </div>
              <div style={{ background: `${color}20`, borderRadius: "50%", padding: "0.625rem" }}>
                <Icon size={18} color={color} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
