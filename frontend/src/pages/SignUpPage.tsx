import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ScipLogo } from "../components/ScipLogo";
import { GoogleButton } from "../components/GoogleButton";
import { Divider } from "../components/Divider";

const PROFESSIONS = ["Doctor", "Nurse", "Public Health Officer", "Other"];

export function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profession, setProfession] = useState("");
  const [facility, setFacility] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Post-signup confirmation state
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
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
            <p className="text-sm font-semibold mb-5" style={{ color: "#1B3A6B" }}>
              {confirmedEmail}
            </p>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Click the link in the email to activate your SCIP account and start
              asking clinical questions.
              <br />
              <span className="text-xs text-slate-400 mt-1 block">The link expires in 24 hours.</span>
            </p>

            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs text-slate-400 mb-3">
                Didn't receive the email? Check your spam folder or
              </p>

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
                {resendLoading
                  ? "Sending…"
                  : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s…`
                  : "Resend confirmation email"}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-4">
            Already confirmed?{" "}
            <Link to="/login" className="underline" style={{ color: "#1B3A6B" }}>
              Sign in
            </Link>
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

            <Field label="Password">
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="input"
              />
            </Field>

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

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
                {error.includes("already registered") && (
                  <span>
                    {" "}<Link to="/login" className="underline font-semibold">Sign in instead</Link>
                  </span>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function friendlyError(msg: string): string {
  if (msg.includes("already registered") || msg.includes("User already registered"))
    return "This email is already registered. Please login instead.";
  if (msg.includes("Password should be at least"))
    return "Password must be at least 6 characters.";
  if (msg.includes("Unable to validate email"))
    return "Please enter a valid email address.";
  return msg;
}
