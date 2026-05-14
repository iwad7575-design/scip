import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase, initialAuthType, initialAccessToken, initialRefreshToken } from "../lib/supabase";

type Status = "loading" | "success" | "error";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    console.log("=== AUTH CALLBACK LOADED ===");
    console.log("Full URL:", window.location.href);
    console.log("Hash:", window.location.hash || "(empty)");
    console.log("Search:", window.location.search || "(empty)");
    console.log("initialAuthType:", initialAuthType);
    console.log("hasInitialAccessToken:", !!initialAccessToken);
    console.log("hasInitialRefreshToken:", !!initialRefreshToken);
    const _dbgSearchParams = new URLSearchParams(window.location.search);
    console.log("code param:", _dbgSearchParams.get("code") ? `present (len ${_dbgSearchParams.get("code")!.length})` : "absent");
    console.log("error param:", _dbgSearchParams.get("error") ?? "absent");

    let done = false;

    function goTo(path: string) {
      if (done) return;
      done = true;
      navigate(path, { replace: true });
    }
    function markSuccess() {
      if (done) return;
      done = true;
      setStatus("success");
      setTimeout(() => navigate("/", { replace: true }), 2000);
    }
    function markError(msg: string) {
      if (done) return;
      done = true;
      setStatus("error");
      setErrorMessage(msg);
    }

    const searchParams = new URLSearchParams(window.location.search);

    // Supabase error (e.g. expired OTP link)
    const oauthError = searchParams.get("error");
    if (oauthError) {
      markError(searchParams.get("error_description") || oauthError);
      return;
    }

    // ── Hash flow ──────────────────────────────────────────────────────────────
    // initialAuthType/Token values were captured before Supabase cleared the hash.
    // Explicitly call setSession so the recovery session is fully established
    // before we navigate — relying on Supabase's auto-processing alone can leave
    // the token in a state where updateUser fails with "invalid/expired".
    if (initialAuthType === "recovery") {
      console.log("BRANCH: hash-based recovery detected");
      (async () => {
        if (initialAccessToken && initialRefreshToken) {
          console.log("Calling setSession with hash tokens...");
          const { data: ssData, error: ssError } = await supabase.auth.setSession({
            access_token: initialAccessToken,
            refresh_token: initialRefreshToken,
          });
          console.log("setSession result:", {
            hasSession: !!ssData?.session,
            userEmail: ssData?.session?.user?.email,
            expiresAt: ssData?.session?.expires_at,
            error: ssError?.message,
          });
          if (ssError) {
            markError("Your reset link has expired or is invalid. Please request a new one.");
            return;
          }
        } else {
          console.log("WARN: hash recovery but no tokens captured — relying on Supabase auto-processing");
        }
        goTo("/reset-password");
      })();
      return;
    }

    // ── PKCE code flow ─────────────────────────────────────────────────────────
    // After exchangeCodeForSession, Supabase fires PASSWORD_RECOVERY (recovery
    // codes) or SIGNED_IN (email confirmation, OAuth). Set up the listener
    // BEFORE calling exchange so the event is never missed.
    const code = searchParams.get("code");
    if (code) {
      console.log("BRANCH: PKCE code flow");
      let sub: { unsubscribe(): void } | null = null;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      sub = supabase.auth.onAuthStateChange((event, session) => {
        console.log("onAuthStateChange event:", event, "| hasSession:", !!session, "| userEmail:", session?.user?.email);
        if (event === "PASSWORD_RECOVERY") {
          console.log("→ PASSWORD_RECOVERY: navigating to /reset-password");
          sub?.unsubscribe();
          if (timeout) clearTimeout(timeout);
          goTo("/reset-password");
        } else if (event === "SIGNED_IN") {
          console.log("→ SIGNED_IN: navigating to /");
          sub?.unsubscribe();
          if (timeout) clearTimeout(timeout);
          markSuccess();
        }
      }).data.subscription;

      console.log("Calling exchangeCodeForSession...");
      supabase.auth.exchangeCodeForSession(code).then(({ data: exchData, error }) => {
        console.log("exchangeCodeForSession result:", {
          hasSession: !!exchData?.session,
          userEmail: exchData?.session?.user?.email,
          expiresAt: exchData?.session?.expires_at,
          error: error?.message,
        });
        if (error) {
          sub?.unsubscribe();
          if (timeout) clearTimeout(timeout);
          markError(error.message);
        }
        // Navigation is handled by the onAuthStateChange listener above.
      });

      // Fallback: if the event never fires within 10s, check session directly.
      timeout = setTimeout(() => {
        sub?.unsubscribe();
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) markSuccess();
          else markError("Authentication failed or the link has expired. Please request a new link.");
        });
      }, 10000);

      return () => {
        sub?.unsubscribe();
        if (timeout) clearTimeout(timeout);
      };
    }

    // ── No code, no hash recovery — hash-based email confirmation or OAuth ─────
    // Supabase has auto-processed the tokens; wait for the SIGNED_IN event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) markSuccess();
    });

    const fallback = setTimeout(async () => {
      subscription.unsubscribe();
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
