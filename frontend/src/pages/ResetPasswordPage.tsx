import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ScipLogo } from "../components/ScipLogo";

type PageState = "loading" | "form" | "expired" | "success";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("loading");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let resolved = false;

    function ready() {
      if (resolved) return;
      resolved = true;
      setPageState("form");
    }
    function expired() {
      if (resolved) return;
      resolved = true;
      setPageState("expired");
    }

    const params = new URLSearchParams(window.location.search);

    // PKCE code flow
    const code = params.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error }) => { if (error) expired(); else ready(); });
      return;
    }

    // Hash / implicit flow — Supabase auto-detects tokens and fires
    // PASSWORD_RECOVERY (or SIGNED_IN for some configs).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") ready();
    });

    // Fallback: if no event fires within 5s, check for an existing session.
    const fallback = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) ready(); else expired();
    }, 5000);

    return () => { subscription.unsubscribe(); clearTimeout(fallback); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("expired") || msg.includes("invalid") || msg.includes("same password")) {
          setPageState("expired");
        } else {
          setError(error.message);
        }
      } else {
        setPageState("success");
        setTimeout(() => {
          navigate("/login", {
            state: { successMessage: "Password updated. Please log in with your new password." },
            replace: true,
          });
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  }

  const meets8 = newPassword.length >= 8;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-sm text-slate-500">Verifying your reset link…</p>
        </div>
      </div>
    );
  }

  // ── Expired / invalid link ─────────────────────────────────────────────────
  if (pageState === "expired") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <ScipLogo className="mb-8" />
          <div className="bg-white rounded-2xl shadow-sm px-8 py-10 text-center">
            <div className="text-4xl mb-4">🔗</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "#1B3A6B" }}>
              Reset link expired
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              This reset link has expired or is no longer valid.
              <br />
              Please request a new one.
            </p>
            <Link
              to="/forgot-password"
              className="inline-block w-full py-2.5 rounded-lg text-sm font-semibold text-white text-center"
              style={{ backgroundColor: "#1B3A6B" }}
            >
              Request new reset link
            </Link>
            <div className="mt-4">
              <Link to="/login" className="text-sm" style={{ color: "#1B3A6B" }}>
                ← Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (pageState === "success") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-xl font-bold mb-1" style={{ color: "#1B3A6B" }}>
            Password updated successfully!
          </h2>
          <p className="text-sm text-slate-500">Redirecting to login…</p>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <ScipLogo className="mb-8" />

        <div className="bg-white rounded-2xl shadow-sm px-8 py-8">
          <h2 className="text-2xl font-bold mb-1" style={{ color: "#1B3A6B" }}>
            Create new password
          </h2>
          <p className="text-sm text-slate-500 mb-6">Enter your new password below.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* New password */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">New password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                  placeholder="New password"
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {/* Requirements */}
              <div className="mt-1.5 flex flex-col gap-1">
                <Req met={meets8} text="At least 8 characters" />
              </div>
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Confirm new password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                  placeholder="Confirm new password"
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {confirmPassword && (
                <div className="mt-1.5">
                  <Req met={newPassword === confirmPassword && confirmPassword.length > 0} text="Passwords match" />
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !meets8}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 mt-1"
              style={{ backgroundColor: "#1B3A6B" }}
            >
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>
        </div>
      </div>
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

function Eye() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}
