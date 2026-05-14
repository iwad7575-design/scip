import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
      const { data } = await supabase
        .from("chat_sessions")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(100);
      setSessions(data ?? []);
    }
    loadSessions();
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

  // Build grouped sessions map
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
        background: "#0B2545",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        flexShrink: 0,
      }}
    >
      {/* Top: Logo + New Chat */}
      <div style={{ padding: "16px 12px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/logo.png" alt="SCIP" style={{ width: 28, height: 28, objectFit: "contain" }} />
            <span style={{ color: "#ffffff", fontWeight: 700, fontSize: 15 }}>SCIP</span>
          </div>
          <button
            className="lg:hidden"
            onClick={onMobileClose}
            style={{
              color: "rgba(255,255,255,0.6)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 6px",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <button
          onClick={() => { onNewChat(); onMobileClose(); }}
          style={{
            width: "100%",
            padding: "9px 14px",
            background: "#2ECC71",
            color: "#ffffff",
            border: "none",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Session list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "4px 8px",
        }}
      >
        {sessions.length === 0 ? (
          <p style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: 12,
            textAlign: "center",
            marginTop: 24,
            padding: "0 16px",
            lineHeight: 1.5,
          }}>
            Your conversations will appear here
          </p>
        ) : (
          GROUP_ORDER.filter(g => grouped.has(g)).map(group => (
            <div key={group}>
              <p style={{
                color: "rgba(255,255,255,0.35)",
                fontSize: 11,
                fontWeight: 600,
                padding: "10px 8px 4px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                margin: 0,
              }}>
                {group}
              </p>
              {grouped.get(group)!.map(session => (
                <div
                  key={session.id}
                  onMouseEnter={() => setHoveredId(session.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    borderRadius: 8,
                    background: currentSessionId === session.id
                      ? "rgba(255,255,255,0.12)"
                      : hoveredId === session.id
                      ? "rgba(255,255,255,0.06)"
                      : "transparent",
                    marginBottom: 2,
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
                      padding: "7px 8px",
                      color: currentSessionId === session.id ? "#ffffff" : "rgba(255,255,255,0.7)",
                      fontSize: 13,
                      lineHeight: 1.4,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {session.title}
                  </button>
                  {hoveredId === session.id && (
                    <button
                      onClick={e => { e.stopPropagation(); onDeleteSession(session.id); }}
                      title="Delete conversation"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px 8px 4px 4px",
                        color: "rgba(255,255,255,0.4)",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Bottom: User info + dropdown */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "10px 12px" }}>
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
              padding: "6px 8px",
              borderRadius: 8,
              color: "rgba(255,255,255,0.85)",
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)")}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = "none")}
          >
            <div style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#1B3A6B",
              border: "2px solid rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
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
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email}
                </div>
              )}
            </div>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ flexShrink: 0, color: "rgba(255,255,255,0.4)", transform: showUserMenu ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showUserMenu && (
            <div style={{
              position: "absolute",
              bottom: "100%",
              left: 0,
              right: 0,
              background: "#112d52",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: "4px",
              marginBottom: 4,
              zIndex: 50,
            }}>
              <SidebarMenuItem
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>}
                label="Dashboard"
                onClick={() => { setShowUserMenu(false); navigate("/dashboard"); }}
              />
              <SidebarMenuItem
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                label="Settings"
                onClick={() => { setShowUserMenu(false); navigate("/settings"); }}
              />
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "2px 0" }} />
              <SidebarMenuItem
                icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
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
      {/* Desktop sidebar — always in flow */}
      <div className="hidden lg:flex" style={{ height: "100dvh", flexShrink: 0 }}>
        {inner}
      </div>
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
        gap: 8,
        padding: "7px 10px",
        borderRadius: 7,
        fontSize: 13,
        color: danger ? "#f87171" : "rgba(255,255,255,0.75)",
        textAlign: "left",
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)")}
      onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = "none")}
    >
      {icon}
      {label}
    </button>
  );
}
