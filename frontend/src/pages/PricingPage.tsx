import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { BACKEND_URL } from "../lib/config";

interface Plan {
  id: string;
  name: string;
  tier: string;
  price_etb: number;
  original_price?: number;
  promo_active?: boolean;
  token_limit: number;
  question_estimate: number;
  features: string[];
}

const TIER_ORDER = [
  "free", "student", "clinician", "pro",
  "institution", "institution_starter", "institution_standard", "institution_enterprise",
];

const TIER_ACCENT: Record<string, string> = {
  free:        "#6b7280",
  student:     "#2563eb",
  clinician:   "var(--brand-green)",
  pro:         "#7c3aed",
  institution: "#d97706",
};

export function PricingPage() {
  const navigate = useNavigate();
  const [plans, setPlans]             = useState<Plan[]>([]);
  const [loading, setLoading]         = useState(true);
  const [currentTier, setCurrentTier] = useState<string | null>(null);
  const [loggedIn, setLoggedIn]       = useState(false);
  const [hasPromo, setHasPromo]       = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/plans`)
      .then(r => r.json())
      .then(d => {
        const raw = (d.plans ?? []) as Plan[];
        const sorted = [...raw].sort(
          (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
        );
        setPlans(sorted);
        setHasPromo(raw.some(p => p.promo_active && p.original_price));
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      setLoggedIn(true);
      try {
        const res = await fetch(`${BACKEND_URL}/subscription/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const d = await res.json();
          setCurrentTier(d.plan ?? "free");
        }
      } catch { /* ignore */ }
    });
  }, []);

  function handleSubscribe(tier: string) {
    if (tier === "free") return;
    if (!loggedIn) { navigate(`/signup?next=/subscribe/${tier}`); return; }
    navigate(`/subscribe/${tier}`);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", padding: "40px 20px" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .plan-card { transition: transform 0.15s, box-shadow 0.15s; }
        .plan-card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
        .sub-btn { transition: background 0.15s, opacity 0.15s; }
        .sub-btn:hover:not(:disabled) { opacity: 0.88; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ position: "absolute", left: 24, top: 24, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 22, padding: 4 }}
          >←</button>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "var(--brand-green)", letterSpacing: 1, textTransform: "uppercase" }}>
            Pricing
          </p>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 32, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 12px" }}>
            Choose your SCIP plan
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: "var(--text-secondary)", maxWidth: 520, marginInline: "auto" }}>
            Access all 109 Ethiopian clinical guidelines. Pay monthly via Telebirr, CBE, or bank transfer.
          </p>
        </div>

        {/* Launch promo banner */}
        {hasPromo && (
          <div style={{
            background: "linear-gradient(135deg, #d97706, #f59e0b)",
            color: "#fff", borderRadius: 12, padding: "13px 20px",
            textAlign: "center", marginBottom: 24,
            fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14,
          }}>
            Launch Promotion — Prices shown include your discount. Limited time only.
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--brand-green)", borderRadius: "50%", margin: "0 auto", animation: "spin 0.8s linear infinite" }} />
          </div>
        )}

        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, alignItems: "start" }}>
            {plans.map(plan => {
              const accent    = TIER_ACCENT[plan.tier] ?? "var(--brand-green)";
              const isPopular = plan.tier === "clinician";
              const isCurrent = currentTier === plan.tier;
              const isFree    = plan.tier === "free";
              const isStudent = plan.tier === "student";

              return (
                <div
                  key={plan.tier}
                  className="plan-card"
                  style={{
                    background:    "var(--surface)",
                    border:        isPopular ? `2px solid ${accent}` : "1px solid var(--border)",
                    borderRadius:  16,
                    padding:       "24px 20px 20px",
                    position:      "relative",
                    display:       "flex",
                    flexDirection: "column",
                    gap:           12,
                  }}
                >
                  {isPopular && (
                    <div style={{
                      position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
                      background: accent, color: "#fff", fontSize: 11, fontWeight: 700,
                      padding: "3px 14px", borderRadius: 20, whiteSpace: "nowrap", letterSpacing: 0.5,
                    }}>
                      MOST POPULAR
                    </div>
                  )}

                  {isCurrent && (
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      background: "var(--success-bg)", color: "var(--success)",
                      fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                    }}>
                      Current
                    </div>
                  )}

                  {/* Plan name & accent bar */}
                  <div style={{ borderLeft: `3px solid ${accent}`, paddingLeft: 10 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: 0.8 }}>
                      {plan.name}
                    </p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap", marginTop: 4 }}>
                      <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                        {plan.price_etb === 0 ? "Free" : `${plan.price_etb} ETB`}
                        {plan.price_etb > 0 && <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>/mo</span>}
                      </p>
                      {plan.promo_active && plan.original_price && (
                        <span style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "line-through" }}>
                          {plan.original_price} ETB
                        </span>
                      )}
                    </div>
                    {plan.promo_active && plan.original_price && (
                      <div style={{
                        display: "inline-block", marginTop: 5,
                        background: "#fef3c7", color: "#92400e",
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                      }}>
                        {Math.round((1 - plan.price_etb / plan.original_price) * 100)}% off
                      </div>
                    )}
                  </div>

                  {/* Question estimate */}
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                      ~{plan.question_estimate.toLocaleString()} questions/month
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                      ({(plan.token_limit / 1000).toFixed(0)}k tokens)
                    </p>
                  </div>

                  {/* Features */}
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                    {plan.features.map((f, i) => (
                      <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 13, color: "var(--text-secondary)" }}>
                        <span style={{ color: accent, fontSize: 14, lineHeight: 1.3, flexShrink: 0 }}>✓</span>
                        {f}
                      </li>
                    ))}
                    {isStudent && (
                      <li style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: "#d97706", marginTop: 4 }}>
                        <span style={{ flexShrink: 0 }}>⚠</span>
                        Requires student ID verification
                      </li>
                    )}
                  </ul>

                  {/* CTA button */}
                  <button
                    className="sub-btn"
                    disabled={isCurrent || isFree}
                    onClick={() => handleSubscribe(plan.tier)}
                    style={{
                      marginTop:    8,
                      padding:      "11px 0",
                      borderRadius: 10,
                      border:       "none",
                      cursor:       isCurrent || isFree ? "default" : "pointer",
                      fontFamily:   "var(--font-heading)",
                      fontWeight:   700,
                      fontSize:     14,
                      background:   isCurrent ? "var(--border)" : isFree ? "var(--surface-2, #f3f4f6)" : accent,
                      color:        isCurrent || isFree ? "var(--text-muted)" : "#fff",
                    }}
                  >
                    {isCurrent ? "Your plan" : isFree ? "Default for all users" : `Subscribe — ${plan.price_etb} ETB/mo`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        <p style={{ textAlign: "center", marginTop: 40, fontSize: 13, color: "var(--text-muted)" }}>
          Payments are manually reviewed and activated within 1–24 hours.
          Questions? Contact us at <strong>support@scip-et.com</strong>
        </p>
      </div>
    </div>
  );
}
