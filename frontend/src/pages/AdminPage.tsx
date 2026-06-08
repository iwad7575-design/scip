import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { BACKEND_URL } from "../lib/config";

interface AdminStats {
  pending_payments: number;
  active_paid_subscriptions: number;
  total_revenue_etb_this_month: number;
  total_referrals: number;
  total_subscriptions: number;
}

const NAV_CARDS = [
  { icon: "💳", label: "Review Payments",       desc: "Approve or reject pending payment screenshots", path: "/admin/payments", badge: "pending_payments" },
  { icon: "📊", label: "Referral Analytics",    desc: "View referral codes, active subscribers, commissions", path: "/admin/referrals" },
  { icon: "🎓", label: "Student Verifications", desc: "Review student ID submissions",                 path: "/admin/students",  soon: true },
  { icon: "👥", label: "All Users",             desc: "Browse registered users and subscriptions",     path: "/admin/users" },
];

export function AdminPage() {
  const navigate = useNavigate();
  const [stats, setStats]     = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [token, setToken]     = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate("/login", { replace: true }); return; }
      setToken(session.access_token);
      try {
        const res = await fetch(`${BACKEND_URL}/admin/stats`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.status === 403) { setError("Access denied."); return; }
        if (!res.ok) { setError(`Error ${res.status}`); return; }
        setStats(await res.json());
      } catch {
        setError("Failed to load stats.");
      } finally {
        setLoading(false);
      }
    });
  }, [navigate]);

  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", padding: "32px 20px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <button
            onClick={() => navigate("/chat")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 22, padding: 0, lineHeight: 1 }}
          >←</button>
          <div>
            <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              Admin Panel
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>SCIP — internal management</p>
          </div>
        </div>

        {error && (
          <div style={{ background: "var(--destructive-bg, #fef2f2)", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 18px", color: "var(--destructive, #dc2626)", fontSize: 14, marginBottom: 24 }}>
            {error}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
          {[
            { label: "Pending Payments",       value: stats?.pending_payments,                    color: "#ef4444", icon: "⏳" },
            { label: "Paid Subscriptions",     value: stats?.active_paid_subscriptions,           color: "var(--brand-green)", icon: "✅" },
            { label: `Revenue (${month})`,     value: stats ? `${stats.total_revenue_etb_this_month.toFixed(0)} ETB` : null, color: "#7c3aed", icon: "💰" },
            { label: "Total Referrals",        value: stats?.total_referrals,                     color: "#2563eb", icon: "🔗" },
            { label: "Total Subscriptions",    value: stats?.total_subscriptions,                 color: "var(--text-primary)", icon: "👤" },
          ].map(({ label, value, color, icon }) => (
            <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
              <p style={{ margin: "0 0 6px", fontSize: 22 }}>{icon}</p>
              <p style={{ margin: "0 0 3px", fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>
                {loading ? (
                  <span style={{ display: "inline-block", width: 40, height: 22, background: "var(--border)", borderRadius: 4, verticalAlign: "middle" }} />
                ) : (value ?? "—")}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Nav cards */}
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 14, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 12px" }}>
          Management
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {NAV_CARDS.map(card => {
            const badgeCount = card.badge === "pending_payments" ? (stats?.pending_payments ?? 0) : 0;
            return (
              <button
                key={card.label}
                disabled={!!card.soon}
                onClick={() => !card.soon && navigate(card.path)}
                style={{
                  background:    "var(--surface)",
                  border:        "1px solid var(--border)",
                  borderRadius:  14,
                  padding:       "20px 18px",
                  textAlign:     "left",
                  cursor:        card.soon ? "default" : "pointer",
                  opacity:       card.soon ? 0.5 : 1,
                  transition:    "box-shadow 0.15s, transform 0.15s",
                  position:      "relative",
                }}
                onMouseEnter={e => { if (!card.soon) { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}
              >
                {badgeCount > 0 && (
                  <span style={{ position: "absolute", top: 14, right: 14, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 20 }}>
                    {badgeCount}
                  </span>
                )}
                {card.soon && (
                  <span style={{ position: "absolute", top: 14, right: 14, background: "var(--border)", color: "var(--text-muted)", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>
                    SOON
                  </span>
                )}
                <p style={{ margin: "0 0 8px", fontSize: 28 }}>{card.icon}</p>
                <p style={{ margin: "0 0 4px", fontFamily: "var(--font-heading)", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                  {card.label}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                  {card.desc}
                </p>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
