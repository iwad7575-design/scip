import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ScipLogo } from "../components/ScipLogo";
import { GoogleButton } from "../components/GoogleButton";
import { Divider } from "../components/Divider";

const PROFESSIONS = ["Doctor", "Nurse", "Public Health Officer", "Other"];

// ── Password strength ───────────────────────────────────────────────────────
type StrengthLevel = 0 | 1 | 2; // 0=too short, 1=weak, 2=strong

function getStrength(pwd: string): { level: StrengthLevel; label: string; color: string } {
  if (pwd.length === 0) return { level: 0, label: "", color: "#e2e8f0" };
  if (pwd.length < 8)    return { level: 0, label: "Too short", color: "#ef4444" };
  const hasLetters = /[a-zA-Z]/.test(pwd);
  const hasNumbers = /[0-9\W]/.test(pwd);
  if (hasLetters && hasNumbers) return { level: 2, label: "Strong", color: "#22c55e" };
  return { level: 1, label: "Weak", color: "#f59e0b" };
}

// ── Main component ──────────────────────────────────────────────────────────
export function SignUpPage() {
  const [fullName, setFullName]       = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [profession, setProfession]   = useState("");
  const [facility, setFacility]       = useState("");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);

  // Per-field validation
  const [pwdFieldError, setPwdFieldError]         = useState("");
  const [confirmFieldError, setConfirmFieldError] = useState("");
  const [confirmBlurred, setConfirmBlurred]       = useState(false);

  // Show/hide toggles
  const [showPwd, setShowPwd]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Post-signup confirmation state
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [resendMessage, setResendMessage]   = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading]   = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ── Derived state ────────────────────────────────────────────────────────
  const strength  = getStrength(password);
  const meets8    = password.length >= 8;
  const hasMix    = /[a-zA-Z]/.test(password) && /[0-9\W]/.test(password);
  const pwdMatch  = confirmPassword.length > 0 && password === confirmPassword;
  const pwdMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPwdFieldError("");
    setConfirmFieldError("");

    if (password.length < 8) {
      setPwdFieldError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setConfirmFieldError("Passwords do not match. Please try again.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { full_name: fullName, profession, health_facility: facility },
        },
      });
      if (error) {
        setError(friendlyError(error.message));
      } else {
        setConfirmedEmail(email);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || !confirmedEmail) return;
    setResendLoading(true);
    setResendMessage("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: confirmedEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setResendMessage(error.message);
      } else {
        setResendMessage("Confirmation email resent! Please check your inbox.");
        setResendCooldown(60);
      }
    } finally {
      setResendLoading(false);
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  // ── Confirmation screen ──────────────────────────────────────────────────
  if (confirmedEmail) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <ScipLogo className="mb-8" />
          <div className="bg-white rounded-2xl shadow-sm px-8 py-10 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl"
              style={{ background: "rgba(27,58,107,0.08)" }}
            >
              ✉️
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "#1B3A6B" }}>
              Check your email
            </h2>
            <p className="text-sm text-slate-500 mb-1">We sent a confirmation link to:</p>
            <p className="text-sm font-semibold mb-5" style={{ color: "#1B3A6B" }}>{confirmedEmail}</p>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Click the link in the email to activate your SCIP account and start
              asking clinical questions.
              <br />
              <span className="text-xs text-slate-400 mt-1 block">The link expires in 24 hours.</span>
            </p>
            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs text-slate-400 mb-3">Didn't receive the email? Check your spam folder or</p>
              {resendMessage && (
                <p className={`text-xs mb-3 font-medium ${resendMessage.startsWith("Confirmation email resent") ? "text-emerald-600" : "text-red-500"}`}>
                  {resendMessage}
                </p>
              )}
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0 || resendLoading}
                className="text-sm font-semibold underline disabled:no-underline disabled:opacity-50 transition-opacity"
                style={{ color: "#1B3A6B" }}
              >
                {resendLoading ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s…` : "Resend confirmation email"}
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-slate-400 mt-4">
            Already confirmed?{" "}
            <Link to="/login" className="underline" style={{ color: "#1B3A6B" }}>Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Signup form ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <ScipLogo className="mb-8" />

        <div className="bg-white rounded-2xl shadow-sm px-8 py-8">
          <h2 className="text-2xl font-bold mb-1" style={{ color: "#1B3A6B" }}>
            Create your account
          </h2>
          <p className="text-sm text-slate-500 mb-6">Join SCIP — Ethiopia's clinical intelligence platform</p>

          <form onSubmit={handleSignUp} className="flex flex-col gap-4">

            {/* 1. Full name */}
            <Field label="Full name">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Abebe Tadesse"
                className="input"
              />
            </Field>

            {/* 2. Email */}
            <Field label="Email address">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
              />
            </Field>

            {/* 3. Password with eye toggle + strength bar */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPwdFieldError(""); }}
                  placeholder="At least 8 characters"
                  className="input pr-10"
                  style={pwdFieldError ? { borderColor: "#ef4444" } : {}}
                />
                <EyeToggle show={showPwd} onToggle={() => setShowPwd(v => !v)} />
              </div>

              {/* Strength bar — only shown when user has typed something */}
              {password.length > 0 && (
                <div className="mt-1.5">
                  <div className="flex gap-1 mb-1.5">
                    {[0, 1, 2, 3].map(i => {
                      const filled =
                        strength.level === 0 ? i === 0 :
                        strength.level === 1 ? i < 2 :
                        true;
                      return (
                        <div
                          key={i}
                          className="h-1.5 flex-1 rounded-full transition-all"
                          style={{ background: filled ? strength.color : "#e2e8f0" }}
                        />
                      );
                    })}
                    <span className="text-xs font-medium ml-1" style={{ color: strength.color, minWidth: 48 }}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Req met={meets8} text="At least 8 characters" />
                    <Req met={hasMix}  text="Contains letters and numbers" />
                  </div>
                </div>
              )}

              {pwdFieldError && (
                <p className="text-xs text-red-600 mt-0.5">{pwdFieldError}</p>
              )}
            </div>

            {/* 4. Confirm password */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirm(e.target.value); setConfirmFieldError(""); }}
                  onBlur={() => {
                    setConfirmBlurred(true);
                    if (confirmPassword.length > 0 && password !== confirmPassword) {
                      setConfirmFieldError("Passwords do not match.");
                    }
                  }}
                  placeholder="Re-enter your password"
                  className="input pr-10 transition-all"
                  style={{
                    borderColor: pwdMatch    ? "#22c55e" :
                                 pwdMismatch ? "#ef4444" :
                                 undefined,
                    outlineColor: pwdMatch   ? "#22c55e" : undefined,
                  }}
                />
                {/* Inline match icon */}
                {pwdMatch && (
                  <span className="absolute right-9 top-1/2 -translate-y-1/2 text-emerald-500 text-sm select-none">✅</span>
                )}
                <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
              </div>
              {(confirmFieldError && (confirmBlurred || confirmPassword.length > 0)) && (
                <p className="text-xs text-red-600 mt-0.5">{confirmFieldError}</p>
              )}
            </div>

            {/* 5. Profession */}
            <Field label="Profession">
              <select
                required
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                className="input"
              >
                <option value="" disabled>Select your profession</option>
                {PROFESSIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>

            {/* 6. Health facility */}
            <Field label="Health facility name">
              <input
                type="text"
                required
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
                placeholder="e.g. Tikur Anbessa Specialized Hospital"
                className="input"
              />
            </Field>

            {/* Generic API errors */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
                {error.includes("already registered") && (
                  <span>{" "}<Link to="/login" className="underline font-semibold">Sign in instead</Link></span>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 mt-1"
              style={{ backgroundColor: "#1B3A6B" }}
            >
              {loading ? "Creating account…" : "Create My SCIP Account"}
            </button>
          </form>

          <Divider />
          <GoogleButton onClick={handleGoogle} label="Continue with Google" />

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold hover:underline" style={{ color: "#1B3A6B" }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Helper components ───────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function Req({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span>{met ? "✅" : "⚪"}</span>
      <span style={{ color: met ? "#059669" : "#94a3b8" }}>{text}</span>
    </div>
  );
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      aria-label={show ? "Hide password" : "Show password"}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
    >
      {show ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );
}

function friendlyError(msg: string): string {
  if (msg.includes("already registered") || msg.includes("User already registered"))
    return "This email is already registered. Please login instead.";
  if (msg.includes("Password should be at least"))
    return "Password must be at least 8 characters.";
  if (msg.includes("Unable to validate email"))
    return "Please enter a valid email address.";
  return msg;
}
