import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { CHATKIT_API_URL } from "./lib/config";
import { LoginPage } from "./pages/LoginPage";
import { SignUpPage } from "./pages/SignUpPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AgentPage } from "./pages/AgentPage";

// Attach the Supabase JWT to every backend request.
const _fetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  if (url.startsWith(CHATKIT_API_URL)) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      init = { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } };
    }
  }
  return _fetch(input, init);
};

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
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/signup" element={session ? <Navigate to="/dashboard" replace /> : <SignUpPage />} />
        <Route path="/dashboard" element={session ? <DashboardPage /> : <Navigate to="/login" replace />} />
        <Route path="/agent" element={session ? <AgentPage /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={session ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
