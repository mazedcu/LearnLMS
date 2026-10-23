import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentsAPI } from "../../api";
import { CheckCircle, XCircle, Clock, AlertTriangle, Phone } from "lucide-react";

/* ── Numbers students pay to (shown on the checkout page) ── */
function PaymentNumbers() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["payment-settings"], queryFn: () => paymentsAPI.settings().then(r => r.data) });
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState("");
  if (data && !form) setForm({ bkash_number: data.bkash_number, nagad_number: data.nagad_number, instructions: data.instructions });

  const save = useMutation({
    mutationFn: () => paymentsAPI.updateSettings(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment-settings"] }); setMsg("Saved — the checkout page now shows these."); setTimeout(() => setMsg(""), 3000); },
    onError: (e) => setMsg(Object.values(e.response?.data || {}).flat().join(" ") || "Couldn't save."),
  });
  if (!form) return null;
  const dirty = data && (form.bkash_number !== data.bkash_number || form.nagad_number !== data.nagad_number || form.instructions !== data.instructions);

  return (
    <div className="glass" style={{ padding: "1.25rem", marginBottom: "1.75rem" }}>
      <p style={{ fontWeight: 700, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <Phone size={15} /> Payment numbers <span className="text-muted" style={{ fontWeight: 400, fontSize: "0.8rem" }}>· shown to students at checkout</span>
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <label className="form-group" style={{ flex: "1 1 180px", margin: 0 }}>
          <span className="form-label">bKash number</span>
          <input className="form-control" value={form.bkash_number} onChange={e => setForm(f => ({ ...f, bkash_number: e.target.value }))} placeholder="01XXXXXXXXX" />
        </label>
        <label className="form-group" style={{ flex: "1 1 180px", margin: 0 }}>
          <span className="form-label">Nagad number</span>
          <input className="form-control" value={form.nagad_number} onChange={e => setForm(f => ({ ...f, nagad_number: e.target.value }))} placeholder="01XXXXXXXXX" />
        </label>
      </div>
      <label className="form-group" style={{ margin: "0.75rem 0 0" }}>
        <span className="form-label">Instructions for students</span>
        <textarea className="form-control" rows={2} value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} />
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.75rem" }}>
        <button className="btn btn-primary btn-sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>{save.isPending ? "Saving…" : "Save"}</button>
        {msg && <span className="text-muted" style={{ fontSize: "0.8rem" }}>{msg}</span>}
      </div>
    </div>
  );
}

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
      <PaymentNumbers />
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
                {o.reference_used_on?.length > 0 && (
                  <p style={{ fontSize: "0.78rem", color: "#B45309", background: "rgba(245,158,11,0.1)", padding: "0.4rem 0.6rem", borderRadius: 6, marginTop: "0.4rem", display: "flex", gap: "0.4rem", alignItems: "flex-start" }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>This transaction ID was already used by {o.reference_used_on.map(r => `${r.student_email} (${r.status})`).join(", ")}. Check your bKash/Nagad statement before approving.</span>
                  </p>
                )}
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
