import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { ASK_API_URL } from "../lib/config";

const GUEST_COUNT_KEY = "scip_guest_count";
const GUEST_LIMIT = 3;

const EXAMPLE_QUESTIONS = [
  "Management of severe acute malnutrition in children under 5",
  "First line treatment for malaria in pregnant women",
  "Signs and management of neonatal sepsis",
];

type Message = { role: "user" | "assistant"; content: string };

export function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [showDropdown, setShowDropdown] = useState(false);
  const [guestCount, setGuestCount] = useState(() =>
    parseInt(localStorage.getItem(GUEST_COUNT_KEY) || "0", 10)
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

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
  const guestBlocked = isGuest && guestCount >= GUEST_LIMIT;
  const showSignupBanner = isGuest && guestCount >= GUEST_LIMIT && messages.length > 0;

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading || guestBlocked) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    if (isGuest) {
      const newCount = guestCount + 1;
      setGuestCount(newCount);
      localStorage.setItem(GUEST_COUNT_KEY, String(newCount));
    }

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
      });

      const json = await res.json();
      setMessages(prev => [...prev, {
        role: "assistant",
        content: json.text || "No response received. Please try again.",
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Something went wrong connecting to the server. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, guestBlocked, isGuest, guestCount]);

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
  const meta = (user?.user_metadata ?? {}) as Record<string, string>;
  const fullName = meta.full_name || user?.email?.split("@")[0] || "";
  const initials = fullName
    .replace(/^Dr\.?\s*/i, "")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <div className="flex flex-col h-screen bg-white">

      {/* ── Header ── */}
      <header className="flex-shrink-0 border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="SCIP" className="h-8 w-8 object-contain" />
          <span className="font-bold text-slate-900 text-base">SCIP</span>
        </div>

        <div className="flex items-center gap-2">
          {user === undefined ? null : user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(d => !d)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: "#1B3A6B" }}
                >
                  {initials}
                </div>
                <span className="text-sm font-medium text-slate-700 hidden sm:inline max-w-[140px] truncate">
                  {fullName || user.email}
                </span>
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
                className="px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="px-4 py-1.5 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#1B3A6B" }}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ── Main area ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

        {/* Welcome screen or message list */}
        {!hasMessages ? (
          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 py-8">
            <img src="/logo.png" alt="SCIP" className="w-16 h-16 object-contain mb-5" />
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2 text-center">
              Welcome to SCIP
            </h1>
            <p className="text-base sm:text-lg text-slate-500 mb-4 text-center">
              Your AI-Powered Clinical Decision Support Assistant
            </p>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed text-center max-w-xl">
              SCIP draws on a library of <strong className="text-slate-700">106 validated national guidelines</strong>,
              clinical manuals, and medical protocols — spanning infectious diseases, maternal and neonatal
              health, pediatrics, emergency medicine, non-communicable diseases, mental health, surgery,
              nutrition, reproductive health, palliative care, and more. Every answer is cited directly
              from Ethiopian Ministry of Health and WHO-validated sources.
            </p>

            <div className="flex flex-col gap-2.5 w-full max-w-xl">
              {EXAMPLE_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm text-slate-700 transition-colors leading-snug"
                >
                  {q} →
                </button>
              ))}
            </div>

            {isGuest && (
              <p className="mt-6 text-xs text-slate-400 text-center">
                {GUEST_LIMIT} free questions · <Link to="/signup" className="underline hover:text-slate-600">Sign up</Link> for unlimited access and history
              </p>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="max-w-2xl mx-auto flex flex-col gap-6">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <img
                      src="/logo.png"
                      alt="SCIP"
                      className="w-7 h-7 object-contain rounded-full flex-shrink-0 mt-1"
                    />
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
                    <div className="flex gap-1 items-center h-4">
                      {[0, 150, 300].map(delay => (
                        <span
                          key={delay}
                          className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Guest signup banner */}
        {showSignupBanner && (
          <div className="flex-shrink-0 px-4 pb-3">
            <div className="max-w-2xl mx-auto bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
              <p className="text-sm text-blue-800 leading-snug">
                Sign up free to save your chat history and ask unlimited questions.
              </p>
              <Link
                to="/signup"
                className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-white rounded-lg whitespace-nowrap"
                style={{ backgroundColor: "#1B3A6B" }}
              >
                Sign Up Free
              </Link>
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="flex-shrink-0 border-t border-slate-200 px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-slate-400 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  guestBlocked
                    ? "Sign up to ask more questions…"
                    : "Ask a clinical question… (Shift+Enter for new line)"
                }
                disabled={guestBlocked}
                rows={1}
                className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed"
                style={{ lineHeight: "1.5", maxHeight: "160px", overflowY: "auto" }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading || guestBlocked}
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white transition-opacity disabled:opacity-30"
                style={{ backgroundColor: "#1B3A6B" }}
                title="Send"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-center text-slate-400 mt-2">
              SCIP is an AI assistant. Always apply clinical judgment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
