import { Link } from "react-router-dom";

const STEPS = [
  {
    n: 1,
    title: "Open scip-et.com in Chrome",
    detail: "Make sure you're using Google Chrome on Android. Type scip-et.com in the address bar.",
  },
  {
    n: 2,
    title: 'Tap the "Install" banner',
    detail: 'A navy banner appears at the bottom saying "Install SCIP for quick access during patient care". Tap the green Install button. If it doesn\'t appear, continue to step 3.',
  },
  {
    n: 3,
    title: "Tap the 3-dot menu ( ⋮ )",
    detail: 'Tap the three dots in the top-right corner of Chrome, then scroll down and tap "Add to Home Screen".',
  },
  {
    n: 4,
    title: 'Tap "Install"',
    detail: "A dialog appears with the SCIP name and icon. Tap Install to confirm.",
  },
  {
    n: 5,
    title: "Find SCIP on your home screen",
    detail: "SCIP is now installed. Open it any time from your home screen for instant access during patient care — no app store needed.",
  },
];

export function InstallPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "#0B2545", color: "#fff", display: "flex", flexDirection: "column" }}>
      <header style={{
        padding: "0.875rem 1.25rem",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        display: "flex", alignItems: "center", gap: "0.75rem",
        flexShrink: 0,
      }}>
        <img src="/logo.jpg" alt="SCIP" style={{ width: 34, height: 34, borderRadius: 8 }} />
        <span style={{ fontWeight: 700, fontSize: "1rem" }}>SCIP</span>
        <Link to="/" style={{ marginLeft: "auto", color: "rgba(255,255,255,0.55)", fontSize: "0.875rem", textDecoration: "none" }}>
          ← Back
        </Link>
      </header>

      <main style={{
        flex: 1, padding: "1.5rem 1.25rem",
        maxWidth: 500, margin: "0 auto",
        width: "100%", boxSizing: "border-box",
        overflowY: "auto",
      }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          📱 Install SCIP on Android
        </h1>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "2rem" }}>
          No app store needed. Install in 30 seconds and access 106 clinical guidelines
          directly from your home screen.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {STEPS.map(step => (
            <div key={step.n} style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: "1rem 1.125rem",
              display: "flex", gap: "1rem", alignItems: "flex-start",
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "#2ECC71", color: "#fff",
                fontWeight: 700, fontSize: "0.875rem",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {step.n}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.3rem" }}>{step.title}</div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.83rem", lineHeight: 1.55 }}>{step.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: "1.5rem",
          background: "rgba(46,204,113,0.1)",
          border: "1px solid rgba(46,204,113,0.25)",
          borderRadius: 10,
          padding: "0.875rem 1rem",
        }}>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.8)", fontSize: "0.85rem", lineHeight: 1.6 }}>
            <strong>iOS (iPhone/iPad):</strong> Open scip-et.com in Safari, tap the{" "}
            <strong>Share</strong> button (rectangle with arrow), then tap{" "}
            <strong>"Add to Home Screen"</strong>.
          </p>
        </div>

        <Link
          to="/"
          style={{
            display: "block", marginTop: "1.5rem", marginBottom: "2rem",
            background: "#2ECC71", color: "#fff", textDecoration: "none",
            textAlign: "center", borderRadius: 10,
            padding: "0.875rem", fontWeight: 700, fontSize: "0.95rem",
          }}
        >
          Open SCIP →
        </Link>
      </main>
    </div>
  );
}
