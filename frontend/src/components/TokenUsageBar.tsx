import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { BACKEND_URL } from "../lib/config";

interface UsageData {
  plan: string;
  questions_used: number;
  questions_limit: number;
  questions_remaining: number;
}

export function TokenUsageBar() {
  const [usage, setUsage]     = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      try {
        const res = await fetch(`${BACKEND_URL}/subscription/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) setUsage(await res.json());
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    });
  }, []);

  if (loading || !usage) return null;

  const { plan, questions_used, questions_limit, questions_remaining } = usage;
  const pct         = questions_limit > 0 ? questions_used / questions_limit : 0;
  const isLow       = pct > 0.8;
  const isMedium    = pct > 0.5 && !isLow;
  const barColor    = isLow ? "#ef4444" : isMedium ? "#f59e0b" : "var(--brand-green)";
  const planLabel   = plan.charAt(0).toUpperCase() + plan.slice(1);

  return (
    <div style={{ padding: "8px 16px 4px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
          {planLabel} plan · {questions_used}/{questions_limit} questions used
        </span>
        {isLow ? (
          <Link
            to="/pricing"
            style={{ fontSize: 11, color: barColor, fontWeight: 700, textDecoration: "none" }}
          >
            Upgrade ↗
          </Link>
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {questions_remaining} remaining
          </span>
        )}
      </div>
      <div style={{ height: 4, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height:       "100%",
          width:        `${Math.min(pct * 100, 100)}%`,
          background:   barColor,
          borderRadius: 4,
          transition:   "width 0.4s ease",
        }} />
      </div>
      {isLow && questions_remaining <= 5 && (
        <p style={{ margin: "5px 0 0", fontSize: 11, color: barColor }}>
          Only {questions_remaining} question{questions_remaining === 1 ? "" : "s"} left this month.{" "}
          <Link to="/pricing" style={{ color: barColor, fontWeight: 700 }}>Upgrade now</Link>
        </p>
      )}
    </div>
  );
}
