import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export function ForgotPasswordPage() {
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email address."); return; }
    setError(""); setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      setSubmitted(true);
    } finally { setLoading(false); }
  }

  if (submitted) {
    return (
      <AuthShell>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "var(--brand-navy-100)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brand-navy-700)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
            Check your inbox
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 4px" }}>If an account exists for</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--brand-navy-700)", margin: "0 0 14px" }}>{email}</p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 8px" }}>
            you will receive a password reset link shortly.
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 28px" }}>
            Didn't receive it? Check your spam folder. The link expires in 1 hour.
          </p>
          <Link to="/login" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "var(--brand-navy-700)", textDecoration: "none" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Back to Login
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <img src="/icon-192x192.png" alt="SCIP" style={{ width: 32, height: 32, borderRadius: 6 }} />
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 700, color: "var(--brand-navy)" }}>SCIP</span>
        </div>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>
          Reset your password
        </h2>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", margin: 0 }}>
          Enter your email and we'll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", fontFamily: "var(--font-heading)" }}>
            Email address
          </label>
          <input
            type="email" required autoComplete="email"
            value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
            placeholder="your@email.com" className="input"
          />
        </div>

        {error && (
          <div style={{ background: "var(--destructive-bg)", border: "1px solid #fecaca", borderRadius: "var(--radius-lg)", padding: "11px 14px", fontSize: 14, color: "var(--destructive)" }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Spinner /> Sending…</span>
          ) : "Send Reset Link"}
        </button>
      </form>

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <Link to="/login" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back to Login
        </Link>
      </div>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--surface)", borderRadius: "var(--radius-2xl)", boxShadow: "var(--shadow-lg)", padding: "36px 32px" }}>
        {children}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path strokeLinecap="round" d="M12 2a10 10 0 010 20" opacity={0.3} />
      <path strokeLinecap="round" d="M12 2a10 10 0 0110 10" />
    </svg>
  );
}
