import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { GoogleButton } from "../components/GoogleButton";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [successBanner, setSuccessBanner] = useState(
    (location.state as { successMessage?: string } | null)?.successMessage ?? ""
  );
  const [resendMessage, setResendMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "success") {
      setSuccessBanner("Password updated successfully! Please log in with your new password.");
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setUnconfirmed(false); setResendMessage("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
          setUnconfirmed(true);
          setError("Please confirm your email before logging in.");
        } else {
          setError(friendlyError(error.message));
        }
      } else {
        navigate("/chat");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || !email) return;
    setResendLoading(true); setResendMessage("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup", email,
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

  return (
    <div style={{ minHeight: "100dvh", display: "flex", background: "var(--bg)" }}>

      {/* ── Left branding panel (desktop only) ──────────────────────────── */}
      <div
        className="hidden md:flex"
        style={{
          width: 420,
          flexShrink: 0,
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(160deg, #0B2545 0%, #1B3A6B 100%)",
          padding: "48px 40px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Dot grid texture */}
        <div className="dot-grid" style={{ position: "absolute", inset: 0, opacity: 0.7 }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
            <img src="/logo.png" alt="SCIP" style={{ width: 36, height: 36, objectFit: "contain" }} />
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 700, color: "#ffffff" }}>SCIP</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 30, fontWeight: 700, color: "#ffffff", lineHeight: 1.2, marginBottom: 16 }}>
            Clinical intelligence<br />at your fingertips
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, marginBottom: 40 }}>
            Instant answers from 106 validated Ethiopian and international medical guidelines.
          </p>

          {/* Trust stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { icon: "📚", label: "106 Guidelines", sub: "MoH & WHO validated" },
              { icon: "⚕️", label: "16+ Specialties", sub: "Full clinical breadth" },
              { icon: "🇪🇹", label: "Ethiopian First", sub: "Built for frontline care" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "rgba(255,255,255,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0,
                }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-heading)", fontSize: 14, fontWeight: 600, color: "#ffffff" }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            background: "rgba(255,255,255,0.07)",
            borderLeft: "3px solid var(--brand-green)",
            borderRadius: "0 8px 8px 0",
            padding: "14px 16px",
          }}>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
              "SCIP helps me make faster, safer decisions for my patients — even in our resource-limited setting."
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 8, fontWeight: 600 }}>
              — Dr. A.T., Health Officer, Oromia
            </p>
          </div>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        overflowY: "auto",
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>

          {/* Mobile logo */}
          <div className="md:hidden" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
            <img src="/logo.png" alt="SCIP" style={{ width: 32, height: 32 }} />
            <span style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 700, color: "var(--brand-navy)" }}>SCIP</span>
          </div>

          {successBanner && (
            <div style={{
              marginBottom: 20,
              background: "var(--success-bg)",
              border: "1px solid #bbf7d0",
              borderRadius: "var(--radius-lg)",
              padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 10,
              fontSize: 14, color: "var(--success)", fontWeight: 500,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              {successBanner}
            </div>
          )}

          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 26, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px" }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 15, color: "var(--text-secondary)", margin: 0 }}>
              Sign in to your SCIP account
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <FormField label="Email address">
              <input
                type="email" required autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setUnconfirmed(false); setError(""); }}
                placeholder="you@example.com"
                className="input"
              />
            </FormField>

            <FormField label="Password">
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"} required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input"
                  style={{ paddingRight: 44 }}
                />
                <EyeToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                <Link to="/forgot-password" style={{ fontSize: 13, color: "var(--brand-navy-700)", fontWeight: 500, textDecoration: "none" }}>
                  Forgot password?
                </Link>
              </div>
            </FormField>

            {error && (
              <div style={{
                background: unconfirmed ? "var(--warning-bg)" : "var(--destructive-bg)",
                border: `1px solid ${unconfirmed ? "#fde68a" : "#fecaca"}`,
                borderRadius: "var(--radius-lg)",
                padding: "12px 14px",
                fontSize: 14,
                color: unconfirmed ? "#92400e" : "var(--destructive)",
              }}>
                <p style={{ margin: 0 }}>{error}</p>
                {unconfirmed && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #fde68a" }}>
                    {resendMessage && (
                      <p style={{ fontSize: 13, marginBottom: 6, fontWeight: 500, color: resendMessage.startsWith("Confirmation") ? "var(--success)" : "var(--destructive)" }}>
                        {resendMessage}
                      </p>
                    )}
                    <button type="button" onClick={handleResend} disabled={resendCooldown > 0 || resendLoading}
                      style={{ fontSize: 13, fontWeight: 600, color: "var(--brand-navy)", background: "none", border: "none", cursor: "pointer", textDecoration: resendCooldown > 0 ? "none" : "underline", opacity: resendCooldown > 0 || resendLoading ? 0.5 : 1, padding: 0 }}>
                      {resendLoading ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend confirmation email"}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 4 }}>
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Spinner /> Signing in…
                </span>
              ) : "Sign in to SCIP"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>or continue with</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <GoogleButton onClick={handleGoogle} label="Continue with Google" />

          <p style={{ marginTop: 24, textAlign: "center", fontSize: 14, color: "var(--text-secondary)" }}>
            New to SCIP?{" "}
            <Link to="/signup" style={{ color: "var(--brand-navy-700)", fontWeight: 600, textDecoration: "none" }}>
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", fontFamily: "var(--font-heading)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} tabIndex={-1}
      aria-label={show ? "Hide password" : "Show password"}
      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", padding: 4, borderRadius: 4 }}>
      {show ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
      style={{ animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path strokeLinecap="round" d="M12 2a10 10 0 010 20" opacity={0.3} />
      <path strokeLinecap="round" d="M12 2a10 10 0 0110 10" />
    </svg>
  );
}

function friendlyError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "Incorrect email or password. Please try again.";
  if (msg.includes("Too many requests")) return "Too many attempts. Please wait a moment and try again.";
  return msg;
}
