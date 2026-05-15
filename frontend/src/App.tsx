import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase, initialAuthType } from "./lib/supabase";
import { LoginPage } from "./pages/LoginPage";
import { SignUpPage } from "./pages/SignUpPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ChatPage } from "./pages/ChatPage";
import { InstallPage } from "./pages/InstallPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SharePage } from "./pages/SharePage";
import { InstallBanner } from "./components/InstallBanner";

// Safety net for recovery links that land on any page other than /reset-password.
// Uses initialAuthType (captured before Supabase cleared the hash) because
// the PASSWORD_RECOVERY event fires once during init and is never replayed.
function AuthRedirectHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    if (initialAuthType === "recovery" && window.location.pathname !== "/reset-password") {
      navigate("/reset-password", { replace: true });
    }
    // Empty deps: must run ONCE on mount only. initialAuthType is a module-level
    // constant set at page load. If [navigate] were used, the effect would re-run
    // every time navigate's reference changes (which happens on every navigation
    // in React Router v6), permanently redirecting back to /reset-password.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Avoid flash while session is loading
  if (session === undefined) return null;

  return (
    <BrowserRouter>
      <AuthRedirectHandler />
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/login" element={session ? <Navigate to="/chat" replace /> : <LoginPage />} />
        <Route path="/signup" element={session ? <Navigate to="/chat" replace /> : <SignUpPage />} />
        <Route path="/dashboard" element={session ? <DashboardPage /> : <Navigate to="/login" replace />} />
        <Route path="/agent" element={<Navigate to="/chat" replace />} />
        <Route path="/install" element={<InstallPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/forgot-password" element={session ? <Navigate to="/chat" replace /> : <ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/settings" element={session ? <SettingsPage /> : <Navigate to="/login" replace />} />
        <Route path="/share/:id" element={<SharePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InstallBanner />
    </BrowserRouter>
  );
}
