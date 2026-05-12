import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ScipLogo } from "../components/ScipLogo";
import { GoogleButton } from "../components/GoogleButton";
import { Divider } from "../components/Divider";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const successBanner = (location.state as { successMessage?: string } | null)?.successMessage ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);

  // Resend confirmation state
  const [resendMessage, setResendMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setUnconfirmed(false);
    setResendMessage("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const isUnconfirmed = error.message.toLowerCase().includes("email not confirmed")
          || error.message.toLowerCase().includes("not confirmed");
        if (isUnconfirmed) {
          setUnconfirmed(true);
          setError("Please confirm your email before logging in. Check your inbox for a confirmation link from SCIP.");
        } else {
          setError(friendlyError(error.message));
        }
      } else {
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || !email) return;
    setResendLoading(true);
    setResendMessage("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
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

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {successBanner && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium text-center">
            ✅ {successBanner}
          </div>
        )}
        <ScipLogo className="mb-8" />

        <div className="bg-white rounded-2xl shadow-sm px-8 py-8">
          <h2 className="text-2xl font-bold mb-1" style={{ color: "#1B3A6B" }}>
            Welcome back
          </h2>
          <p className="text-sm text-slate-500 mb-6">Sign in to your SCIP account</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Field label="Email address">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setUnconfirmed(false); setError(""); }}
                placeholder="you@example.com"
                className="input"
              />
            </Field>

            <Field label="Password">
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
              />
              <Link
                to="/forgot-password"
                className="mt-1 text-xs text-right w-full block text-right"
                style={{ color: "#1B3A6B" }}
              >
                Forgot password?
              </Link>
            </Field>

            {error && (
              <div className={`text-sm rounded-lg px-3 py-2.5 ${unconfirmed ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-600"}`}>
                <p>{error}</p>
                {unconfirmed && (
                  <div className="mt-2 pt-2 border-t border-amber-200">
                    {resendMessage && (
                      <p className={`text-xs mb-2 font-medium ${resendMessage.startsWith("Confirmation") ? "text-emerald-700" : "text-red-600"}`}>
                        {resendMessage}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendCooldown > 0 || resendLoading}
                      className="text-xs font-semibold underline disabled:no-underline disabled:opacity-50"
                      style={{ color: "#1B3A6B" }}
                    >
                      {resendLoading
                        ? "Sending…"
                        : resendCooldown > 0
                        ? `Resend in ${resendCooldown}s…`
                        : "Resend confirmation email"}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "#1B3A6B" }}
            >
              {loading ? "Signing in…" : "Login to SCIP"}
            </button>
          </form>

          <Divider />
          <GoogleButton onClick={handleGoogle} label="Continue with Google" />

          <p className="mt-6 text-center text-sm text-slate-500">
            New to SCIP?{" "}
            <Link to="/signup" className="font-semibold hover:underline" style={{ color: "#1B3A6B" }}>
              Create account
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
  if (msg.includes("Invalid login credentials")) return "Incorrect email or password.";
  if (msg.includes("Too many requests")) return "Too many attempts. Wait a moment and try again.";
  return msg;
}
