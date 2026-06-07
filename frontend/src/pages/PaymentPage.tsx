import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { BACKEND_URL } from "../lib/config";

// ── Update these with real account details ─────────────────────────────────
const PAYMENT_ACCOUNTS = [
  { icon: "📱", label: "Telebirr", value: "0966217319" },
  { icon: "📱", label: "Ebirr",    value: "0901415577" },
  { icon: "🏦", label: "CBE",      value: "1000652719547" },
];
const ACCOUNT_NAME = "Mahmud Ahmed Mohammed";
// ─────────────────────────────────────────────────────────────────────────────

const TIER_PRICES: Record<string, number> = {
  student:     99,
  clinician:   249,
  pro:         499,
  institution: 3000,
};

const TIER_NAMES: Record<string, string> = {
  student:     "Student",
  clinician:   "Clinician",
  pro:         "Pro",
  institution: "Institution",
};

const PAYMENT_METHODS = ["Telebirr", "Ebirr", "CBE", "Bank Transfer", "Other"];

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PaymentPage() {
  const { tier }     = useParams<{ tier: string }>();
  const navigate     = useNavigate();

  const [session, setSession]                     = useState<any>(null);
  const [paymentMethod, setPaymentMethod]         = useState("Telebirr");
  const [txRef, setTxRef]                         = useState("");
  const [screenshotFile, setScreenshotFile]       = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [studentIdFile, setStudentIdFile]         = useState<File | null>(null);
  const [studentIdName, setStudentIdName]         = useState("");
  const [institution, setInstitution]             = useState("");
  const [submitting, setSubmitting]               = useState(false);
  const [done, setDone]                           = useState(false);
  const [error, setError]                         = useState("");
  const [copied, setCopied]                       = useState<string | null>(null);
  const screenshotRef = useRef<HTMLInputElement>(null);
  const studentIdRef  = useRef<HTMLInputElement>(null);

  const tierName  = tier ? (TIER_NAMES[tier] ?? tier) : "";
  const price     = tier ? (TIER_PRICES[tier] ?? 0) : 0;
  const isStudent = tier === "student";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) { navigate(`/signup?next=/subscribe/${tier}`, { replace: true }); return; }
      setSession(s);
    });
  }, [tier, navigate]);

  function handleScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setScreenshotFile(f);
    const url = URL.createObjectURL(f);
    setScreenshotPreview(url);
  }

  function handleStudentId(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setStudentIdFile(f);
    setStudentIdName(f.name);
  }

  async function copyAccount(value: string) {
    try { await navigator.clipboard.writeText(value); } catch { /* ignore */ }
    setCopied(value);
    setTimeout(() => setCopied(null), 1800);
  }

  async function handleSubmit() {
    setError("");
    if (!screenshotFile) { setError("Please upload a payment screenshot."); return; }
    if (isStudent && !studentIdFile) { setError("Please upload your student ID for the student plan."); return; }

    setSubmitting(true);
    try {
      const screenshotB64 = await toBase64(screenshotFile);

      const payBody: Record<string, unknown> = {
        plan_tier:             tier,
        amount_etb:            price,
        payment_method:        paymentMethod,
        transaction_reference: txRef,
        screenshot_base64:     screenshotB64,
        filename:              screenshotFile.name,
      };

      const payRes = await fetch(`${BACKEND_URL}/payment/submit`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          Authorization:   `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payBody),
      });

      if (!payRes.ok) {
        const d = await payRes.json().catch(() => ({}));
        throw new Error(d.detail ?? `Server error ${payRes.status}`);
      }

      if (isStudent && studentIdFile) {
        const idB64 = await toBase64(studentIdFile);
        await fetch(`${BACKEND_URL}/student/verify`, {
          method:  "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:  `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            document_base64: idB64,
            document_type:   "student_id",
            institution,
            filename:        studentIdFile.name,
            content_type:    studentIdFile.type || "image/jpeg",
          }),
        });
      }

      setDone(true);
    } catch (e: any) {
      setError(e.message ?? "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "48px 36px", maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 12px" }}>
            Payment submitted!
          </h2>
          <p style={{ margin: "0 0 28px", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Your <strong>{tierName}</strong> subscription will be activated within <strong>1–24 hours</strong> once we verify your payment.
            We'll update your account automatically — no action needed.
          </p>
          <button
            onClick={() => navigate("/chat")}
            style={{ background: "var(--brand-green)", color: "#fff", border: "none", borderRadius: 12, padding: "13px 28px", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
          >
            Back to SCIP
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", padding: "32px 20px" }}>
      <style>{`
        .pay-input { width: 100%; padding: 11px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text-primary); font-size: 14px; box-sizing: border-box; outline: none; }
        .pay-input:focus { border-color: var(--brand-green); }
        .upload-zone { border: 2px dashed var(--border); border-radius: 12px; padding: 24px; text-align: center; cursor: pointer; transition: border-color 0.15s; }
        .upload-zone:hover { border-color: var(--brand-green); }
      `}</style>

      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 22, padding: 0 }}>←</button>
          <div>
            <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              Subscribe to {tierName}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{price} ETB / month</p>
          </div>
        </div>

        {/* Step 1: Payment accounts */}
        <Section number={1} title="Send payment">
          <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--text-secondary)" }}>
            Send <strong>{price} ETB</strong> to one of these accounts. Keep your transaction reference or screenshot.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PAYMENT_ACCOUNTS.map(({ icon, label, value }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{icon} {label}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: "var(--text-primary)" }}>{value}</p>
                </div>
                <button
                  onClick={() => copyAccount(value)}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", color: copied === value ? "var(--brand-green)" : "var(--text-muted)" }}
                >
                  {copied === value ? "Copied!" : "Copy"}
                </button>
              </div>
            ))}
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              Account name: <strong style={{ color: "var(--text-primary)" }}>{ACCOUNT_NAME}</strong>
            </p>
          </div>
        </Section>

        {/* Step 2: Upload proof */}
        <Section number={2} title="Upload payment proof">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Screenshot upload */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
                Payment screenshot *
              </label>
              <div
                className="upload-zone"
                onClick={() => screenshotRef.current?.click()}
                style={{ borderColor: screenshotFile ? "var(--brand-green)" : undefined }}
              >
                {screenshotPreview ? (
                  <img src={screenshotPreview} alt="Payment proof" style={{ maxHeight: 180, maxWidth: "100%", borderRadius: 8, objectFit: "contain" }} />
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: 28 }}>📷</p>
                    <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--text-secondary)" }}>Tap to upload screenshot</p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>JPG or PNG</p>
                  </>
                )}
              </div>
              <input ref={screenshotRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleScreenshot} />
            </div>

            {/* Payment method */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                Payment method
              </label>
              <select
                className="pay-input"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Transaction reference */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                Transaction reference <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional but recommended)</span>
              </label>
              <input
                className="pay-input"
                type="text"
                placeholder="e.g. TXN-123456789"
                value={txRef}
                onChange={e => setTxRef(e.target.value)}
              />
            </div>
          </div>
        </Section>

        {/* Step 3: Student ID (only for student plan) */}
        {isStudent && (
          <Section number={3} title="Student ID verification">
            <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--text-secondary)" }}>
              The student plan requires a valid student ID or enrollment letter.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
                  Student ID or enrollment letter *
                </label>
                <div className="upload-zone" onClick={() => studentIdRef.current?.click()} style={{ borderColor: studentIdFile ? "var(--brand-green)" : undefined }}>
                  {studentIdFile ? (
                    <p style={{ margin: 0, fontSize: 14, color: "var(--brand-green)", fontWeight: 600 }}>✓ {studentIdName}</p>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontSize: 28 }}>📄</p>
                      <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--text-secondary)" }}>Upload student ID</p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>JPG, PNG, or PDF</p>
                    </>
                  )}
                </div>
                <input ref={studentIdRef} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={handleStudentId} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Institution name
                </label>
                <input
                  className="pay-input"
                  type="text"
                  placeholder="e.g. Addis Ababa University"
                  value={institution}
                  onChange={e => setInstitution(e.target.value)}
                />
              </div>
            </div>
          </Section>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: "var(--destructive-bg, #fef2f2)", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "var(--destructive, #dc2626)", fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: "100%", padding: "15px 0", borderRadius: 12, border: "none",
            background: submitting ? "var(--border)" : "var(--brand-green)",
            color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 16,
            cursor: submitting ? "default" : "pointer", marginBottom: 32,
          }}
        >
          {submitting ? "Submitting…" : `Submit Payment — ${price} ETB`}
        </button>

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginBottom: 40 }}>
          Your subscription will be activated within 1–24 hours of payment verification.
        </p>
      </div>
    </div>
  );
}

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--brand-green)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
          {number}
        </div>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}
