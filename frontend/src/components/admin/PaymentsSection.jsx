import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentsAPI } from "../../api";
import { CheckCircle, XCircle, Clock } from "lucide-react";

export default function PaymentsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["pending-orders"],
    queryFn: () => paymentsAPI.pendingOrders().then(r => Array.isArray(r.data) ? r.data : r.data?.results || []),
  });
  const [notes, setNotes] = useState({});

  const verify = useMutation({
    mutationFn: ({ id, action }) => paymentsAPI.verifyOrder(id, { action, admin_note: notes[id] || "" }),
    onSuccess: () => qc.invalidateQueries(["pending-orders"]),
  });

  const orders = data || [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
        <h3 style={{ margin: 0 }}>Pending Payments</h3>
        {orders.length > 0 && (
          <span style={{ background: "#f97316", color: "#fff", borderRadius: "100px", padding: "0.125rem 0.625rem", fontSize: "0.75rem", fontWeight: 700 }}>{orders.length}</span>
        )}
      </div>

      {isLoading && <div className="spinner" style={{ margin: "2rem auto" }} />}
      {!isLoading && orders.length === 0 && (
        <div className="alert alert-success"><CheckCircle size={16} /> All payments reviewed. No pending orders.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {orders.map(o => (
          <div key={o.id} className="glass" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{o.course_title}</p>
                <p className="text-muted" style={{ fontSize: "0.8rem" }}>Student: {o.student_email}</p>
                <p className="text-muted" style={{ fontSize: "0.8rem" }}>
                  Method: <strong style={{ color: "var(--clr-text)" }}>{o.payment_method?.toUpperCase()}</strong>
                  {" "} | Ref: <strong style={{ color: "var(--clr-accent)" }}>{o.payment_reference}</strong>
                  {" "} | <strong style={{ color: "var(--clr-warning)" }}>BDT {o.amount}</strong>
                </p>
                <p className="text-muted" style={{ fontSize: "0.75rem" }}><Clock size={11} style={{ verticalAlign: "middle" }} /> {new Date(o.created_at).toLocaleString()}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: "240px" }}>
                <input className="form-control" placeholder="Admin note (optional)" style={{ fontSize: "0.8rem" }}
                  value={notes[o.id] || ""} onChange={e => setNotes(n => ({ ...n, [o.id]: e.target.value }))} />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button className="btn btn-sm" style={{ flex: 1, background: "rgba(34,197,94,0.15)", color: "var(--clr-success)", border: "1px solid var(--clr-success)", justifyContent: "center" }}
                    onClick={() => verify.mutate({ id: o.id, action: "verified" })} disabled={verify.isPending}>
                    <CheckCircle size={13} /> Approve
                  </button>
                  <button className="btn btn-danger btn-sm" style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => verify.mutate({ id: o.id, action: "rejected" })} disabled={verify.isPending}>
                    <XCircle size={13} /> Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
