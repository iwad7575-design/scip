import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { GoogleButton } from "../components/GoogleButton";

const PROFESSIONS = ["Doctor", "Nurse", "Public Health Officer", "Other"];

type StrengthLevel = 0 | 1 | 2;
function getStrength(pwd: string): { level: StrengthLevel; label: string; color: string } {
  if (pwd.length === 0) return { level: 0, label: "", color: "var(--border)" };
  if (pwd.length < 8)   return { level: 0, label: "Too short", color: "var(--destructive)" };
  const hasLetters = /[a-zA-Z]/.test(pwd);
  const hasNumbers = /[0-9\W]/.test(pwd);
  if (hasLetters && hasNumbers) return { level: 2, label: "Strong", color: "var(--success)" };
  return { level: 1, label: "Moderate", color: "var(--warning)" };
}

export function SignUpPage() {
  const navigate = useNavigate();
  const [refCode] = useState(
    () => new URLSearchParams(window.location.search).get("ref") || ""
  );

  useEffect(() => {
    if (refCode) localStorage.setItem("pendingRefCode", refCode);
  }, [refCode]);

  useEffect(() => {
    if (!refCode) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        localStorage.removeItem("pendingRefCode");
        navigate("/chat", { replace: true });
      }
    });
  }, [refCode, navigate]);

  const [fullName, setFullName]           = useState("");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [confirmPassword, setConfirm]     = useState("");
  const [profession, setProfession]       = useState("");
  const [facility, setFacility]           = useState("");
  const [error, setError]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [pwdFieldError, setPwdFieldError] = useState("");
  const [confirmError, setConfirmError]   = useState("");
  const [confirmBlurred, setConfirmBlurred] = useState(false);
  const [showPwd, setShowPwd]             = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const strength   = getStrength(password);
  const meets8     = password.length >= 8;
  const hasMix     = /[a-zA-Z]/.test(password) && /[0-9\W]/.test(password);
  const pwdMatch   = confirmPassword.length > 0 && password === confirmPassword;
  const pwdMismatch= confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setPwdFieldError(""); setConfirmError("");
    if (password.length < 8) { setPwdFieldError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setConfirmError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { full_name: fullName, profession, health_facility: facility },
        },
      });
      if (error) {
        setError(friendlyError(error.message));
      } else if (data.user?.identities?.length === 0) {
        // Supabase returns success with empty identities when email is already registered
        setError("This email is already registered.");
      } else {
        const pendingRef = localStorage.getItem("pendingRefCode");
        localStorage.setItem("showWelcome", "true");
        localStorage.setItem("wasReferred", pendingRef ? "true" : "false");
        setConfirmedEmail(email);
      }
    } finally { setLoading(false); }
  }

  async function handleResend() {
    if (resendCooldown > 0 || !confirmedEmail) return;
    setResendLoading(true); setResendMessage("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup", email: confirmedEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setResendMessage(error.message);
      else { setResendMessage("Confirmation email resent! Check your inbox."); setResendCooldown(60); }
    } finally { setResendLoading(false); }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  // ── Email confirmation screen ──────────────────────────────────────────────
  if (confirmedEmail) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "24px 16px" }}>
        <div style={{ width: "100%", maxWidth: 420, background: "var(--surface)", borderRadius: "var(--radius-2xl)", boxShadow: "var(--shadow-lg)", padding: "40px 32px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--brand-navy-100)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--brand-navy-700)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
            Check your email
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 4px" }}>We sent a confirmation link to</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--brand-navy-700)", margin: "0 0 16px" }}>{confirmedEmail}</p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 24px" }}>
            Click the link in the email to activate your SCIP account.
            <br /><span style={{ fontSize: 12, color: "var(--text-muted)" }}>The link expires in 24 hours.</span>
          </p>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
              Didn't receive it? Check your spam folder or
            </p>
            {resendMessage && (
              <p style={{ fontSize: 13, marginBottom: 10, fontWeight: 500, color: resendMessage.startsWith("Confirmation") ? "var(--success)" : "var(--destructive)" }}>
                {resendMessage}
              </p>
            )}
            <button onClick={handleResend} disabled={resendCooldown > 0 || resendLoading}
              style={{ fontSize: 14, fontWeight: 600, color: "var(--brand-navy-700)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", opacity: resendCooldown > 0 || resendLoading ? 0.5 : 1, padding: 0 }}>
              {resendLoading ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend confirmation email"}
            </button>
          </div>
          <Link to="/login" style={{ display: "block", marginTop: 16, fontSize: 14, color: "var(--text-muted)", textDecoration: "none" }}>
            Already confirmed? <span style={{ color: "var(--brand-navy-700)", fontWeight: 600 }}>Sign in</span>
          </Link>
        </div>
      </div>
    );
  }

  // ── Sign up form ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", display: "flex", background: "var(--bg)" }}>

      {/* ── Left branding panel (desktop only) ────────────────────────────── */}
      <div className="hidden md:flex" style={{
        width: 420, flexShrink: 0, flexDirection: "column", justifyContent: "space-between",
        background: "linear-gradient(160deg, #0B2545 0%, #1B3A6B 100%)",
        padding: "48px 40px", position: "relative", overflow: "hidden",
      }}>
        <div className="dot-grid" style={{ position: "absolute", inset: 0, opacity: 0.7 }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
            <img src="/logo.jpg" alt="SCIP" style={{ width: 36, height: 36, borderRadius: 8 }} />
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 700, color: "#fff" }}>SCIP</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 700, color: "#fff", lineHeight: 1.25, marginBottom: 14 }}>
            Join 500+ clinicians<br />across Ethiopia
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 36 }}>
            Create your free account and get instant access to 109 validated medical guidelines.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {["Free to join — no credit card required", "Covers 16+ clinical specialties", "Works offline after first load", "Used by doctors, nurses & health officers"].map(f => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--brand-green)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ background: "rgba(255,255,255,0.07)", borderLeft: "3px solid var(--brand-green)", borderRadius: "0 8px 8px 0", padding: "14px 16px" }}>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0, fontStyle: "italic", lineHeight: 1.6 }}>
              "The most useful clinical tool I've ever used in the field."
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 8, fontWeight: 600 }}>— Dr. K.M., Nurse, SNNPR</p>
          </div>
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: 420 }}>

          <div className="md:hidden" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <img src="/logo.jpg" alt="SCIP" style={{ width: 32, height: 32, borderRadius: 6 }} />
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 700, color: "var(--brand-navy)" }}>SCIP</span>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>Create your account</h2>
            <p style={{ fontSize: 15, color: "var(--text-secondary)", margin: 0 }}>Ethiopia's clinical intelligence platform</p>
          </div>

          {refCode && (
            <div style={{
              background: "var(--success-bg)", border: "1px solid #bbf7d0",
              borderRadius: "var(--radius-lg)", padding: "12px 16px",
              textAlign: "center", marginBottom: 8,
            }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--success)" }}>
                🎁 You were invited to SCIP! Sign up to get <strong>10 free questions</strong>
              </p>
            </div>
          )}

          <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            <FormField label="Full name">
              <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Dr. Abebe Tadesse" className="input" autoComplete="name" />
            </FormField>

            <FormField label="Email address">
              <input type="email" required autoComplete="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="input" />
            </FormField>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", fontFamily: "var(--font-heading)" }}>Password</label>
              <div style={{ position: "relative" }}>
                <input type={showPwd ? "text" : "password"} required autoComplete="new-password"
                  value={password} onChange={e => { setPassword(e.target.value); setPwdFieldError(""); }}
                  placeholder="At least 8 characters" className={`input${pwdFieldError ? " error" : ""}`}
                  style={{ paddingRight: 44 }} />
                <EyeToggle show={showPwd} onToggle={() => setShowPwd(v => !v)} />
              </div>
              {password.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 6 }}>
                    {[0, 1, 2, 3].map(i => {
                      const filled = strength.level === 0 ? i === 0 : strength.level === 1 ? i < 2 : true;
                      return <div key={i} style={{ height: 3, flex: 1, borderRadius: 9, background: filled ? strength.color : "var(--border)", transition: "background 0.2s" }} />;
                    })}
                    <span style={{ fontSize: 12, fontWeight: 600, color: strength.color, minWidth: 52 }}>{strength.label}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <Req met={meets8} text="At least 8 characters" />
                    <Req met={hasMix}  text="Letters and numbers" />
                  </div>
                </div>
              )}
              {pwdFieldError && <p style={{ fontSize: 12, color: "var(--destructive)", margin: "2px 0 0" }}>{pwdFieldError}</p>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", fontFamily: "var(--font-heading)" }}>Confirm password</label>
              <div style={{ position: "relative" }}>
                <input type={showConfirm ? "text" : "password"} required autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => { setConfirm(e.target.value); setConfirmError(""); }}
                  onBlur={() => { setConfirmBlurred(true); if (confirmPassword.length > 0 && password !== confirmPassword) setConfirmError("Passwords do not match."); }}
                  placeholder="Re-enter your password"
                  className="input"
                  style={{ paddingRight: pwdMatch ? 72 : 44, borderColor: pwdMatch ? "var(--success)" : pwdMismatch ? "var(--destructive)" : undefined }} />
                {pwdMatch && (
                  <div style={{ position: "absolute", right: 40, top: "50%", transform: "translateY(-50%)", color: "var(--success)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                )}
                <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
              </div>
              {confirmError && (confirmBlurred || confirmPassword.length > 0) && (
                <p style={{ fontSize: 12, color: "var(--destructive)", margin: "2px 0 0" }}>{confirmError}</p>
              )}
            </div>

            <FormField label="Profession">
              <select required value={profession} onChange={e => setProfession(e.target.value)} className="input">
                <option value="" disabled>Select your profession</option>
                {PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </FormField>

            <FormField label="Health facility">
              <input type="text" required value={facility}
                onChange={e => setFacility(e.target.value)}
                placeholder="e.g. Tikur Anbessa Specialized Hospital" className="input" />
            </FormField>

            {error && (
              <div style={{ background: "var(--destructive-bg)", border: "1px solid #fecaca", borderRadius: "var(--radius-lg)", padding: "12px 14px", fontSize: 14, color: "var(--destructive)" }}>
                {error}
                {error.includes("already registered") && (
                  <> — <Link to="/login" style={{ fontWeight: 600, color: "var(--destructive)" }}>Sign in instead</Link></>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 4 }}>
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Spinner /> Creating account…
                </span>
              ) : "Create My SCIP Account"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <GoogleButton onClick={handleGoogle} label="Continue with Google" />

          <p style={{ marginTop: 20, textAlign: "center", fontSize: 14, color: "var(--text-secondary)" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "var(--brand-navy-700)", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", fontFamily: "var(--font-heading)" }}>{label}</label>
      {children}
    </div>
  );
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} tabIndex={-1} aria-label={show ? "Hide password" : "Show password"}
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

function friendlyError(msg: string): string {
  if (msg.includes("already registered") || msg.includes("User already registered")) return "This email is already registered.";
  if (msg.includes("Password should be at least")) return "Password must be at least 8 characters.";
  if (msg.includes("Unable to validate email")) return "Please enter a valid email address.";
  return msg;
}
