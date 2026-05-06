import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { ASK_API_URL, BACKEND_HEALTH_URL, BACKEND_PING_URL } from "../lib/config";

const EXAMPLE_QUESTIONS = [
  "Management of severe acute malnutrition in children under 5",
  "First line treatment for malaria in pregnant women",
  "Signs and management of neonatal sepsis",
];

type Message = { role: "user" | "assistant"; content: string };

function loadingPhaseMessage(elapsed: number): string {
  if (elapsed < 3)  return "Searching 104 medical guidelines…";
  if (elapsed < 7)  return "Retrieving relevant protocols…";
  return               `Generating cited response… ${elapsed}s`;
}

export function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [showBounceArrow, setShowBounceArrow] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [hoveredQuestion, setHoveredQuestion] = useState<string | null>(null);
  const [sendHovered, setSendHovered] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();

  // Wake Render on page load
  useEffect(() => { fetch(BACKEND_HEALTH_URL).catch(() => {}); }, []);

  // Keep Render warm — ping every 10 minutes silently
  useEffect(() => {
    const id = setInterval(() => fetch(BACKEND_PING_URL).catch(() => {}), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => setShowBounceArrow(false), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isGuest = user === null;

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    // Abort any in-flight request before starting a new one
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(ASK_API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: newMessages }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let started = false;
      let errorOccurred = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const evt = JSON.parse(raw);

            if (evt.delta) {
              if (!started) {
                started = true;
                setLoading(false);
                setMessages(prev => [...prev, { role: "assistant", content: "" }]);
              }
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: last.content + evt.delta };
                }
                return updated;
              });
            }

            if (evt.error && !started && !errorOccurred) {
              errorOccurred = true;
              setMessages(prev => [...prev, {
                role: "assistant",
                content: "I'm sorry, something went wrong. Please try again.",
              }]);
            }
          } catch { /* malformed SSE line — ignore */ }
        }
      }

      // Only show fallback if no tokens AND no error message was already shown
      if (!started && !errorOccurred) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "I'm sorry, I couldn't generate a response. Please try again.",
        }]);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Failed to connect to the server. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  const hasMessages = messages.length > 0;
  const heroMode = !hasMessages;
  const meta = (user?.user_metadata ?? {}) as Record<string, string>;
  const fullName = meta.full_name || user?.email?.split("@")[0] || "";
  const initials = fullName
    .replace(/^Dr\.?\s*/i, "")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  // ── Shared pinned input ──────────────────────────────────────────────────
  const inputBox = (
    <div
      className="flex-shrink-0"
      style={heroMode ? {
        borderTop: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(0,0,0,0.18)",
      } : {
        borderTop: "1px solid #e2e8f0",
        background: "#ffffff",
      }}
    >
      <div className="max-w-xl mx-auto w-full px-4 pt-3 pb-4">

        {heroMode && (
          <div className="flex items-center gap-2 mb-2">
            <span
              className="live-dot inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: "#2ECC71" }}
            />
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
              Ask SCIP a Clinical Question — SCIP is ready
            </span>
          </div>
        )}

        <div
          className="rounded-2xl transition-all"
          style={{
            border: "2px solid #2ECC71",
            boxShadow: inputFocused
              ? "0 0 0 4px rgba(46,204,113,0.28), 0 4px 20px rgba(0,0,0,0.2)"
              : "0 0 0 2px rgba(46,204,113,0.12)",
          }}
        >
          <div
            className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 sm:gap-3 rounded-xl px-4 py-3"
            style={{ background: heroMode ? "rgba(255,255,255,0.07)" : "transparent" }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Type your clinical question here…"
              disabled={loading}
              rows={1}
              className="flex-1 w-full bg-transparent resize-none outline-none disabled:cursor-not-allowed"
              style={{
                lineHeight: "1.55",
                minHeight: "44px",
                maxHeight: "160px",
                overflowY: "auto",
                fontSize: "16px",
                color: heroMode ? "#ffffff" : "#0f172a",
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              onMouseEnter={() => setSendHovered(true)}
              onMouseLeave={() => setSendHovered(false)}
              disabled={!input.trim() || loading}
              className="w-full sm:w-auto flex-shrink-0 flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-white transition-all disabled:opacity-30"
              style={{
                backgroundColor: sendHovered ? "#27ae60" : "#2ECC71",
                transform: sendHovered && !(!input.trim() || loading) ? "scale(1.04)" : "scale(1)",
                fontSize: "14px",
                whiteSpace: "nowrap",
              }}
            >
              Ask SCIP
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <p className="mt-2 text-xs text-center" style={{ color: heroMode ? "rgba(255,255,255,0.3)" : "#94a3b8" }}>
          SCIP is an AI assistant. Always apply clinical judgment.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes bounceDown {
          0%, 100% { transform: translateY(0);  }
          50%       { transform: translateY(8px); }
        }
        @keyframes scalePulse {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%       { transform: scale(1.6); opacity: 0.5; }
        }
        .anim-fade-in    { animation: fadeInUp 0.6s ease 0.00s both; }
        .anim-fade-in-d1 { animation: fadeInUp 0.6s ease 0.10s both; }
        .anim-fade-in-d2 { animation: fadeInUp 0.6s ease 0.20s both; }
        .anim-fade-in-d3 { animation: fadeInUp 0.6s ease 0.35s both; }
        .anim-fade-in-d4 { animation: fadeInUp 0.6s ease 0.50s both; }
        .anim-fade-in-d5 { animation: fadeInUp 0.6s ease 0.65s both; }
        .bounce-arrow { animation: bounceDown 0.9s ease-in-out infinite; }
        .live-dot     { animation: scalePulse 1.6s ease-in-out infinite; }
        .hero-dot-grid {
          background-image: radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .scip-scrollbar::-webkit-scrollbar       { width: 5px; }
        .scip-scrollbar::-webkit-scrollbar-track  { background: transparent; }
        .scip-scrollbar::-webkit-scrollbar-thumb  { background: rgba(255,255,255,0.15); border-radius: 9px; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .cursor-blink::after { content:"▋"; animation: blink 0.8s step-start infinite; }
      `}</style>

      <div
        className="flex flex-col overflow-hidden"
        style={{
          height: "100dvh",
          background: heroMode
            ? "linear-gradient(135deg, #0B2545 0%, #1B3A6B 100%)"
            : "#ffffff",
        }}
      >

        {/* ── Header ── flex-shrink-0 ───────────────────────────────────── */}
        <header
          className="flex-shrink-0 px-4 sm:px-6 py-3 flex items-center justify-between z-20"
          style={{
            background: heroMode ? "transparent" : "#ffffff",
            borderBottom: heroMode ? "none" : "1px solid #e2e8f0",
          }}
        >
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="SCIP" className="h-8 w-8 object-contain" />
            <span className="font-bold text-base" style={{ color: heroMode ? "#ffffff" : "#0f172a" }}>
              SCIP
            </span>
          </div>

          <div className="flex items-center gap-2">
            {user === undefined ? null : user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(d => !d)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors"
                  style={{ color: heroMode ? "#ffffff" : "#334155" }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: heroMode ? "rgba(255,255,255,0.2)" : "#1B3A6B" }}
                  >
                    {initials}
                  </div>
                  <span className="text-sm font-medium hidden sm:inline max-w-[140px] truncate">
                    {fullName || user.email}
                  </span>
                  <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showDropdown && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                    <button
                      onClick={() => { setShowDropdown(false); navigate("/dashboard"); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      Dashboard
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={() => supabase.auth.signOut()}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-1.5 text-sm font-medium rounded-lg border transition-all"
                  style={heroMode ? {
                    color: "#ffffff",
                    borderColor: "rgba(255,255,255,0.45)",
                    background: "transparent",
                  } : {
                    color: "#334155",
                    borderColor: "#e2e8f0",
                    background: "transparent",
                  }}
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-1.5 text-sm font-semibold text-white rounded-lg transition-all hover:opacity-90"
                  style={{ backgroundColor: "#2ECC71" }}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </header>

        {/* ── Scrollable content ── flex-1, overflow-y-auto ──────────────── */}
        {heroMode ? (
          <div className="flex-1 overflow-y-auto hero-dot-grid scip-scrollbar" style={{ minHeight: 0 }}>
            <div className="flex flex-col items-center px-4 py-8" style={{ minHeight: "100%" }}>

              <div className={`flex flex-col items-center text-center ${mounted ? "anim-fade-in" : "opacity-0"}`}>
                <img src="/logo.png" alt="SCIP" className="w-16 h-16 object-contain mb-5" />
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-3 leading-tight max-w-2xl">
                  Ethiopia's First AI-Powered
                  <br className="hidden sm:block" />
                  <span style={{ color: "#2ECC71" }}> Clinical Decision Support</span>
                </h1>
                <p className="text-xs sm:text-sm font-semibold tracking-widest uppercase mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Built by Ethiopian Health Professionals, for Ethiopian Frontline Care
                </p>
                <p className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.38)" }}>
                  Serving frontline doctors, nurses, and health officers across Ethiopia and the Horn of Africa
                </p>
              </div>

              <p className={`mt-6 text-sm sm:text-base leading-relaxed text-center max-w-xl ${mounted ? "anim-fade-in-d1" : "opacity-0"}`}
                style={{ color: "rgba(255,255,255,0.65)" }}>
                SCIP draws on a library of{" "}
                <span className="font-semibold text-white">104 validated national guidelines</span>,
                clinical manuals, and medical protocols. Every answer comes from{" "}
                <span className="font-semibold text-white">Ethiopian Ministry of Health and WHO-validated sources</span>
                {" "}— not from the internet.
              </p>

              <div className={`mt-7 flex flex-wrap justify-center gap-3 ${mounted ? "anim-fade-in-d2" : "opacity-0"}`}>
                {[
                  { icon: "📚", label: "104 Guidelines",          sub: "MoH & WHO validated"     },
                  { icon: "🌍", label: "15+ Specialties",          sub: "Full clinical breadth"   },
                  { icon: "⚕️",  label: "Ethiopian Frontline Care", sub: "Designed for the field" },
                ].map(stat => (
                  <div
                    key={stat.label}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.14)",
                    }}
                  >
                    <span className="text-xl">{stat.icon}</span>
                    <div>
                      <div className="text-white text-xs font-bold leading-tight">{stat.label}</div>
                      <div className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.45)" }}>{stat.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`mt-4 flex flex-wrap justify-center gap-2 ${mounted ? "anim-fade-in-d3" : "opacity-0"}`}>
                {["🇪🇹 Ethiopian MoH", "🌐 WHO", "🔒 Secure", "📱 Mobile Optimized"].map(badge => (
                  <span
                    key={badge}
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      color: "rgba(255,255,255,0.65)",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.11)",
                    }}
                  >
                    {badge}
                  </span>
                ))}
              </div>

              <div className={`mt-8 flex flex-col gap-2.5 w-full max-w-xl ${mounted ? "anim-fade-in-d4" : "opacity-0"}`}>
                {EXAMPLE_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    onMouseEnter={() => setHoveredQuestion(q)}
                    onMouseLeave={() => setHoveredQuestion(null)}
                    className="text-left px-4 py-3 rounded-xl text-sm text-white flex items-center justify-between gap-3 transition-all"
                    style={{
                      background: hoveredQuestion === q ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)",
                      border: hoveredQuestion === q ? "1px solid #2ECC71" : "1px solid rgba(255,255,255,0.14)",
                      borderLeft: hoveredQuestion === q ? "3px solid #2ECC71" : undefined,
                    }}
                  >
                    <span className="leading-snug">{q}</span>
                    <span className="flex-shrink-0 font-bold" style={{ color: "#2ECC71" }}>→</span>
                  </button>
                ))}
              </div>

              {showBounceArrow && (
                <div className={`bounce-arrow mt-6 text-2xl ${mounted ? "anim-fade-in-d5" : "opacity-0"}`} style={{ color: "#2ECC71" }}>
                  ↓
                </div>
              )}

              <p
                className={`mt-8 pb-2 text-xs text-center max-w-xl ${mounted ? "anim-fade-in-d5" : "opacity-0"}`}
                style={{ color: "rgba(255,255,255,0.28)" }}
              >
                ⚕️ SCIP supports clinical decisions — it does not replace clinical judgment or specialist consultation.{" "}
                Developed by SHIFA | scip-et.com
              </p>
            </div>
          </div>
        ) : (
          /* Chat messages */
          <div className="flex-1 overflow-y-auto px-4 py-6 bg-white" style={{ minHeight: 0 }}>
            <div className="max-w-2xl mx-auto flex flex-col gap-6">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <img src="/logo.png" alt="SCIP" className="w-7 h-7 object-contain rounded-full flex-shrink-0 mt-1" />
                  )}
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "text-white rounded-br-sm"
                        : "bg-slate-100 text-slate-800 rounded-bl-sm"
                    }`}
                    style={msg.role === "user" ? { backgroundColor: "#1B3A6B" } : {}}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3 justify-start">
                  <img src="/logo.png" alt="SCIP" className="w-7 h-7 object-contain rounded-full flex-shrink-0 mt-1" />
                  <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1 items-center">
                      {[0, 150, 300].map(delay => (
                        <span
                          key={delay}
                          className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">
                      {loadingPhaseMessage(elapsed)}
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* ── Pinned input ── flex-shrink-0, always at bottom ────────────── */}
        {inputBox}

      </div>
    </>
  );
}
