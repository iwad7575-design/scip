import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { Sidebar } from "../components/Sidebar";
import { ASK_API_URL, BACKEND_HEALTH_URL, BACKEND_PING_URL } from "../lib/config";

const EXAMPLE_QUESTIONS = [
  { icon: "🍼", category: "Pediatrics",        text: "Management of severe acute malnutrition in children under 5" },
  { icon: "🦟", category: "Infectious Disease", text: "First line treatment for malaria in pregnant women in Ethiopia" },
  { icon: "👶", category: "Neonatology",        text: "Signs and management of neonatal sepsis" },
];

type Message = { role: "user" | "assistant"; content: string; stopped?: boolean };

const CITATION_RE = /filecite\s*turn\d+\s*file\d+|turn\d+file\d+|【[^】]*】/gi;
function cleanCitations(text: string): string {
  return text.replace(CITATION_RE, "").replace(/ {2,}/g, " ").replace(/ ([,\.;:!?])/g, "$1");
}

function loadingPhaseMessage(elapsed: number): string {
  if (elapsed < 3)  return "Searching 106 medical guidelines…";
  if (elapsed < 7)  return "Retrieving relevant protocols…";
  return               `Generating cited response… ${elapsed}s`;
}

export function ChatPage() {
  const [messages, setMessages]               = useState<Message[]>([]);
  const [input, setInput]                     = useState("");
  const [loading, setLoading]                 = useState(false);
  const [elapsed, setElapsed]                 = useState(0);
  const [user, setUser]                       = useState<User | null | undefined>(undefined);
  const [inputFocused, setInputFocused]       = useState(false);
  const [mounted, setMounted]                 = useState(false);

  const [currentSessionId, setCurrentSessionId]       = useState<string | null>(null);
  const [sidebarRefreshKey, setSidebarRefreshKey]      = useState(0);
  const [isSidebarOpen, setIsSidebarOpen]              = useState(false);
  const [isSidebarDesktopOpen, setIsSidebarDesktopOpen] = useState(true);

  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const textareaRef          = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef   = useRef<AbortController | null>(null);
  const isSendingRef         = useRef(false);
  const isCreatingSessionRef = useRef(false);

  useEffect(() => { fetch(BACKEND_HEALTH_URL).catch(() => {}); }, []);

  useEffect(() => {
    const id = setInterval(() => fetch(BACKEND_PING_URL).catch(() => {}), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { setMounted(true); }, []);

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

  function handleStop() {
    abortControllerRef.current?.abort();
    setLoading(false);
  }

  useEffect(() => {
    if (!loading) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") handleStop(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session helpers ──────────────────────────────────────────────────────

  function handleNewChat() {
    setMessages([]);
    setCurrentSessionId(null);
  }

  function handleHamburgerClick() {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(v => !v);
    } else {
      setIsSidebarDesktopOpen(v => !v);
    }
  }

  async function handleSelectSession(sessionId: string) {
    const { data, error } = await supabase
      .from("chat_history")
      .select("question, answer, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) { console.error("[SCIP] Load session error:", error.message); return; }
    if (!data || data.length === 0) { console.log("[SCIP] No messages for session:", sessionId); return; }
    const msgs: Message[] = data.flatMap(row => [
      { role: "user" as const, content: row.question },
      { role: "assistant" as const, content: row.answer },
    ]);
    setMessages(msgs);
    setCurrentSessionId(sessionId);
    // Ensure URL reflects chat mode when loading a session from the landing page
    if (window.location.pathname === "/") {
      window.history.replaceState(null, "", "/chat");
    }
  }

  async function handleDeleteSession(sessionId: string) {
    await supabase.from("chat_sessions").delete().eq("id", sessionId);
    if (currentSessionId === sessionId) handleNewChat();
    setSidebarRefreshKey(k => k + 1);
  }

  // ── Send message ─────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading || isSendingRef.current) return;
    isSendingRef.current = true;

    // Swap URL from / to /chat without remounting (preserves all state)
    if (window.location.pathname === "/") {
      window.history.replaceState(null, "", "/chat");
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const userId = currentUser?.id ?? "";

    let sessionId = currentSessionId;
    if (!sessionId && userId && !isCreatingSessionRef.current) {
      isCreatingSessionRef.current = true;
      try {
        const { data, error: insertError } = await supabase
          .from("chat_sessions")
          .insert({
            user_id: userId,
            title: text.trim().slice(0, 60),
            message_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (insertError) {
          console.error("[SCIP] chat_sessions INSERT failed:", insertError.message, insertError.code);
        }
        if (data?.id) {
          sessionId = data.id;
          setCurrentSessionId(data.id);
          setSidebarRefreshKey(k => k + 1);
        }
      } finally {
        isCreatingSessionRef.current = false;
      }
    }

    let assistantContent = "";
    let aborted = false;

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
              const cleaned = cleanCitations(evt.delta);
              assistantContent += cleaned;
              if (!started) {
                started = true;
                setLoading(false);
                setMessages(prev => [...prev, { role: "assistant", content: "" }]);
              }
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: last.content + cleaned };
                }
                return updated;
              });
            }
            if (evt.error && !started && !errorOccurred) {
              errorOccurred = true;
              setMessages(prev => [...prev, { role: "assistant", content: "I'm sorry, something went wrong. Please try again." }]);
            }
          } catch { /* malformed SSE line */ }
        }
      }

      if (!started && !errorOccurred) {
        setMessages(prev => [...prev, { role: "assistant", content: "I'm sorry, I couldn't generate a response. Please try again." }]);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        aborted = true;
        setMessages(prev => {
          if (!prev.length) return prev;
          const last = prev[prev.length - 1];
          if (last.role === "assistant" && last.content.trim()) {
            return [...prev.slice(0, -1), { ...last, stopped: true }];
          }
          return prev;
        });
        return;
      }
      setMessages(prev => [...prev, { role: "assistant", content: "Failed to connect to the server. Please try again." }]);
    } finally {
      setLoading(false);

      if (sessionId && assistantContent && userId && !aborted) {
        const { error: histErr } = await supabase.from("chat_history").insert({
          user_id: userId,
          session_id: sessionId,
          question: text,
          answer: assistantContent,
          sources: "",
          created_at: new Date().toISOString(),
        });
        if (histErr) console.error("[SCIP] chat_history INSERT failed:", histErr.message);

        await supabase.from("chat_sessions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", sessionId);

        setSidebarRefreshKey(k => k + 1);
      } else if (sessionId && !assistantContent) {
        await supabase.from("chat_sessions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", sessionId);
      }

      isSendingRef.current = false;
    }
  }, [messages, loading, currentSessionId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  const hasMessages = messages.length > 0;
  const heroMode    = !hasMessages;
  const loggedIn    = !!user;

  // ── Input box ────────────────────────────────────────────────────────────

  const inputBox = (
    <div
      className="flex-shrink-0"
      style={heroMode ? {
        borderTop: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.15)",
      } : {
        borderTop: "1px solid var(--border)",
        background: "var(--surface)",
        boxShadow: "0 -1px 0 var(--border)",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto", width: "100%", padding: "12px 16px 14px" }}>

        {heroMode && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--brand-green)", flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontFamily: "var(--font-heading)", fontWeight: 500, color: "rgba(255,255,255,0.5)" }}>
              Ask SCIP a Clinical Question — SCIP is ready
            </span>
          </div>
        )}

        <div style={{
          border: "2px solid var(--brand-green)",
          borderRadius: 16,
          boxShadow: inputFocused
            ? "0 0 0 4px rgba(46,204,113,0.22), 0 4px 16px rgba(0,0,0,0.18)"
            : "0 0 0 2px rgba(46,204,113,0.1)",
          transition: "box-shadow var(--transition-fast)",
        }}>
          <div style={{
            display: "flex", flexDirection: "row", alignItems: "flex-end", gap: 10,
            padding: "12px 14px",
            background: heroMode ? "rgba(255,255,255,0.06)" : "var(--surface)",
            borderRadius: 14,
          }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={loading ? "SCIP is generating a response…" : "Type your clinical question here…"}
              disabled={loading}
              rows={1}
              style={{
                flex: 1, width: "100%", background: "transparent", resize: "none",
                outline: "none", border: "none", lineHeight: 1.55, minHeight: 44,
                maxHeight: 160, overflowY: "auto", fontSize: 16,
                fontFamily: "var(--font-body)",
                color: heroMode ? "#ffffff" : "var(--text-primary)",
                cursor: loading ? "not-allowed" : "text",
                opacity: loading ? 0.55 : 1,
              }}
            />

            {loading ? (
              <button
                onClick={handleStop}
                style={{
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  width: 44, height: 44, borderRadius: 10, background: "var(--brand-navy)",
                  border: "none", cursor: "pointer", transition: "background var(--transition-fast)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#c0392b"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--brand-navy)"; }}
                title="Stop generating (Esc)"
                aria-label="Stop generating"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                  <rect x="3" y="3" width="10" height="10" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                style={{
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 6, padding: "0 20px", borderRadius: 10,
                  fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 13,
                  color: "#ffffff", background: "var(--brand-green)", border: "none",
                  cursor: input.trim() ? "pointer" : "not-allowed",
                  opacity: input.trim() ? 1 : 0.35, whiteSpace: "nowrap", minHeight: 44,
                  transition: "background var(--transition-fast)",
                }}
                onMouseEnter={e => { if (input.trim()) (e.currentTarget as HTMLButtonElement).style.background = "var(--brand-green-700)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--brand-green)"; }}
              >
                Ask SCIP
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <p style={{
          marginTop: 6, fontSize: 11, textAlign: "center",
          color: heroMode ? "rgba(255,255,255,0.25)" : "var(--text-muted)",
          fontFamily: "var(--font-body)",
        }}>
          SCIP is an AI assistant. Always apply clinical judgment.
          {heroMode && !loggedIn && (
            <>{" · "}No account needed.{" "}
              <Link to="/signup" style={{ color: "var(--brand-green)", textDecoration: "none" }}>Sign up</Link>
              {" "}to save history.</>
          )}
        </p>
      </div>
    </div>
  );

  // ── Hero content (landing page with embedded chat input) ─────────────────

  const heroContent = (
    <div
      className="scip-scrollbar"
      style={{
        flex: 1, overflowY: "auto", minHeight: 0,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "40px 16px 24px", minHeight: "100%",
      }}>

        {/* Logo + headline */}
        <div
          className={mounted ? "anim-fade-in" : ""}
          style={{
            opacity: mounted ? undefined : 0,
            display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
          }}
        >
          <img src="/logo.png" alt="SCIP" style={{ width: 60, height: 60, objectFit: "contain", marginBottom: 20 }} />
          <h1 style={{
            fontFamily: "var(--font-heading)", fontSize: "clamp(24px, 5vw, 40px)",
            fontWeight: 800, color: "#ffffff", lineHeight: 1.2, marginBottom: 8, maxWidth: 580,
          }}>
            Ethiopia's First AI-Powered
            <br />
            <span style={{ color: "var(--brand-green)" }}>Clinical Decision Support</span>
          </h1>
          <p style={{
            fontFamily: "var(--font-heading)", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.45)", margin: "0 0 4px",
          }}>
            Built by Ethiopian Health Professionals, for Ethiopian Frontline Care
          </p>
        </div>

        {/* Description — hidden on mobile */}
        <p
          className={`hero-desc${mounted ? " anim-fade-in-d1" : ""}`}
          style={{
            opacity: mounted ? undefined : 0,
            marginTop: 18, fontSize: 14, lineHeight: 1.7, textAlign: "center",
            maxWidth: 520, color: "rgba(255,255,255,0.6)",
          }}
        >
          SCIP draws on{" "}
          <span style={{ fontWeight: 700, color: "#ffffff" }}>106 validated national guidelines</span>
          , clinical manuals, and protocols. Every answer comes from{" "}
          <span style={{ fontWeight: 700, color: "#ffffff" }}>Ethiopian Ministry of Health and WHO-validated sources</span>
          {" "}— not from the internet.
        </p>

        {/* Stats chips — hidden on mobile */}
        <div
          className={`hero-stats${mounted ? " anim-fade-in-d2" : ""}`}
          style={{
            opacity: mounted ? undefined : 0,
            marginTop: 18, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8,
          }}
        >
          {[
            { icon: "📚", label: "106 Guidelines",          sub: "MoH & WHO validated" },
            { icon: "🌍", label: "15+ Specialties",         sub: "Full clinical breadth" },
            { icon: "⚕️", label: "Ethiopian Frontline Care", sub: "Designed for the field" },
          ].map(stat => (
            <div
              key={stat.label}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <span style={{ fontSize: 16 }}>{stat.icon}</span>
              <div>
                <div style={{ fontFamily: "var(--font-heading)", color: "#ffffff", fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{stat.label}</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, lineHeight: 1.3 }}>{stat.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div
          className={mounted ? "anim-fade-in-d2" : ""}
          style={{
            opacity: mounted ? undefined : 0,
            marginTop: 10, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6,
          }}
        >
          {["🇪🇹 Ethiopian MoH", "🌐 WHO", "🔒 Secure", "📱 Mobile Optimized"].map(badge => (
            <span
              key={badge}
              style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 11,
                fontFamily: "var(--font-heading)", fontWeight: 500,
                color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {badge}
            </span>
          ))}
        </div>

        {/* Example question cards */}
        <div
          className={mounted ? "anim-fade-in-d3" : ""}
          style={{ opacity: mounted ? undefined : 0, marginTop: 28, width: "100%", maxWidth: 560 }}
        >
          <p style={{
            fontFamily: "var(--font-heading)", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.35)", textAlign: "center", margin: "0 0 8px",
          }}>
            Try asking
          </p>
          <div className="hero-example-list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {EXAMPLE_QUESTIONS.map(q => (
              <button
                key={q.text}
                className="hero-example-card"
                onClick={() => sendMessage(q.text)}
                style={{
                  textAlign: "left", padding: "12px 14px", borderRadius: 12,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                  transition: "background var(--transition-fast), border-color var(--transition-fast)",
                  width: "100%",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "rgba(255,255,255,0.12)";
                  el.style.borderColor = "var(--brand-green)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "rgba(255,255,255,0.06)";
                  el.style.borderColor = "rgba(255,255,255,0.12)";
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0, width: 28, textAlign: "center" }}>{q.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "var(--font-heading)", fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    color: "var(--brand-green)", marginBottom: 2,
                  }}>
                    {q.category}
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.45, fontFamily: "var(--font-body)" }}>
                    {q.text}
                  </div>
                </div>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--brand-green)" strokeWidth={2.5} style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );

  // ── Chat messages ────────────────────────────────────────────────────────

  const chatContent = (
    <div
      className="scip-scrollbar"
      style={{ flex: 1, overflowY: "auto", minHeight: 0, background: "var(--bg)", padding: "24px 16px" }}
    >
      <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {messages.map((msg, i) => (
          msg.role === "user" ? (
            <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ maxWidth: "82%" }}>
                <div style={{
                  background: "var(--brand-navy)", color: "#ffffff",
                  padding: "12px 16px", borderRadius: "18px 18px 4px 18px",
                  fontSize: 15, fontFamily: "var(--font-body)", lineHeight: 1.6, whiteSpace: "pre-wrap",
                }}>
                  {msg.content}
                </div>
              </div>
            </div>
          ) : (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", background: "var(--brand-navy)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
              }}>
                <img src="/logo.png" alt="SCIP" style={{ width: 18, height: 18, objectFit: "contain" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "4px 18px 18px 18px", padding: "12px 16px",
                  fontSize: 15, fontFamily: "var(--font-body)", lineHeight: 1.7,
                  color: "var(--text-primary)", whiteSpace: "pre-wrap", boxShadow: "var(--shadow-xs)",
                }}>
                  {msg.content}
                </div>
                {msg.stopped && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginTop: 4, paddingLeft: 4 }}>
                    Response stopped by user
                  </p>
                )}
              </div>
            </div>
          )
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", background: "var(--brand-navy)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
            }}>
              <img src="/logo.png" alt="SCIP" style={{ width: 18, height: 18, objectFit: "contain" }} />
            </div>
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "4px 18px 18px 18px", padding: "14px 18px", boxShadow: "var(--shadow-xs)",
            }}>
              <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 6 }}>
                {[0, 120, 240].map(delay => (
                  <span
                    key={delay}
                    style={{
                      width: 7, height: 7, borderRadius: "50%", background: "var(--brand-navy-400)",
                      display: "inline-block",
                      animation: "loadingDot 1.2s ease-in-out infinite",
                      animationDelay: `${delay}ms`,
                    }}
                  />
                ))}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-heading)", margin: 0 }}>
                {loadingPhaseMessage(elapsed)}
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-fade-in    { animation: fadeInUp 0.55s ease 0.00s both; }
        .anim-fade-in-d1 { animation: fadeInUp 0.55s ease 0.12s both; }
        .anim-fade-in-d2 { animation: fadeInUp 0.55s ease 0.24s both; }
        .anim-fade-in-d3 { animation: fadeInUp 0.55s ease 0.36s both; }
        @keyframes loadingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%            { transform: translateY(-4px); opacity: 1; }
        }
        /* Mobile: hide verbose hero sections, horizontal card scroll */
        @media (max-width: 640px) {
          .hero-desc  { display: none !important; }
          .hero-stats { display: none !important; }
          .hero-example-list {
            flex-direction: row !important;
            overflow-x: auto;
            padding-bottom: 6px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            gap: 8px !important;
          }
          .hero-example-list::-webkit-scrollbar { display: none; }
          .hero-example-card {
            min-width: 220px !important;
            flex-shrink: 0;
            width: auto !important;
          }
        }
      `}</style>

      <div style={{ display: "flex", height: "100dvh" }}>

        {/* Sidebar (logged-in only) */}
        {loggedIn && user && (
          <>
            {isSidebarOpen && (
              <div
                className="lg:hidden"
                onClick={() => setIsSidebarOpen(false)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }}
              />
            )}
            <Sidebar
              user={user}
              currentSessionId={currentSessionId}
              onNewChat={handleNewChat}
              onSelectSession={handleSelectSession}
              onDeleteSession={handleDeleteSession}
              refreshKey={sidebarRefreshKey}
              isMobileOpen={isSidebarOpen}
              onMobileClose={() => setIsSidebarOpen(false)}
              isDesktopOpen={isSidebarDesktopOpen}
            />
          </>
        )}

        {/* Main area */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
          background: heroMode
            ? "linear-gradient(155deg, #0B2545 0%, #1B3A6B 100%)"
            : "var(--bg)",
        }}>

          {/* Guest header */}
          {!loggedIn ? (
            <header style={{
              position: "relative", flexShrink: 0, padding: "12px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              zIndex: 20,
              background: heroMode ? "transparent" : "var(--surface)",
              borderBottom: heroMode ? "none" : "1px solid var(--border)",
            }}>
              <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                <img src="/logo.png" alt="SCIP" style={{ width: 30, height: 30, objectFit: "contain" }} />
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 15, color: heroMode ? "#ffffff" : "var(--text-primary)" }}>
                  SCIP
                </span>
              </Link>
              {user !== undefined && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Link
                    to="/login"
                    style={{
                      padding: "7px 16px", fontSize: 13, fontFamily: "var(--font-heading)",
                      fontWeight: 500, borderRadius: 8,
                      border: `1px solid ${heroMode ? "rgba(255,255,255,0.3)" : "var(--border)"}`,
                      color: heroMode ? "rgba(255,255,255,0.85)" : "var(--text-secondary)",
                      background: "transparent", textDecoration: "none",
                    }}
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    style={{
                      padding: "7px 16px", fontSize: 13, fontFamily: "var(--font-heading)",
                      fontWeight: 600, borderRadius: 8, background: "var(--brand-green)",
                      color: "#ffffff", textDecoration: "none",
                    }}
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </header>
          ) : (
            /* Logged-in header */
            <header style={{
              position: "relative", flexShrink: 0, padding: "10px 16px",
              display: "flex", alignItems: "center", gap: 10, zIndex: 20,
              background: heroMode ? "rgba(0,0,0,0.08)" : "var(--surface)",
              borderBottom: heroMode ? "1px solid rgba(255,255,255,0.07)" : "1px solid var(--border)",
            }}>
              <button
                onClick={handleHamburgerClick}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 6,
                  color: heroMode ? "#ffffff" : "var(--text-secondary)",
                  display: "flex", alignItems: "center", borderRadius: 6,
                }}
                aria-label="Toggle sidebar"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Link to="/" className="lg:hidden" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                <img src="/logo.png" alt="SCIP" style={{ height: 24, width: 24, objectFit: "contain" }} />
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 15, color: heroMode ? "#ffffff" : "var(--text-primary)" }}>
                  SCIP
                </span>
              </Link>
            </header>
          )}

          {heroMode ? heroContent : chatContent}
          {inputBox}
        </div>
      </div>
    </>
  );
}
