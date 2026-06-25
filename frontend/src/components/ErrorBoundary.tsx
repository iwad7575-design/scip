import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          padding: "24px",
        }}>
          <div style={{ textAlign: "center", maxWidth: 360 }}>
            <img src="/icon-192x192.png" alt="SCIP" style={{ width: 48, height: 48, objectFit: "contain", marginBottom: 20, borderRadius: 10 }} />
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 24 }}>
              SCIP encountered an unexpected error. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 24px",
                background: "var(--brand-navy)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-lg)",
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
