import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { BACKEND_URL } from "../lib/config";

interface ReferralData {
  code: string;
  link: string;
}
interface ReferralStats {
  total_referrals: number;
  active_referrals: number;
  pending_earnings_etb: number;
  total_paid_etb: number;
  monthly_earning_potential: number;
  free_questions_remaining: number;
}

export function ReferralCard() {
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [stats, setStats]               = useState<ReferralStats | null>(null);
  const [copied, setCopied]             = useState(false);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        setError("You must be logged in to view referral info.");
        setLoading(false);
        return;
      }
      const headers = { Authorization: `Bearer ${session.access_token}` };

      async function loadData() {
        const [codeRes, statsRes] = await Promise.all([
          fetch(`${BACKEND_URL}/referral/code`,  { headers }),
          fetch(`${BACKEND_URL}/referral/stats`, { headers }),
        ]);
        if (!codeRes.ok)  throw new Error(`Referral code endpoint returned ${codeRes.status}`);
        if (!statsRes.ok) throw new Error(`Referral stats endpoint returned ${statsRes.status}`);
        const [code, s] = await Promise.all([codeRes.json(), statsRes.json()]);
        if (!code.link) throw new Error("Unexpected response from referral/code");
        setReferralData(code);
        setStats(s);
      }

      loadData()
        .catch(err => {
          console.error("[ReferralCard]", err);
          setError("Could not load referral data. Please refresh the page.");
        })
        .finally(() => setLoading(false));
    }).catch(() => {
      setError("Could not load referral data. Please refresh the page.");
      setLoading(false);
    });
  }, []);

  function copyLink() {
    if (!referralData?.link) return;
    navigator.clipboard.writeText(referralData.link).catch(() => {
      const el = document.createElement("input");
      el.value = referralData.link;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    const msg = encodeURIComponent(
      `Join me on SCIP 🇪🇹 — AI clinical assistant trained on 109 Ethiopian & WHO guidelines. 20 free questions every month: ${referralData?.link}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  if (loading) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: "var(--radius-2xl)", padding: "40px 24px", textAlign: "center", border: "1px solid var(--border)" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--brand-green)", margin: "0 auto 14px", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>Loading your referral info…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: "var(--radius-2xl)", padding: "32px 24px", textAlign: "center", border: "1px solid var(--border)" }}>
        <p style={{ margin: "0 0 14px", fontSize: 22 }}>⚠️</p>
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--destructive)", fontWeight: 500 }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: "8px 20px", background: "var(--brand-navy)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", fontSize: 13, fontFamily: "var(--font-heading)", fontWeight: 600, cursor: "pointer" }}
        >
          Refresh
        </button>
      </div>
    );
  }

  if (!referralData) return null;

  return (
    <div style={{ background: "var(--surface)", borderRadius: "var(--radius-2xl)", padding: "22px 24px", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 24 }}>🎁</span>
        <div>
          <h3 style={{ fontFamily: "var(--font-heading)", margin: 0, fontSize: 17, fontWeight: 700, color: "var(--brand-navy-700)" }}>
            Refer & Earn
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>Earn 10% of their subscription fee every month</p>
        </div>
      </div>

      {/* How it works */}
      <div style={{ background: "var(--success-bg)", border: "1px solid #bbf7d0", borderRadius: "var(--radius-lg)", padding: "12px 14px", marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--success)", lineHeight: 1.5 }}>
          Share your link → colleague signs up → <strong>they get 20 free questions/month</strong> → <strong>you earn 10% of their subscription fee every month</strong> they stay subscribed
        </p>
      </div>

      {/* Referral link */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6, fontFamily: "var(--font-heading)", fontWeight: 500 }}>
          Your referral link
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            readOnly
            value={referralData.link}
            style={{
              flex: 1, fontSize: 13, background: "var(--bg)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", padding: "9px 12px", color: "var(--text-secondary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              fontFamily: "var(--font-body)", outline: "none",
            }}
          />
          <button
            onClick={copyLink}
            style={{
              padding: "9px 16px", background: copied ? "var(--brand-green)" : "var(--bg)",
              border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
              fontSize: 13, fontFamily: "var(--font-heading)", fontWeight: 600,
              cursor: "pointer", whiteSpace: "nowrap", color: copied ? "#fff" : "var(--text-primary)",
              transition: "background var(--transition-fast), color var(--transition-fast)",
            }}
          >
            {copied ? "✅ Copied!" : "📋 Copy"}
          </button>
        </div>
      </div>

      {/* Share buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          onClick={shareWhatsApp}
          style={{
            flex: 1, background: "#25D366", color: "#fff", border: "none",
            borderRadius: "var(--radius-md)", padding: "10px 0", fontSize: 13,
            fontFamily: "var(--font-heading)", fontWeight: 600, cursor: "pointer",
          }}
        >
          💬 Share on WhatsApp
        </button>
        <button
          onClick={copyLink}
          style={{
            flex: 1, background: "var(--brand-navy)", color: "#fff", border: "none",
            borderRadius: "var(--radius-md)", padding: "10px 0", fontSize: 13,
            fontFamily: "var(--font-heading)", fontWeight: 600, cursor: "pointer",
          }}
        >
          📋 Copy Link
        </button>
      </div>

      {/* Stats */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { value: stats?.total_referrals ?? 0,                   label: "Total referrals",    color: "var(--text-primary)" },
            { value: stats?.active_referrals ?? 0,                  label: "Active subscribers", color: "var(--brand-green)" },
            { value: `${stats?.pending_earnings_etb ?? 0} ETB`,     label: "Pending earnings",   color: "#d97706" },
            { value: `${stats?.total_paid_etb ?? 0} ETB`,           label: "Total paid out",     color: "var(--brand-green)" },
          ].map(({ value, label, color }) => (
            <div key={label} style={{ background: "var(--bg)", borderRadius: "var(--radius-md)", padding: "12px 14px", border: "1px solid var(--border)" }}>
              <p style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 700, color }}>{value}</p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{label}</p>
            </div>
          ))}
        </div>

        {(stats?.monthly_earning_potential ?? 0) > 0 && (
          <div style={{ marginTop: 10, background: "var(--success-bg)", border: "1px solid #bbf7d0", borderRadius: "var(--radius-md)", padding: "10px 14px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--success)" }}>
              📈 You are earning <strong>{stats!.monthly_earning_potential.toFixed(1)} ETB/month</strong> from active referrals
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
