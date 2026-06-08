import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase, initialAuthType, initialAccessToken, initialRefreshToken } from "../lib/supabase";
import { BACKEND_URL } from "../lib/config";

type Status = "loading" | "success" | "error";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let done = false;

    console.log("[CALLBACK] Starting...");
    console.log("[CALLBACK] URL:", window.location.href);
    console.log("[CALLBACK] pendingRefCode:", localStorage.getItem("pendingRefCode"));

    async function applyPendingReferral(accessToken?: string | null, createdAt?: string | null) {
      console.log("[REFERRAL] Function called");
      console.log("[REFERRAL] Starting...");
      const pendingRef = localStorage.getItem("pendingRefCode");
      console.log("[REFERRAL] pendingRef:", pendingRef);
      if (!pendingRef) { console.log("[REFERRAL] No pending ref code"); return; }

      if (createdAt) {
        const ageMs = Date.now() - new Date(createdAt).getTime();
        const ageMinutes = ageMs / 1000 / 60;
        console.log("[REFERRAL] ageMinutes:", ageMinutes);
        if (ageMs > 10 * 60 * 1000) {
          console.log("[REFERRAL] Skipping - existing user (age > 10 min)");
          localStorage.removeItem("pendingRefCode");
          return;
        }
      }

      let token = accessToken;
      if (!token) {
        await new Promise(r => setTimeout(r, 800));
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token ?? null;
      }
      console.log("[REFERRAL] token present:", !!token);
      if (!token) { console.log("[REFERRAL] No token, aborting"); return; }
      try {
        console.log("[REFERRAL] Calling /referral/apply with:", pendingRef);
        const res = await fetch(`${BACKEND_URL}/referral/apply`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ ref_code: pendingRef }),
        });
        const result = await res.json().catch(() => ({}));
        console.log("[REFERRAL] Result:", res.status, result);
        localStorage.removeItem("pendingRefCode");
      } catch (e) { console.error("[REFERRAL] Error:", e); }
    }

    function createFreeSubscription(accessToken: string) {
      fetch(`${BACKEND_URL}/subscription/create-free`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      }).catch(() => { /* silent */ });
    }

    // Handles new-user welcome setup and referral in correct order:
    // 1. Apply referral (awaited) so pendingRefCode is still set when we read it
    // 2. Set showWelcome + wasReferred AFTER referral completes
    // 3. Navigate
    async function handleSignedIn(session: Session | null) {
      console.log("[CALLBACK] handleSignedIn: session present:", !!session, "user:", session?.user?.id);
      if (!session?.user?.created_at) {
        console.log("[WELCOME] No session or createdAt, skipping welcome");
        markSuccess();
        return;
      }
      const ageMs = Date.now() - new Date(session.user.created_at).getTime();
      const ageMin = (ageMs / 1000 / 60).toFixed(1);
      console.log("[WELCOME] ageMin:", ageMin);
      if (ageMs < 10 * 60 * 1000) {
        // Read pendingRef BEFORE applyPendingReferral removes it
        const pendingRef = localStorage.getItem("pendingRefCode");
        console.log("[WELCOME] New user detected, pendingRef:", pendingRef);
        await applyPendingReferral(session.access_token, session.user.created_at);
        localStorage.setItem("showWelcome", "true");
        localStorage.setItem("wasReferred", pendingRef ? "true" : "false");
        localStorage.removeItem("guestQuestionsUsed");
        console.log("[WELCOME] Set showWelcome=true, wasReferred=", pendingRef ? "true" : "false");
        createFreeSubscription(session.access_token);
      } else {
        console.log("[WELCOME] Existing user (age > 10 min), skipping welcome");
      }
      markSuccess();
    }

    function goTo(path: string) {
      if (done) return;
      done = true;
      navigate(path, { replace: true });
    }
    function markSuccess() {
      if (done) return;
      done = true;
      setStatus("success");
      setTimeout(() => navigate("/chat", { replace: true }), 2000);
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
    if (initialAuthType === "recovery") {
      (async () => {
        if (initialAccessToken && initialRefreshToken) {
          const { error: ssError } = await supabase.auth.setSession({
            access_token: initialAccessToken,
            refresh_token: initialRefreshToken,
          });
          if (ssError) {
            markError("Your reset link has expired or is invalid. Please request a new one.");
            return;
          }
        }
        goTo("/reset-password");
      })();
      return;
    }

    // ── PKCE code flow ─────────────────────────────────────────────────────────
    const code = searchParams.get("code");
    if (code) {
      let sub: { unsubscribe(): void } | null = null;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      console.log("[CALLBACK] PKCE code flow detected");

      sub = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          sub?.unsubscribe();
          if (timeout) clearTimeout(timeout);
          goTo("/reset-password");
        } else if (event === "SIGNED_IN") {
          sub?.unsubscribe();
          if (timeout) clearTimeout(timeout);
          console.log("[CALLBACK] PKCE SIGNED_IN event");
          handleSignedIn(session ?? null);
        }
      }).data.subscription;

      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
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
          if (session) { handleSignedIn(session); }
          else markError("Authentication failed or the link has expired. Please request a new link.");
        });
      }, 10000);

      return () => {
        sub?.unsubscribe();
        if (timeout) clearTimeout(timeout);
      };
    }

    // ── No code, no hash recovery — hash-based email confirmation or OAuth ─────
    console.log("[CALLBACK] Hash/no-code flow");

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        console.log("[CALLBACK] Hash SIGNED_IN event");
        handleSignedIn(session);
      }
    });

    const fallback = setTimeout(async () => {
      subscription.unsubscribe();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) handleSignedIn(session);
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
      background: "var(--brand-navy)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        {status === "loading" && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2} style={{ animation: "spin 1s linear infinite" }}>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <path strokeLinecap="round" d="M12 2a10 10 0 010 20" opacity={0.3} />
                <path strokeLinecap="round" d="M12 2a10 10 0 0110 10" />
              </svg>
            </div>
            <h2 style={{ fontFamily: "var(--font-heading)", color: "#fff", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Verifying your email…
            </h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: 0 }}>
              This will only take a moment.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(46,204,113,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2ECC71" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 style={{ fontFamily: "var(--font-heading)", color: "#2ECC71", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Email confirmed!
            </h2>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, margin: 0 }}>
              Welcome to SCIP. Redirecting you now…
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(220,38,38,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 style={{ fontFamily: "var(--font-heading)", color: "#fff", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
              Confirmation failed
            </h2>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              {errorMessage}
            </p>
            <Link
              to="/signup"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--brand-green)",
                color: "#fff",
                padding: "10px 24px",
                borderRadius: "var(--radius-lg)",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: 14,
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
