import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { BACKEND_URL } from "../lib/config";

interface UserRow {
  user_id: string;
  email: string;
  plan_tier: string;
  status: string;
  tokens_used_this_month: number;
  tokens_limit: number;
  current_period_end: string | null;
  last_sign_in: string | null;
  created_at: string;
}

const TIER_COLORS: Record<string, string> = {
  free:        "#6b7280",
  student:     "#2563eb",
  clinician:   "var(--brand-green)",
  pro:         "#7c3aed",
  institution: "#d97706",
};

export function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [search, setSearch]   = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate("/login", { replace: true }); return; }
      try {
        const res = await fetch(`${BACKEND_URL}/admin/users`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.status === 403) { setError("Access denied. Admin only."); return; }
        if (!res.ok) { setError(`Server error: ${res.status}`); return; }
        const d = await res.json();
        setUsers(d.users ?? []);
      } catch {
        setError("Failed to load users.");
      } finally {
        setLoading(false);
      }
    });
  }, [navigate]);

  const filtered = users.filter(u =>
    !search || u.email.toLowerCase().includes(search.toLowerCase()) || u.plan_tier.includes(search)
  );

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", padding: "32px 20px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={() => navigate("/admin")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 22, padding: 0 }}>←</button>
          <div>
            <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              All Users
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
              {loading ? "Loading…" : `${users.length} users with subscriptions`}
            </p>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by email or plan…"
            style={{ marginLeft: "auto", padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text-primary)", fontSize: 13, outline: "none", width: 240 }}
          />
        </div>

        {error && (
          <div style={{ background: "var(--destructive-bg, #fef2f2)", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 18px", color: "var(--destructive, #dc2626)", fontSize: 14, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
            <div style={{ width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "var(--brand-green)", borderRadius: "50%", margin: "0 auto 14px", animation: "spin 0.8s linear infinite" }} />
            <p style={{ margin: 0, fontSize: 14 }}>Loading users…</p>
          </div>
        )}

        {!loading && !error && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg)" }}>
                    {["Email", "Plan", "Usage", "Period End", "Last Sign In", "Joined"].map(h => (
                      <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontFamily: "var(--font-heading)", fontWeight: 600, color: "var(--text-secondary)", fontSize: 11, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", letterSpacing: 0.3 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No users found.</td></tr>
                  ) : filtered.map((u, i) => {
                    const usedPct = u.tokens_limit > 0 ? Math.round((u.tokens_used_this_month / u.tokens_limit) * 100) : 0;
                    return (
                      <tr key={u.user_id} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "11px 14px", color: "var(--text-primary)", fontSize: 13 }}>{u.email}</td>
                        <td style={{ padding: "11px 14px" }}>
                          <span style={{ background: "var(--bg)", border: `1px solid ${TIER_COLORS[u.plan_tier] ?? "var(--border)"}`, color: TIER_COLORS[u.plan_tier] ?? "var(--text-primary)", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>
                            {u.plan_tier}
                          </span>
                        </td>
                        <td style={{ padding: "11px 14px", minWidth: 120 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                              <div style={{ height: "100%", borderRadius: 2, width: `${Math.min(usedPct, 100)}%`, background: usedPct > 80 ? "#ef4444" : usedPct > 50 ? "#f59e0b" : "var(--brand-green)" }} />
                            </div>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{usedPct}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "11px 14px", color: "var(--text-muted)", whiteSpace: "nowrap", fontSize: 12 }}>
                          {u.current_period_end ? new Date(u.current_period_end).toLocaleDateString("en-ET", { month: "short", day: "numeric" }) : "—"}
                        </td>
                        <td style={{ padding: "11px 14px", color: "var(--text-muted)", whiteSpace: "nowrap", fontSize: 12 }}>
                          {u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString("en-ET", { month: "short", day: "numeric" }) : "—"}
                        </td>
                        <td style={{ padding: "11px 14px", color: "var(--text-muted)", whiteSpace: "nowrap", fontSize: 12 }}>
                          {new Date(u.created_at).toLocaleDateString("en-ET", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
