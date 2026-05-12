import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Status = "loading" | "success" | "error";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let redirected = false;

    function markSuccess() {
      if (redirected) return;
      redirected = true;
      setStatus("success");
      setTimeout(() => navigate("/", { replace: true }), 2000);
    }

    function markError(msg: string) {
      if (redirected) return;
      redirected = true;
      setStatus("error");
      setErrorMessage(msg);
    }

    const params = new URLSearchParams(window.location.search);

    // Check for error from Supabase redirect
    const oauthError = params.get("error");
    if (oauthError) {
      markError(params.get("error_description") || oauthError);
      return;
    }

    // PKCE code flow (newer Supabase default)
    const code = params.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) markError(error.message);
        else markSuccess();
      });
      return;
    }

    // Hash/implicit flow — Supabase auto-detects tokens in the URL hash.
    // Listen for the SIGNED_IN event, with a 5-second fallback.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) markSuccess();
    });

    const fallback = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) markSuccess();
      else markError("Email confirmation failed or the link has expired. Please request a new confirmation email.");
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
    };
  }, [navigate]);

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0B2545",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
    }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        {status === "loading" && (
          <>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⏳</div>
            <h2 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Verifying your email…
            </h2>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.875rem" }}>
              This will only take a moment.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>✅</div>
            <h2 style={{ color: "#2ECC71", fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Email confirmed!
            </h2>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.9rem" }}>
              Welcome to SCIP. Redirecting you now…
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>❌</div>
            <h2 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.75rem" }}>
              Confirmation failed
            </h2>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              {errorMessage}
            </p>
            <Link
              to="/signup"
              style={{
                display: "inline-block",
                background: "#2ECC71",
                color: "#fff",
                padding: "0.75rem 1.5rem",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: "0.9rem",
                textDecoration: "none",
              }}
            >
              Back to Sign Up
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
