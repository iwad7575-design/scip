import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { BACKEND_URL } from "../lib/config";

interface ReferralStat {
  code: string;
  referrer_id: string;
  total: number;
  active: number;
  pending: number;
}

interface StatsResponse {
  referral_codes: ReferralStat[];
  total_referrals: number;
  total_active: number;
}

const COMMISSION_PER_ACTIVE = 25;

export function AdminReferralsPage() {
  const navigate = useNavigate();
  const [stats, setStats]     = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate("/login", { replace: true }); return; }
      try {
        const res = await fetch(`${BACKEND_URL}/admin/referral-stats`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.status === 403) { setError("Access denied. Admin only."); return; }
        if (!res.ok) { setError(`Server error: ${res.status}`); return; }
        setStats(await res.json());
      } catch {
        setError("Failed to load referral data. Check your connection.");
      } finally {
        setLoading(false);
      }
    });
  }, [navigate]);

  const totalCommission = (stats?.referral_codes ?? []).reduce(
    (sum, r) => sum + r.active * COMMISSION_PER_ACTIVE, 0
  );

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", padding: "32px 24px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <button
            onClick={() => navigate("/admin")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 22, padding: 0, lineHeight: 1 }}
          >←</button>
          <div>
            <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Referral Analytics
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>Referral program overview</p>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
            <div style={{ width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "var(--brand-green)", borderRadius: "50%", margin: "0 auto 14px", animation: "spin 0.8s linear infinite" }} />
            <p style={{ margin: 0, fontSize: 14 }}>Loading referral data…</p>
          </div>
        )}

        {error && (
          <div style={{ background: "var(--destructive-bg)", border: "1px solid #fecaca", borderRadius: 12, padding: "20px 24px", color: "var(--destructive)", fontSize: 15, fontWeight: 500 }}>
            {error}
          </div>
        )}

        {stats && !loading && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
              {[
                { label: "Total Referrals",    value: stats.total_referrals,    color: "var(--text-primary)" },
                { label: "Active Subscribers", value: stats.total_active,        color: "var(--brand-green)" },
                { label: "Commission Owed",    value: `${totalCommission} ETB`,  color: "#d97706" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 700, color }}>{value}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{label}</p>
                </div>
              ))}
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                  Referral Codes
                </h2>
              </div>
              {stats.referral_codes.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No referrals yet.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--bg)" }}>
                        {["Code", "Referrer ID", "Total", "Active", "Pending", "Commission Owed"].map(h => (
                          <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontFamily: "var(--font-heading)", fontWeight: 600, color: "var(--text-secondary)", fontSize: 12, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.referral_codes.map((row, i) => (
                        <tr key={row.code} style={{ background: i % 2 === 0 ? "var(--surface)" : "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "12px 16px", fontFamily: "var(--font-heading)", fontWeight: 700, color: "var(--brand-navy-700)", letterSpacing: 1 }}>{row.code}</td>
                          <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>{row.referrer_id.slice(0, 8)}…</td>
                          <td style={{ padding: "12px 16px", color: "var(--text-primary)", fontWeight: 600, textAlign: "center" }}>{row.total}</td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <span style={{ background: "var(--success-bg)", color: "var(--success)", fontWeight: 700, padding: "2px 10px", borderRadius: 20, fontSize: 12 }}>{row.active}</span>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <span style={{ background: "#fef3c7", color: "#92400e", fontWeight: 700, padding: "2px 10px", borderRadius: 20, fontSize: 12 }}>{row.pending}</span>
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "#d97706", textAlign: "right" }}>{row.active * COMMISSION_PER_ACTIVE} ETB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
