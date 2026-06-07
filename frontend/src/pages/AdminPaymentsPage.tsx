import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { BACKEND_URL } from "../lib/config";

interface Payment {
  id: string;
  user_id: string;
  plan_tier: string;
  amount_etb: number;
  payment_method: string;
  transaction_reference: string;
  screenshot_url: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

interface StudentVerification {
  id: string;
  user_id: string;
  institution_name: string;
  document_url: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

const STATUS_TABS = ["pending_review", "approved", "rejected"];
const STUDENT_STATUS_TABS = ["pending", "verified", "rejected"];

const TIER_COLORS: Record<string, string> = {
  free:        "#6b7280",
  student:     "#2563eb",
  clinician:   "var(--brand-green)",
  pro:         "#7c3aed",
  institution: "#d97706",
};

export function AdminPaymentsPage() {
  const navigate = useNavigate();
  const [pageView, setPageView]     = useState<"payments" | "students">("payments");
  const [token, setToken]           = useState("");

  // ── Payments state ───────────────────────────────────────────────────────
  const [payments, setPayments]     = useState<Payment[]>([]);
  const [activeTab, setActiveTab]   = useState("pending_review");
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [actionId, setActionId]     = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<Record<string, string>>({});

  // ── Student verifications state ──────────────────────────────────────────
  const [students, setStudents]           = useState<StudentVerification[]>([]);
  const [studentTab, setStudentTab]       = useState("pending");
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError]   = useState("");
  const [studentActionId, setStudentActionId] = useState<string | null>(null);
  const [studentRejectTarget, setStudentRejectTarget] = useState<string | null>(null);
  const [studentRejectReason, setStudentRejectReason] = useState("");
  const [studentIdUrl, setStudentIdUrl]   = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/login", { replace: true }); return; }
      setToken(session.access_token);
    });
  }, [navigate]);

  useEffect(() => {
    if (!token) return;
    loadPayments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTab]);

  useEffect(() => {
    if (!token) return;
    loadStudents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, studentTab]);

  async function loadPayments() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/admin/payments?status=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) { setError("Access denied. Admin only."); return; }
      if (!res.ok) { setError(`Server error: ${res.status}`); return; }
      const d = await res.json();
      setPayments(d.payments ?? []);
    } catch {
      setError("Failed to load payments.");
    } finally {
      setLoading(false);
    }
  }

  async function viewScreenshot(paymentId: string) {
    if (screenshotUrl[paymentId]) { window.open(screenshotUrl[paymentId], "_blank"); return; }
    try {
      const res = await fetch(`${BACKEND_URL}/admin/payment/screenshot/${paymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert("Could not load screenshot."); return; }
      const d = await res.json();
      const url = d.signed_url;
      setScreenshotUrl(prev => ({ ...prev, [paymentId]: url }));
      window.open(url, "_blank");
    } catch { alert("Failed to fetch screenshot."); }
  }

  async function approve(paymentId: string) {
    setActionId(paymentId);
    try {
      const res = await fetch(`${BACKEND_URL}/admin/payment/approve`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ payment_id: paymentId }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.detail ?? "Approval failed."); return; }
      await loadPayments();
    } catch { alert("Network error."); } finally { setActionId(null); }
  }

  async function reject(paymentId: string) {
    if (!rejectReason.trim()) { alert("Please enter a rejection reason."); return; }
    setActionId(paymentId);
    try {
      const res = await fetch(`${BACKEND_URL}/admin/payment/reject`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ payment_id: paymentId, reason: rejectReason }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.detail ?? "Rejection failed."); return; }
      setRejectTarget(null);
      setRejectReason("");
      await loadPayments();
    } catch { alert("Network error."); } finally { setActionId(null); }
  }

  async function loadStudents() {
    setStudentLoading(true);
    setStudentError("");
    try {
      const res = await fetch(`${BACKEND_URL}/admin/student-verifications?status=${studentTab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) { setStudentError("Access denied. Admin only."); return; }
      if (!res.ok) { setStudentError(`Server error: ${res.status}`); return; }
      const d = await res.json();
      setStudents(d.verifications ?? []);
    } catch {
      setStudentError("Failed to load student verifications.");
    } finally {
      setStudentLoading(false);
    }
  }

  async function viewStudentId(vid: string) {
    if (studentIdUrl[vid]) { window.open(studentIdUrl[vid], "_blank"); return; }
    try {
      const res = await fetch(`${BACKEND_URL}/admin/student-id-url/${vid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert("Could not load student ID."); return; }
      const d = await res.json();
      setStudentIdUrl(prev => ({ ...prev, [vid]: d.url }));
      window.open(d.url, "_blank");
    } catch { alert("Failed to fetch student ID."); }
  }

  async function approveStudent(vid: string) {
    setStudentActionId(vid);
    try {
      const res = await fetch(`${BACKEND_URL}/admin/student/approve`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ id: vid }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.detail ?? "Approval failed."); return; }
      await loadStudents();
    } catch { alert("Network error."); } finally { setStudentActionId(null); }
  }

  async function rejectStudent(vid: string) {
    if (!studentRejectReason.trim()) { alert("Please enter a rejection reason."); return; }
    setStudentActionId(vid);
    try {
      const res = await fetch(`${BACKEND_URL}/admin/student/reject`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ id: vid, reason: studentRejectReason }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.detail ?? "Rejection failed."); return; }
      setStudentRejectTarget(null);
      setStudentRejectReason("");
      await loadStudents();
    } catch { alert("Network error."); } finally { setStudentActionId(null); }
  }

  const pendingCount = payments.length;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", padding: "32px 20px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 22, padding: 0 }}>←</button>
          <div>
            <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Admin Operations
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>Payments & student verifications</p>
          </div>
          <button
            onClick={() => pageView === "payments" ? loadPayments() : loadStudents()}
            style={{ marginLeft: "auto", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" }}
          >
            Refresh
          </button>
        </div>

        {/* Page-level tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 4, width: "fit-content" }}>
          {([["payments", "💳 Payments"], ["students", "🎓 Student IDs"]] as const).map(([view, label]) => (
            <button
              key={view}
              onClick={() => setPageView(view)}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
                background: pageView === view ? "var(--brand-navy)" : "none",
                color: pageView === view ? "#fff" : "var(--text-secondary)",
                fontWeight: pageView === view ? 700 : 500,
                fontSize: 13, transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── PAYMENTS VIEW ──────────────────────────────────────────────────── */}
        {pageView === "payments" && (<>

        {/* Status tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 4, width: "fit-content" }}>
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                background: activeTab === tab ? "var(--brand-green)" : "none",
                color: activeTab === tab ? "#fff" : "var(--text-secondary)",
                fontWeight: activeTab === tab ? 700 : 500,
                fontSize: 13, transition: "all 0.15s",
              }}
            >
              {tab === "pending_review" ? "Pending Review" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "pending_review" && activeTab === tab && pendingCount > 0 && (
                <span style={{ marginLeft: 6, background: "#ef4444", color: "#fff", borderRadius: 20, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "var(--destructive-bg, #fef2f2)", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 18px", color: "var(--destructive, #dc2626)", fontSize: 14, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--brand-green)", borderRadius: "50%", margin: "0 auto 12px", animation: "spin 0.8s linear infinite" }} />
            <p style={{ margin: 0, fontSize: 14 }}>Loading payments…</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && payments.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
            <p style={{ fontSize: 32, margin: "0 0 12px" }}>✅</p>
            <p style={{ fontSize: 15, margin: 0 }}>No {activeTab.replace("_", " ")} payments.</p>
          </div>
        )}

        {/* Payments table */}
        {!loading && payments.length > 0 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg)" }}>
                    {["User ID", "Plan", "Amount", "Method", "Tx Ref", "Submitted", "Screenshot", "Actions"].map(h => (
                      <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontFamily: "var(--font-heading)", fontWeight: 600, color: "var(--text-secondary)", fontSize: 11, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", letterSpacing: 0.3 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>
                        {p.user_id.slice(0, 8)}…
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ background: "var(--bg)", border: `1px solid ${TIER_COLORS[p.plan_tier] ?? "var(--border)"}`, color: TIER_COLORS[p.plan_tier] ?? "var(--text-primary)", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>
                          {p.plan_tier}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--text-primary)" }}>
                        {p.amount_etb} ETB
                      </td>
                      <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>
                        {p.payment_method ?? "—"}
                      </td>
                      <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>
                        {p.transaction_reference || "—"}
                      </td>
                      <td style={{ padding: "12px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {new Date(p.created_at).toLocaleDateString("en-ET", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <button
                          onClick={() => viewScreenshot(p.id)}
                          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "var(--text-secondary)" }}
                        >
                          View 🖼
                        </button>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {activeTab === "pending_review" ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <button
                              onClick={() => approve(p.id)}
                              disabled={actionId === p.id}
                              style={{ background: "var(--success-bg, #dcfce7)", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--success, #16a34a)" }}
                            >
                              {actionId === p.id ? "…" : "✅ Approve"}
                            </button>
                            <button
                              onClick={() => setRejectTarget(p.id)}
                              style={{ background: "var(--destructive-bg, #fef2f2)", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--destructive, #dc2626)" }}
                            >
                              ❌ Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                            {p.status === "approved" ? "✅ Approved" : `❌ ${p.rejection_reason ?? "Rejected"}`}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment reject modal */}
        {rejectTarget && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "28px 24px", maxWidth: 440, width: "100%" }}>
              <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px" }}>
                Reject payment
              </h3>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 14px" }}>
                Provide a reason. This helps the user understand what to fix and resubmit.
              </p>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. Screenshot is unclear. Please resend a higher quality image."
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg)", color: "var(--text-primary)", fontSize: 14, resize: "vertical", boxSizing: "border-box", outline: "none" }}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => { setRejectTarget(null); setRejectReason(""); }} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid var(--border)", background: "none", cursor: "pointer", fontSize: 14, color: "var(--text-secondary)" }}>Cancel</button>
                <button onClick={() => reject(rejectTarget)} disabled={actionId === rejectTarget} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "var(--destructive, #dc2626)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
                  {actionId === rejectTarget ? "Rejecting…" : "Reject Payment"}
                </button>
              </div>
            </div>
          </div>
        )}

        </>) /* end payments view */}

        {/* ── STUDENT IDs VIEW ───────────────────────────────────────────────── */}
        {pageView === "students" && (<>

        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 4, width: "fit-content" }}>
          {STUDENT_STATUS_TABS.map(tab => (
            <button key={tab} onClick={() => setStudentTab(tab)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: studentTab === tab ? "var(--brand-green)" : "none", color: studentTab === tab ? "#fff" : "var(--text-secondary)", fontWeight: studentTab === tab ? 700 : 500, fontSize: 13, transition: "all 0.15s" }}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {studentError && (
          <div style={{ background: "var(--destructive-bg, #fef2f2)", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 18px", color: "var(--destructive, #dc2626)", fontSize: 14, marginBottom: 20 }}>
            {studentError}
          </div>
        )}

        {studentLoading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--brand-green)", borderRadius: "50%", margin: "0 auto 12px", animation: "spin 0.8s linear infinite" }} />
            <p style={{ margin: 0, fontSize: 14 }}>Loading verifications…</p>
          </div>
        )}

        {!studentLoading && !studentError && students.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
            <p style={{ fontSize: 32, margin: "0 0 12px" }}>🎓</p>
            <p style={{ fontSize: 15, margin: 0 }}>No {studentTab} student verifications.</p>
          </div>
        )}

        {!studentLoading && students.length > 0 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg)" }}>
                    {["User ID", "Institution", "Submitted", "ID Document", "Actions"].map(h => (
                      <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontFamily: "var(--font-heading)", fontWeight: 600, color: "var(--text-secondary)", fontSize: 11, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", letterSpacing: 0.3 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>{s.user_id.slice(0, 8)}…</td>
                      <td style={{ padding: "12px 14px", color: "var(--text-primary)", fontWeight: 600 }}>{s.institution_name ?? "—"}</td>
                      <td style={{ padding: "12px 14px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {new Date(s.created_at).toLocaleDateString("en-ET", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <button onClick={() => viewStudentId(s.id)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12, color: "var(--text-secondary)" }}>
                          View 🪪
                        </button>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {studentTab === "pending" ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => approveStudent(s.id)} disabled={studentActionId === s.id} style={{ background: "var(--success-bg, #dcfce7)", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--success, #16a34a)" }}>
                              {studentActionId === s.id ? "…" : "✅ Verify"}
                            </button>
                            <button onClick={() => setStudentRejectTarget(s.id)} style={{ background: "var(--destructive-bg, #fef2f2)", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--destructive, #dc2626)" }}>
                              ❌ Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                            {s.status === "verified" ? "✅ Verified" : `❌ ${s.rejection_reason ?? "Rejected"}`}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Student reject modal */}
        {studentRejectTarget && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "28px 24px", maxWidth: 440, width: "100%" }}>
              <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px" }}>Reject student ID</h3>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 14px" }}>Explain why this ID was rejected so the student can resubmit.</p>
              <textarea value={studentRejectReason} onChange={e => setStudentRejectReason(e.target.value)} rows={3} placeholder="e.g. ID photo is blurry. Please upload a clearer image." style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg)", color: "var(--text-primary)", fontSize: 14, resize: "vertical", boxSizing: "border-box", outline: "none" }} />
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => { setStudentRejectTarget(null); setStudentRejectReason(""); }} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid var(--border)", background: "none", cursor: "pointer", fontSize: 14, color: "var(--text-secondary)" }}>Cancel</button>
                <button onClick={() => rejectStudent(studentRejectTarget)} disabled={studentActionId === studentRejectTarget} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: "var(--destructive, #dc2626)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
                  {studentActionId === studentRejectTarget ? "Rejecting…" : "Reject ID"}
                </button>
              </div>
            </div>
          </div>
        )}

        </>) /* end students view */}

      </div>
    </div>
  );
}
