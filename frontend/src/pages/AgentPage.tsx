import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ChatKitPanel } from "../components/ChatKitPanel";

export function AgentPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      <header className="flex-shrink-0 px-4 py-3 flex items-center gap-3" style={{ backgroundColor: "#1B3A6B" }}>
        <button
          onClick={() => navigate("/dashboard")}
          className="text-white/70 hover:text-white transition-colors"
          title="Back to dashboard"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <img src="/logo.png" alt="SCIP logo" className="w-7 h-7 object-contain rounded-lg" />
        <span className="text-white font-semibold text-sm">SCIP Clinical Assistant</span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="ml-auto text-xs text-white/60 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </header>

      <div className="flex-1 min-h-0 p-4">
        <div className="h-full rounded-2xl overflow-hidden bg-white shadow-sm">
          <ChatKitPanel />
        </div>
      </div>
    </div>
  );
}
