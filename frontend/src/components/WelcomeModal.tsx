import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  freeQuestions?: number;
  wasReferred?: boolean;
}

export function WelcomeModal({ isOpen, onClose, freeQuestions = 10, wasReferred = false }: WelcomeModalProps) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    if (!isOpen) return;
    setCountdown(8);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleStart();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  function handleStart() {
    onClose();
    navigate("/chat");
  }

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
        maxWidth: 420, width: "100%", overflow: "hidden",
        animation: "fadeInUp 0.35s ease both",
      }}>
        {/* Header */}
        <div style={{
          background: "var(--brand-navy)", padding: "32px 32px 24px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>🩺</div>
          <h1 style={{
            fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 700,
            color: "#fff", margin: "0 0 4px",
          }}>
            Welcome to SCIP
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--brand-green)", fontWeight: 600 }}>
            SHIFA Clinical Intelligence Platform
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 32px 28px" }}>
          <p style={{
            margin: "0 0 20px", fontSize: 14, color: "var(--text-secondary)",
            textAlign: "center", lineHeight: 1.65,
          }}>
            Your AI-powered clinical assistant — trained on{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              109 validated Ethiopian MoH guidelines
            </strong>
            {" "}and{" "}
            <strong style={{ color: "var(--text-primary)" }}>WHO protocols</strong>
            . Get instant answers on diagnosis, treatment, and drug doses.
          </p>

          {/* Free questions badge */}
          <div style={{
            background: "var(--success-bg)", border: "1px solid #bbf7d0",
            borderRadius: 12, padding: "14px 16px", marginBottom: 20, textAlign: "center",
          }}>
            {wasReferred ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--success)", marginBottom: 4 }}>
                  🎁 10 Free Questions
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#166534" }}>
                  Added to your account as a referral bonus!
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--success)", marginBottom: 4 }}>
                  🎁 5 Free Questions to get started!
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#166534" }}>
                  Want more? Refer a colleague and they get 10!
                </p>
              </>
            )}
          </div>

          {/* Feature pills */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 8,
            justifyContent: "center", marginBottom: 24,
          }}>
            {["🇪🇹 Ethiopian MoH", "🌐 WHO Guidelines", "💊 Drug Doses", "🔒 Secure", "📱 Mobile Ready"].map(f => (
              <span key={f} style={{
                background: "var(--bg)", border: "1px solid var(--border)",
                color: "var(--text-secondary)", fontSize: 12, padding: "4px 12px",
                borderRadius: 999, fontFamily: "var(--font-heading)", fontWeight: 500,
              }}>
                {f}
              </span>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={handleStart}
            className="btn-primary"
            style={{ width: "100%", fontSize: 15, marginBottom: 10 }}
          >
            Start Asking SCIP →
          </button>

          <p style={{ margin: 0, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
            Taking you to SCIP in {countdown} seconds…
          </p>
        </div>
      </div>
    </div>
  );
}
