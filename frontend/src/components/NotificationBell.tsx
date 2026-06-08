import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { BACKEND_URL } from "../lib/config";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export function NotificationBell({ heroMode }: { heroMode?: boolean }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen]   = useState(false);
  const [token, setToken] = useState("");
  const dropdownRef       = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) setToken(session.access_token);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function load() {
    try {
      const res = await fetch(`${BACKEND_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotifications((await res.json()).notifications ?? []);
    } catch { /* silent */ }
  }

  async function markAllRead() {
    try {
      await fetch(`${BACKEND_URL}/notifications/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* silent */ }
  }

  const unread = notifications.filter(n => !n.read).length;
  const iconColor = heroMode ? "rgba(255,255,255,0.85)" : "var(--text-secondary)";

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => {
          const opening = !open;
          setOpen(opening);
          if (opening && unread > 0) markAllRead();
        }}
        style={{
          position: "relative", background: "none", border: "none",
          cursor: "pointer", padding: 6, borderRadius: 6,
          display: "flex", alignItems: "center", color: iconColor,
        }}
        title="Notifications"
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2,
            background: "#ef4444", color: "#fff",
            fontSize: 10, fontWeight: 800,
            width: 16, height: 16, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: 320, background: "var(--surface)",
          border: "1px solid var(--border)", borderRadius: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)", zIndex: 1000, overflow: "hidden",
        }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
              Notifications
            </span>
            {notifications.length > 0 && (
              <button
                onClick={markAllRead}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)", padding: 0 }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, padding: "24px 16px", margin: 0 }}>
                No notifications yet.
              </p>
            ) : notifications.map(n => (
              <div key={n.id} style={{
                padding: "12px 16px", borderBottom: "1px solid var(--border)",
                background: n.read ? "transparent" : "rgba(46,204,113,0.06)",
              }}>
                <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
                  {n.title}
                </p>
                <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {n.message}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
                  {new Date(n.created_at).toLocaleDateString("en-ET", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
