import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type PageState = "loading" | "form" | "expired" | "success";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pageState, setPageState]         = useState<PageState>("loading");
  const passwordUpdated                   = useRef(false);
  const [newPassword, setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew]             = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [error, setError]                 = useState("");
  const [loading, setLoading]             = useState(false);

  useEffect(() => {
    let resolved = false;
    const cleanupRef: { subscription?: { unsubscribe(): void }; fallback?: ReturnType<typeof setTimeout> } = {};

    function ready()   { if (resolved) return; resolved = true; setPageState("form"); }
    function expired() { if (resolved) return; resolved = true; setPageState("expired"); }

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error }) => { if (error) expired(); else ready(); });
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (resolved) return;
      if (session) { ready(); return; }
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") ready();
      });
      const fallback = setTimeout(() => { subscription.unsubscribe(); expired(); }, 5000);
      cleanupRef.subscription = subscription;
      cleanupRef.fallback = fallback;
    });

    return () => {
      cleanupRef.subscription?.unsubscribe();
      if (cleanupRef.fallback !== undefined) clearTimeout(cleanupRef.fallback);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) { setPageState("expired"); return; }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        const msg = updateError.message.toLowerCase();
        const isSessionError = msg.includes("expired") || msg.includes("auth session missing") || msg.includes("refresh token not found") || msg.includes("user not found") || (msg.includes("invalid") && (msg.includes("token") || msg.includes("jwt") || msg.includes("session")));
        if (isSessionError) setPageState("expired");
        else setError(updateError.message);
      } else {
        passwordUpdated.current = true;
        setPageState("success");
        setTimeout(async () => {
          await supabase.auth.signOut();
          window.location.replace("/login?reset=success");
        }, 1500);
      }
    } finally { setLoading(false); }
  }

  const meets8 = newPassword.length >= 8;
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (pageState === "loading" && !passwordUpdated.current) {
    return (
      <CenteredShell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--brand-navy-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-navy-700)" strokeWidth={2} style={{ animation: "spin 1s linear infinite" }}>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <path strokeLinecap="round" d="M12 2a10 10 0 010 20" opacity={0.3} />
              <path strokeLinecap="round" d="M12 2a10 10 0 0110 10" />
            </svg>
          </div>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>Verifying your reset link…</p>
        </div>
      </CenteredShell>
    );
  }

  // ── Expired ────────────────────────────────────────────────────────────────
  if (pageState === "expired" && !passwordUpdated.current) {
    return (
      <AuthShell>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--destructive-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--destructive)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 10px" }}>
            Reset link expired
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 28px" }}>
            This link has expired or is no longer valid.<br />Please request a new one.
          </p>
          <Link to="/forgot-password" className="btn-primary" style={{ display: "block", textAlign: "center", textDecoration: "none", marginBottom: 16 }}>
            Request new reset link
          </Link>
          <Link to="/login" style={{ fontSize: 14, color: "var(--text-muted)", textDecoration: "none" }}>
            Back to Login
          </Link>
        </div>
      </AuthShell>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (pageState === "success" || passwordUpdated.current) {
    return (
      <CenteredShell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--success-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>Password updated!</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>Redirecting to login…</p>
          </div>
        </div>
      </CenteredShell>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <AuthShell>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <img src="/logo.jpg" alt="SCIP" style={{ width: 32, height: 32, borderRadius: 6 }} />
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 700, color: "var(--brand-navy)" }}>SCIP</span>
      </div>

      <div style={{ marginBottom: 26 }}>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>
          Create new password
        </h2>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", margin: 0 }}>Choose a strong password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", fontFamily: "var(--font-heading)" }}>New password</label>
          <div style={{ position: "relative" }}>
            <input
              type={showNew ? "text" : "password"} required autoComplete="new-password"
              value={newPassword} onChange={e => { setNewPassword(e.target.value); setError(""); }}
              placeholder="New password" className="input" style={{ paddingRight: 44 }}
            />
            <EyeToggle show={showNew} onToggle={() => setShowNew(v => !v)} />
          </div>
          <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
            <Req met={meets8} text="At least 8 characters" />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", fontFamily: "var(--font-heading)" }}>Confirm new password</label>
          <div style={{ position: "relative" }}>
            <input
              type={showConfirm ? "text" : "password"} required autoComplete="new-password"
              value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError(""); }}
              placeholder="Confirm new password" className="input" style={{ paddingRight: 44 }}
            />
            <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
          </div>
          {confirmPassword && (
            <div style={{ marginTop: 4 }}>
              <Req met={passwordsMatch} text="Passwords match" />
            </div>
          )}
        </div>

        {error && (
          <div style={{ background: "var(--destructive-bg)", border: "1px solid #fecaca", borderRadius: "var(--radius-lg)", padding: "11px 14px", fontSize: 14, color: "var(--destructive)" }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading || !meets8} className="btn-primary">
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Spinner /> Updating…</span>
          ) : "Update Password"}
        </button>
      </form>
    </AuthShell>
  );
}

// ── Layout shells ──────────────────────────────────────────────────────────────

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--surface)", borderRadius: "var(--radius-2xl)", boxShadow: "var(--shadow-lg)", padding: "36px 32px" }}>
        {children}
      </div>
    </div>
  );
}

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      {children}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} tabIndex={-1} aria-label={show ? "Hide" : "Show"}
      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 4, borderRadius: 4 }}>
      {show ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
      )}
    </button>
  );
}

function Req({ met, text }: { met: boolean; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
      <div style={{ width: 14, height: 14, borderRadius: "50%", background: met ? "var(--success)" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {met && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
      </div>
      <span style={{ color: met ? "var(--success)" : "var(--text-muted)" }}>{text}</span>
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
