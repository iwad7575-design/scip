import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

const EXAMPLE_QUESTIONS = [
  { icon: "🍼", category: "Pediatrics",         text: "Management of severe acute malnutrition in children under 5" },
  { icon: "🦟", category: "Infectious Disease",  text: "First line treatment for malaria in pregnant women in Ethiopia" },
  { icon: "👶", category: "Neonatology",         text: "Signs and management of neonatal sepsis" },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [user, setUser]       = useState<User | null | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (user === undefined) return null;

  const meta     = (user?.user_metadata ?? {}) as Record<string, string>;
  const fullName = meta.full_name || user?.email?.split("@")[0] || "";

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lp-fade-0 { animation: fadeInUp 0.55s ease 0.00s both; }
        .lp-fade-1 { animation: fadeInUp 0.55s ease 0.10s both; }
        .lp-fade-2 { animation: fadeInUp 0.55s ease 0.20s both; }
        .lp-fade-3 { animation: fadeInUp 0.55s ease 0.30s both; }
        .lp-fade-4 { animation: fadeInUp 0.55s ease 0.42s both; }
        .lp-fade-5 { animation: fadeInUp 0.55s ease 0.54s both; }
      `}</style>

      <div style={{
        minHeight: "100dvh",
        background: "linear-gradient(155deg, #0B2545 0%, #1B3A6B 100%)",
        display: "flex",
        flexDirection: "column",
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(155deg, #0B2545 0%, #1B3A6B 100%)",
        backgroundSize: "28px 28px, 100% 100%",
      }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header style={{
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(11,37,69,0.85)",
          backdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <img src="/logo.png" alt="SCIP" style={{ width: 28, height: 28, objectFit: "contain" }} />
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 15, color: "#ffffff" }}>
              SCIP
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  style={{
                    padding: "7px 14px", fontSize: 13, fontFamily: "var(--font-heading)",
                    fontWeight: 500, borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.25)",
                    color: "rgba(255,255,255,0.8)", background: "transparent", textDecoration: "none",
                  }}
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => navigate("/chat")}
                  style={{
                    padding: "7px 16px", fontSize: 13, fontFamily: "var(--font-heading)",
                    fontWeight: 600, borderRadius: 8, background: "var(--brand-green)",
                    color: "#ffffff", border: "none", cursor: "pointer",
                  }}
                >
                  Go to SCIP →
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  style={{
                    padding: "7px 16px", fontSize: 13, fontFamily: "var(--font-heading)",
                    fontWeight: 500, borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "rgba(255,255,255,0.85)", background: "transparent", textDecoration: "none",
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
              </>
            )}
          </div>
        </header>

        {/* ── Main content ───────────────────────────────────────────────────── */}
        <div className="scip-scrollbar" style={{ flex: 1, overflowY: "auto" }}>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "48px 16px 48px", maxWidth: 680, margin: "0 auto", width: "100%",
          }}>

            {/* Welcome back banner (logged-in users) */}
            {user && (
              <div
                className={mounted ? "lp-fade-0" : ""}
                style={{
                  width: "100%", marginBottom: 28,
                  padding: "14px 20px",
                  background: "rgba(46,204,113,0.12)",
                  border: "1px solid rgba(46,204,113,0.3)",
                  borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontFamily: "var(--font-heading)", color: "#ffffff", fontSize: 14 }}>
                  Welcome back{fullName ? `, ${fullName}` : ""} 👋
                </span>
                <button
                  onClick={() => navigate("/chat")}
                  style={{
                    padding: "8px 18px", fontSize: 13, fontFamily: "var(--font-heading)",
                    fontWeight: 600, borderRadius: 8, background: "var(--brand-green)",
                    color: "#ffffff", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  Go to SCIP
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}

            {/* Logo + headline */}
            <div
              className={mounted ? "lp-fade-0" : ""}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
            >
              <img
                src="/logo.png" alt="SCIP"
                style={{ width: 68, height: 68, objectFit: "contain", marginBottom: 22 }}
              />
              <h1 style={{
                fontFamily: "var(--font-heading)", fontSize: "clamp(26px, 5.5vw, 44px)",
                fontWeight: 800, color: "#ffffff", lineHeight: 1.15, marginBottom: 10, maxWidth: 560,
              }}>
                Ethiopia's First AI-Powered
                <br />
                <span style={{ color: "var(--brand-green)" }}>Clinical Decision Support</span>
              </h1>
              <p style={{
                fontFamily: "var(--font-heading)", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: "rgba(255,255,255,0.45)", margin: "0 0 6px",
              }}>
                Built by Ethiopian Health Professionals, for Ethiopian Frontline Care
              </p>
            </div>

            {/* Description */}
            <p
              className={mounted ? "lp-fade-1" : ""}
              style={{
                marginTop: 18, fontSize: 14.5, lineHeight: 1.75, textAlign: "center",
                maxWidth: 520, color: "rgba(255,255,255,0.62)",
              }}
            >
              SCIP draws on{" "}
              <span style={{ fontWeight: 700, color: "#ffffff" }}>106 validated national guidelines</span>
              , clinical manuals, and protocols. Every answer comes from{" "}
              <span style={{ fontWeight: 700, color: "#ffffff" }}>Ethiopian Ministry of Health and WHO-validated sources</span>
              {" "}— not from the internet.
            </p>

            {/* Stats chips */}
            <div
              className={mounted ? "lp-fade-2" : ""}
              style={{ marginTop: 22, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}
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
              className={mounted ? "lp-fade-2" : ""}
              style={{ marginTop: 10, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6 }}
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

            {/* Primary CTA */}
            <div
              className={mounted ? "lp-fade-3" : ""}
              style={{ marginTop: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%", maxWidth: 360 }}
            >
              <button
                onClick={() => navigate("/chat")}
                style={{
                  width: "100%", padding: "14px 24px",
                  background: "var(--brand-green)", color: "#ffffff", border: "none",
                  borderRadius: 12, fontFamily: "var(--font-heading)", fontWeight: 700,
                  fontSize: 15, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: "0 4px 20px rgba(46,204,113,0.35)",
                  transition: "background var(--transition-fast), transform var(--transition-fast)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--brand-green-700)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--brand-green)"; }}
              >
                Start Using SCIP
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
              {!user && (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-heading)", margin: 0 }}>
                  No account needed to start.{" "}
                  <Link to="/signup" style={{ color: "var(--brand-green)", textDecoration: "none" }}>Sign up</Link>
                  {" "}to save your history.
                </p>
              )}
            </div>

            {/* Example questions */}
            <div
              className={mounted ? "lp-fade-4" : ""}
              style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 8, width: "100%" }}
            >
              <p style={{
                fontFamily: "var(--font-heading)", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: "rgba(255,255,255,0.35)", textAlign: "center", margin: "0 0 4px",
              }}>
                Try asking
              </p>
              {EXAMPLE_QUESTIONS.map(q => (
                <button
                  key={q.text}
                  onClick={() => navigate("/chat")}
                  style={{
                    textAlign: "left", padding: "12px 14px", borderRadius: 12,
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
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

            {/* Footer */}
            <p
              className={mounted ? "lp-fade-5" : ""}
              style={{
                marginTop: 36, marginBottom: 8, fontSize: 11, textAlign: "center",
                maxWidth: 480, color: "rgba(255,255,255,0.22)", lineHeight: 1.6,
              }}
            >
              ⚕️ SCIP supports clinical decisions — it does not replace clinical judgment or specialist consultation.{" "}
              Developed by SHIFA | scip-et.com
            </p>
            <Link to="/install" style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textDecoration: "none", marginBottom: 24 }}>
              📱 Install the App
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
