import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  user: User;
  currentSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  refreshKey: number;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  isDesktopOpen?: boolean;
}

type DateGroup = "Today" | "Yesterday" | "Previous 7 days" | "Previous 30 days" | "Older";
const GROUP_ORDER: DateGroup[] = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"];

function getGroup(updatedAt: string): DateGroup {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const sevenDays = new Date(today); sevenDays.setDate(today.getDate() - 7);
  const thirtyDays = new Date(today); thirtyDays.setDate(today.getDate() - 30);
  const d = new Date(updatedAt);
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dDay >= today) return "Today";
  if (dDay >= yesterday) return "Yesterday";
  if (dDay >= sevenDays) return "Previous 7 days";
  if (dDay >= thirtyDays) return "Previous 30 days";
  return "Older";
}

export function Sidebar({
  user,
  currentSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  refreshKey,
  isMobileOpen,
  onMobileClose,
  isDesktopOpen = true,
}: Props) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const fullName = meta.full_name || user.email?.split("@")[0] || "";
  const initials = fullName
    .replace(/^Dr\.?\s*/i, "")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  useEffect(() => {
    async function loadSessions() {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) {
        console.error("[SCIP] Sidebar fetchSessions error:", error.message, error);
      }
      setSessions(data ?? []);
    }

    loadSessions();

    // Real-time: re-fetch whenever any chat_session row for this user changes
    const channel = supabase
      .channel(`sidebar_sessions:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_sessions", filter: `user_id=eq.${user.id}` },
        () => { loadSessions(); }
      )
      .subscribe();

    // Fallback poll every 30s in case real-time is not enabled on this table
    const pollId = setInterval(loadSessions, 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollId);
    };
  }, [user.id, refreshKey]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const grouped = new Map<DateGroup, ChatSession[]>();
  for (const s of sessions) {
    const g = getGroup(s.updated_at);
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(s);
  }

  const inner = (
    <div
      style={{
        width: 260,
        background: "var(--brand-navy)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        flexShrink: 0,
        fontFamily: "var(--font-heading)",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 14px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
            <img src="/logo.png" alt="SCIP" style={{ width: 28, height: 28, objectFit: "contain" }} />
            <span style={{ color: "#ffffff", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>SCIP</span>
          </a>
          <button
            className="lg:hidden"
            onClick={onMobileClose}
            style={{
              color: "rgba(255,255,255,0.5)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "5px",
              display: "flex",
              alignItems: "center",
              borderRadius: 6,
            }}
            aria-label="Close menu"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <button
          onClick={() => { onNewChat(); onMobileClose(); }}
          style={{
            width: "100%",
            padding: "9px 14px",
            background: "var(--brand-green)",
            color: "#ffffff",
            border: "none",
            borderRadius: 10,
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "background var(--transition-fast)",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = "var(--brand-green-700)")}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = "var(--brand-green)")}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Session list */}
      <div
        className="scip-scrollbar"
        style={{ flex: 1, overflowY: "auto", padding: "2px 8px" }}
      >
        {sessions.length === 0 ? (
          <div style={{ padding: "20px 12px", textAlign: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              Your conversations<br />will appear here
            </p>
          </div>
        ) : (
          GROUP_ORDER.filter(g => grouped.has(g)).map(group => (
            <div key={group}>
              <p style={{
                color: "rgba(255,255,255,0.28)",
                fontSize: 10,
                fontWeight: 700,
                padding: "10px 8px 4px",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                margin: 0,
              }}>
                {group}
              </p>
              {grouped.get(group)!.map(session => {
                const isActive = currentSessionId === session.id;
                const isHovered = hoveredId === session.id;
                return (
                  <div
                    key={session.id}
                    onMouseEnter={() => setHoveredId(session.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      borderRadius: isActive ? "0 8px 8px 0" : 8,
                      background: isActive
                        ? "rgba(46,204,113,0.1)"
                        : isHovered
                        ? "rgba(255,255,255,0.05)"
                        : "transparent",
                      marginBottom: 1,
                      borderLeft: isActive ? "3px solid var(--brand-green)" : "3px solid transparent",
                      transition: "background var(--transition-fast)",
                    }}
                  >
                    <button
                      onClick={() => { onSelectSession(session.id); onMobileClose(); }}
                      style={{
                        flex: 1,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        padding: "7px 8px 7px 9px",
                        color: isActive ? "#ffffff" : "rgba(255,255,255,0.62)",
                        fontSize: 13,
                        fontFamily: "var(--font-heading)",
                        lineHeight: 1.4,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {session.title}
                    </button>
                    {isHovered && (
                      <button
                        onClick={e => { e.stopPropagation(); onDeleteSession(session.id); }}
                        title="Delete conversation"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "5px 8px 5px 4px",
                          color: "rgba(255,255,255,0.35)",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          borderRadius: 4,
                          transition: "color var(--transition-fast)",
                        }}
                        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = "#f87171")}
                        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)")}
                      >
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Bottom user section */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "10px 10px 12px" }}>
        <div ref={userMenuRef} style={{ position: "relative" }}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            style={{
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "7px 8px",
              borderRadius: 9,
              color: "rgba(255,255,255,0.85)",
              transition: "background var(--transition-fast)",
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)")}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = "none")}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1B3A6B 0%, #244985 100%)",
              border: "2px solid rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontFamily: "var(--font-heading)",
              fontWeight: 700,
              color: "#ffffff",
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {fullName || user.email}
              </div>
              {fullName && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email}
                </div>
              )}
            </div>
            <svg
              width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              style={{ flexShrink: 0, color: "rgba(255,255,255,0.35)", transform: showUserMenu ? "rotate(180deg)" : "none", transition: "transform var(--transition-fast)" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showUserMenu && (
            <div style={{
              position: "absolute",
              bottom: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "#0d2240",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 11,
              padding: "4px",
              zIndex: 50,
              boxShadow: "0 -8px 24px rgba(0,0,0,0.3)",
            }}>
              <SidebarMenuItem
                icon={
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                }
                label="Dashboard"
                onClick={() => { setShowUserMenu(false); navigate("/dashboard"); }}
              />
              <SidebarMenuItem
                icon={
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
                label="Settings"
                onClick={() => { setShowUserMenu(false); navigate("/settings"); }}
              />
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "3px 4px" }} />
              <SidebarMenuItem
                icon={
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                }
                label="Sign out"
                onClick={() => { setShowUserMenu(false); supabase.auth.signOut(); }}
                danger
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — in flow, collapsible via isDesktopOpen */}
      {isDesktopOpen && (
        <div className="hidden lg:flex" style={{ height: "100dvh", flexShrink: 0 }}>
          {inner}
        </div>
      )}
      {/* Mobile sidebar — fixed overlay when open */}
      {isMobileOpen && (
        <div
          className="lg:hidden"
          style={{ position: "fixed", inset: "0 auto 0 0", zIndex: 50 }}
        >
          {inner}
        </div>
      )}
    </>
  );
}

function SidebarMenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        background: "none",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "7px 10px",
        borderRadius: 7,
        fontSize: 13,
        fontFamily: "var(--font-heading)",
        fontWeight: 500,
        color: danger ? "#f87171" : "rgba(255,255,255,0.72)",
        textAlign: "left",
        transition: "background var(--transition-fast)",
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)")}
      onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = "none")}
    >
      {icon}
      {label}
    </button>
  );
}
