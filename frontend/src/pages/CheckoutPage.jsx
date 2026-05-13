import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { coursesAPI, paymentsAPI } from "../api";
import Navbar from "../components/Navbar";
import { CheckCircle, CreditCard } from "lucide-react";

const BKASH_NUMBER  = "01XXXXXXXXX";
const NAGAD_NUMBER  = "01XXXXXXXXX";

export default function CheckoutPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const passedOrderId = location.state?.orderId;

  const { data: course } = useQuery({
    queryKey: ["course", slug],
    queryFn: () => coursesAPI.detail(slug).then(r => r.data),
  });

  const [orderId, setOrderId] = useState(passedOrderId || null);
  const [method, setMethod] = useState("bkash");
  const [ref, setRef] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const createOrder = useMutation({
    mutationFn: () => paymentsAPI.createOrder({ course: course.id, payment_method: method }).then(r => r.data),
    onSuccess: (d) => setOrderId(d.id),
    onError: (e) => setError(e.response?.data?.detail || "Failed to create order."),
  });

  const submitRef = useMutation({
    mutationFn: () => paymentsAPI.submitReference(orderId, { payment_reference: ref, payment_method: method }),
    onSuccess: () => setDone(true),
    onError: (e) => setError(e.response?.data?.detail || "Failed to submit reference."),
  });

  if (!course) return <><Navbar /><div className="loading-screen"><div className="spinner" /></div></>;

  const payNumber = method === "bkash" ? BKASH_NUMBER : NAGAD_NUMBER;

  return (
    <div className="page">
      <Navbar />
      <div className="container" style={{ maxWidth: "640px", paddingTop: "3rem", paddingBottom: "4rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Checkout</h2>
        <p className="text-muted" style={{ marginBottom: "2rem" }}>Complete your purchase to gain access.</p>

        {done ? (
          <div className="glass" style={{ padding: "2.5rem", textAlign: "center" }}>
            <CheckCircle size={48} color="var(--clr-success)" style={{ margin: "0 auto 1rem" }} />
            <h3 style={{ marginBottom: "0.75rem" }}>Reference Submitted!</h3>
            <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
              Our admin will verify your payment within 24 hours. You will receive a confirmation email once approved.
            </p>
            <button className="btn btn-primary" onClick={() => navigate("/dashboard/student")}>Go to Dashboard</button>
          </div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <div className="card-body">
                <h4>{course.title}</h4>
                <p className="text-muted" style={{ fontSize: "0.875rem", margin: "0.5rem 0" }}>{course.short_description}</p>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--clr-accent)" }}>BDT {course.price}</div>
              </div>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

            <div className="glass" style={{ padding: "1.75rem", marginBottom: "1.5rem" }}>
              <h4 style={{ marginBottom: "1rem" }}>1. Select Payment Method</h4>
              <div style={{ display: "flex", gap: "1rem" }}>
                {["bkash", "nagad"].map(m => (
                  <button key={m} onClick={() => setMethod(m)} className="btn" style={{ flex: 1, justifyContent: "center", border: `2px solid ${method === m ? "var(--clr-primary)" : "var(--clr-border)"}`, background: method === m ? "rgba(108,99,255,0.1)" : "transparent", color: "var(--clr-text)", fontWeight: 600, textTransform: "capitalize" }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass" style={{ padding: "1.75rem", marginBottom: "1.5rem" }}>
              <h4 style={{ marginBottom: "0.75rem" }}>2. Send Payment</h4>
              <div style={{ background: "var(--clr-surface)", borderRadius: "var(--radius-sm)", padding: "1rem", marginBottom: "0.75rem" }}>
                <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "0.25rem" }}>Send BDT {course.price} to this {method} number:</p>
                <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--clr-heading)", letterSpacing: "1px" }}>{payNumber}</p>
                <p className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>Use "Send Money" option</p>
              </div>
              <p className="text-muted" style={{ fontSize: "0.8rem" }}>Note your transaction ID after sending.</p>
            </div>

            <div className="glass" style={{ padding: "1.75rem" }}>
              <h4 style={{ marginBottom: "1rem" }}>3. Submit Transaction Reference</h4>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label className="form-label">Transaction ID / Reference</label>
                <input className="form-control" value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. 8N8ABXXXXXXXXXXX" />
              </div>
              {!orderId ? (
                <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => createOrder.mutate()} disabled={createOrder.isPending}>
                  {createOrder.isPending ? "Creating order..." : "Proceed"}
                </button>
              ) : (
                <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => submitRef.mutate()} disabled={!ref || submitRef.isPending}>
                  <CreditCard size={16} /> {submitRef.isPending ? "Submitting..." : "Submit for Verification"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
