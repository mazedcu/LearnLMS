import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { certificatesAPI } from "../api";
import Navbar from "../components/Navbar";
import { Award, CheckCircle, XCircle } from "lucide-react";

export default function CertVerify() {
  const { uuid } = useParams();
  const { data: cert, isLoading, isError } = useQuery({
    queryKey: ["cert-verify", uuid],
    queryFn: () => certificatesAPI.verify(uuid).then(r => r.data),
  });

  return (
    <div className="page">
      <Navbar />
      <div className="container" style={{ maxWidth: "560px", paddingTop: "4rem", paddingBottom: "4rem", textAlign: "center" }}>
        {isLoading && <div className="spinner" style={{ margin: "3rem auto" }} />}
        {isError && (
          <div className="glass" style={{ padding: "2.5rem" }}>
            <XCircle size={48} color="var(--clr-danger)" style={{ margin: "0 auto 1rem" }} />
            <h3 style={{ marginBottom: "0.75rem" }}>Certificate Not Found</h3>
            <p className="text-muted">This certificate ID is invalid or does not exist.</p>
          </div>
        )}
        {cert && (
          <div className="glass" style={{ padding: "2.5rem" }}>
            <Award size={56} color="var(--clr-accent)" style={{ margin: "0 auto 1.25rem" }} />
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(34,197,94,0.1)", color: "var(--clr-success)", border: "1px solid var(--clr-success)", borderRadius: "100px", padding: "0.25rem 0.875rem", fontSize: "0.8rem", fontWeight: 600, marginBottom: "1.5rem" }}>
              <CheckCircle size={14} /> Verified Certificate
            </div>
            <h2 style={{ marginBottom: "0.5rem" }}>Certificate of Completion</h2>
            <p className="text-muted" style={{ marginBottom: "1.5rem" }}>This certificate is authentic and was issued by LearnwithHasan.</p>
            <div style={{ background: "var(--clr-surface)", borderRadius: "var(--radius-md)", padding: "1.5rem", textAlign: "left" }}>
              <div style={{ marginBottom: "1rem" }}>
                <p className="text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>Awarded to</p>
                <p style={{ fontWeight: 700, fontSize: "1.25rem" }}>{cert.student_name}</p>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <p className="text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>For completing</p>
                <p style={{ fontWeight: 600 }}>{cert.course_title}</p>
              </div>
              <div>
                <p className="text-muted" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>Issued on</p>
                <p style={{ fontWeight: 500 }}>{new Date(cert.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
            </div>
            <p className="text-muted" style={{ fontSize: "0.7rem", marginTop: "1.25rem" }}>Certificate ID: {cert.certificate_number}</p>
          </div>
        )}
      </div>
    </div>
  );
}
