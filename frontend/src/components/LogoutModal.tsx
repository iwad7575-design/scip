import { useEffect } from "react";

interface Props {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
}

export function LogoutModal({ isOpen, onConfirm, onCancel, title, message, confirmLabel }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "32px 28px 28px",
          width: "100%",
          maxWidth: 320,
          textAlign: "center",
          position: "relative",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "none",
            border: "none",
            fontSize: 18,
            cursor: "pointer",
            color: "#888",
            lineHeight: 1,
            padding: "4px 6px",
            borderRadius: 6,
          }}
        >
          ✕
        </button>

        <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>

        <h3 style={{
          color: "#0B2545",
          fontSize: 18,
          fontWeight: 700,
          marginBottom: 8,
          fontFamily: "var(--font-heading)",
        }}>
          {title ?? "Sign out of SCIP?"}
        </h3>

        <p style={{
          color: "#666",
          fontSize: 14,
          marginBottom: 24,
          lineHeight: 1.6,
          fontFamily: "var(--font-body)",
        }}>
          {message ?? "You will need to log in again to access your chat history."}
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "12px 16px",
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "#fff",
              color: "#444",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-heading)",
              minHeight: 48,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            style={{
              flex: 1,
              padding: "12px 16px",
              border: "none",
              borderRadius: 8,
              background: "#0B2545",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "var(--font-heading)",
              minHeight: 48,
            }}
          >
            {confirmLabel ?? "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
