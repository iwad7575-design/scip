import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ScipLogo } from "../components/ScipLogo";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email address."); return; }
    setError("");
    setLoading(true);
    try {
      // Always show the confirmation screen regardless of whether the email
      // exists — this is a security best practice (prevents email enumeration).
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <ScipLogo className="mb-8" />
          <div className="bg-white rounded-2xl shadow-sm px-8 py-10 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl"
              style={{ background: "rgba(27,58,107,0.08)" }}
            >
              📧
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "#1B3A6B" }}>
              Check your email
            </h2>
            <p className="text-sm text-slate-500 mb-1 leading-relaxed">
              If an account exists for
            </p>
            <p className="text-sm font-semibold mb-4" style={{ color: "#1B3A6B" }}>
              {email}
            </p>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              you will receive a password reset link shortly.
              <br />
              Click the link in the email to create a new password.
              <br />
              <span className="text-xs text-slate-400 block mt-2">The link expires in 1 hour.</span>
            </p>

            <p className="text-xs text-slate-400 mb-5">
              Didn't receive it? Check your spam folder.
            </p>

            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: "#1B3A6B" }}
            >
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <ScipLogo className="mb-8" />

        <div className="bg-white rounded-2xl shadow-sm px-8 py-8">
          <h2 className="text-2xl font-bold mb-1" style={{ color: "#1B3A6B" }}>
            Reset your password
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Enter your email address and we will send you a link to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Email address</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="your@email.com"
                className="input"
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 mt-1"
              style={{ backgroundColor: "#1B3A6B" }}
            >
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link
              to="/login"
              className="text-sm font-medium"
              style={{ color: "#1B3A6B" }}
            >
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
