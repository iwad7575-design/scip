import { Link } from "react-router-dom";

export function GuestLimitModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(4px)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20,
        boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
        maxWidth: 380, width: "100%", padding: "40px 32px",
        textAlign: "center", animation: "fadeInUp 0.3s ease both",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>

        <h2 style={{
          fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 700,
          color: "var(--text-primary)", margin: "0 0 10px",
        }}>
          You've used your 3 free questions
        </h2>

        <p style={{
          fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.65,
          margin: "0 0 24px",
        }}>
          Create a free account to get{" "}
          <strong style={{ color: "var(--text-primary)" }}>5 more free questions</strong>
          {" "}and full access to SCIP — Ethiopia's clinical AI assistant.
          <br /><br />
          Know someone on SCIP? Ask them for a referral link and get{" "}
          <strong style={{ color: "var(--text-primary)" }}>10!</strong>
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <Link
            to="/signup"
            onClick={onClose}
            style={{
              display: "block", background: "var(--brand-green)", color: "#fff",
              fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 15,
              padding: "13px 0", borderRadius: 12, textDecoration: "none",
            }}
          >
            Create Free Account →
          </Link>
          <Link
            to="/login"
            onClick={onClose}
            style={{
              display: "block", background: "var(--bg)", color: "var(--text-secondary)",
              fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 14,
              padding: "12px 0", borderRadius: 12, textDecoration: "none",
              border: "1px solid var(--border)",
            }}
          >
            Already have an account? Login
          </Link>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
          Free account • No credit card required
        </p>
      </div>
    </div>
  );
}
