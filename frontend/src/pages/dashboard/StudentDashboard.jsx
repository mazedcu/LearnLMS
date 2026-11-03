import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";
import { coursesAPI, certificatesAPI, paymentsAPI } from "../../api";
import { BookOpen, Award, ShoppingBag, PlusCircle, Clock } from "lucide-react";

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: courseData } = useQuery({ queryKey: ["courses"], queryFn: () => coursesAPI.list().then(r => r.data) });

  const { data: enrData } = useQuery({ queryKey: ["my-enr"], queryFn: () => coursesAPI.myEnrollments().then(r => r.data) });
  const { data: certData } = useQuery({ queryKey: ["my-certs"], queryFn: () => certificatesAPI.list().then(r => r.data) });
  const { data: orderData } = useQuery({ queryKey: ["my-orders"], queryFn: () => paymentsAPI.myOrders().then(r => r.data) });

  const enrollments = Array.isArray(enrData) ? enrData : (enrData?.results || []);
  const certs = Array.isArray(certData) ? certData : (certData?.results || []);
  const orders = Array.isArray(orderData) ? orderData : (orderData?.results || []);
  const allCourses = Array.isArray(courseData) ? courseData : (courseData?.results || []);
  const enrolledSlugs = new Set(enrollments.map(e => e.course_slug));
  const waitingSlugs = new Set(orders.filter(o => o.status === "submitted").map(o => o.course_slug));
  const moreCourses = allCourses.filter(c => c.status === "published" && !enrolledSlugs.has(c.slug));

  // One tap: free courses open at once; paid ones go to payment (no forms to fill — you're signed in)
  const enrollFree = useMutation({
    mutationFn: (slug) => coursesAPI.enroll(slug),
    onSuccess: (_r, slug) => { qc.invalidateQueries({ queryKey: ["my-enr"] }); navigate(`/learn/${slug}`); },
  });
  const apply = (c) => (c.is_free ? enrollFree.mutate(c.slug) : navigate(`/checkout/${c.slug}`));

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

        {moreCourses.length > 0 && (
          <>
            <h3 style={{ marginTop: "2.5rem", marginBottom: "0.35rem" }}>Enroll in another subject</h3>
            <p className="text-muted" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>You're already signed in, so there's nothing to fill in — just pay and send the transaction ID.</p>
            <div className="grid-3">
              {moreCourses.map(c => {
                const waiting = waitingSlugs.has(c.slug);
                return (
                  <div key={c.id} className="card">
                    <div className="card-body" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                      <h4 style={{ marginBottom: "0.35rem" }}>{c.title}</h4>
                      {c.short_description && <p className="text-muted" style={{ fontSize: "0.82rem", marginBottom: "0.75rem", flex: 1 }}>{c.short_description}</p>}
                      <p style={{ fontWeight: 700, marginBottom: "0.75rem", color: "var(--clr-heading)" }}>{c.is_free ? "Free" : `BDT ${Number(c.price).toLocaleString()}`}</p>
                      {waiting ? (
                        <span className="badge badge-warning" style={{ justifyContent: "center", padding: "0.5rem", display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
                          <Clock size={14} /> Payment sent — waiting for approval
                        </span>
                      ) : (
                        <button className="btn btn-primary btn-sm" style={{ width: "100%", justifyContent: "center" }}
                          disabled={enrollFree.isPending} onClick={() => apply(c)}>
                          <PlusCircle size={15} /> {c.is_free ? "Enroll now" : "Enroll"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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
