import { useState } from "react";
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
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, profession, health_facility: facility },
        },
      });
      if (error) {
        setError(friendlyError(error.message));
      } else {
        setMessage("Account created! Check your email to confirm, then sign in.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  }

  if (message) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <ScipLogo className="mb-8" />
          <div className="bg-white rounded-2xl shadow-sm px-8 py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Check your email</h2>
            <p className="text-sm text-slate-500 mb-6">{message}</p>
            <Link
              to="/login"
              className="inline-block py-2.5 px-6 rounded-lg text-sm font-semibold text-white transition-opacity"
              style={{ backgroundColor: "#1B3A6B" }}
            >
              Go to Login
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

            {error && <p className="text-sm text-red-600">{error}</p>}

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
    return "An account with this email already exists. Try signing in instead.";
  if (msg.includes("Password should be at least"))
    return "Password must be at least 6 characters.";
  if (msg.includes("Unable to validate email"))
    return "Please enter a valid email address.";
  return msg;
}
