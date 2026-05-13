import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";
import { coursesAPI, certificatesAPI, paymentsAPI } from "../../api";
import { BookOpen, Award, ShoppingBag } from "lucide-react";

export default function StudentDashboard() {
  const { user } = useAuth();

  const { data: enrData } = useQuery({ queryKey: ["my-enr"], queryFn: () => coursesAPI.myEnrollments().then(r => r.data) });
  const { data: certData } = useQuery({ queryKey: ["my-certs"], queryFn: () => certificatesAPI.list().then(r => r.data) });
  const { data: orderData } = useQuery({ queryKey: ["my-orders"], queryFn: () => paymentsAPI.myOrders().then(r => r.data) });

  const enrollments = Array.isArray(enrData) ? enrData : (enrData?.results || []);
  const certs = Array.isArray(certData) ? certData : (certData?.results || []);
  const orders = Array.isArray(orderData) ? orderData : (orderData?.results || []);

  return (
    <div className="page">
      <Navbar />
      <div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Welcome back, {user?.first_name || user?.username}!</h2>
        <p className="text-muted" style={{ marginBottom: "2.5rem" }}>Continue your learning journey</p>

        <div className="grid-3" style={{ marginBottom: "2.5rem" }}>
          {[
            { icon: BookOpen, label: "Enrolled Courses", value: enrollments.length, color: "var(--clr-primary)" },
            { icon: Award,    label: "Certificates",      value: certs.length,       color: "var(--clr-accent)" },
            { icon: ShoppingBag, label: "Orders",         value: orders.length,      color: "var(--clr-warning)" },
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

        <h3 style={{ marginBottom: "1rem" }}>My Courses</h3>
        {enrollments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", border: "1px dashed var(--clr-border)", borderRadius: "var(--radius-md)" }}>
            <BookOpen size={40} style={{ opacity: 0.3, margin: "0 auto 1rem" }} />
            <p className="text-muted">No courses yet. <Link to="/" style={{ color: "var(--clr-primary)" }}>Browse courses</Link></p>
          </div>
        ) : (
          <div className="grid-3">
            {enrollments.map(e => (
              <div key={e.id} className="card">
                <div className="card-body">
                  <h4 style={{ marginBottom: "0.5rem" }}>{e.course_title}</h4>
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--clr-muted)", marginBottom: "0.375rem" }}>
                      <span>Progress</span><span>{e.progress?.percent || 0}%</span>
                    </div>
                    <div className="progress-bar-wrap"><div className="progress-bar-fill" style={{ width: `${e.progress?.percent || 0}%` }} /></div>
                  </div>
                  <Link to={`/learn/${e.course_slug}`} className="btn btn-primary btn-sm" style={{ width: "100%", justifyContent: "center" }}>Continue</Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {certs.length > 0 && (
          <>
            <h3 style={{ marginTop: "2.5rem", marginBottom: "1rem" }}>Certificates</h3>
            <div className="grid-3">
              {certs.map(c => (
                <div key={c.id} className="card" style={{ borderColor: "var(--clr-accent)" }}>
                  <div className="card-body">
                    <Award size={24} color="var(--clr-accent)" style={{ marginBottom: "0.75rem" }} />
                    <h4 style={{ marginBottom: "0.25rem" }}>{c.course_title}</h4>
                    <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>Issued {new Date(c.issued_at).toLocaleDateString()}</p>
                    {c.pdf_file && <a href={c.pdf_file} download className="btn btn-outline btn-sm">Download PDF</a>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {orders.filter(o => o.status === "submitted" || o.status === "pending").length > 0 && (
          <>
            <h3 style={{ marginTop: "2.5rem", marginBottom: "1rem" }}>Pending Orders</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {orders.filter(o => ["pending","submitted"].includes(o.status)).map(o => (
                <div key={o.id} className="glass" style={{ padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontWeight: 600 }}>{o.course_title}</p>
                    <p className="text-muted" style={{ fontSize: "0.8rem" }}>Ref: {o.payment_reference || "Not submitted"} | BDT {o.amount}</p>
                  </div>
                  <span className={`badge ${o.status === "submitted" ? "badge-warning" : "badge-primary"}`}>{o.status}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
