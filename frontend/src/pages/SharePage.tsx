import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MarkdownMessage } from "../components/MarkdownMessage";
import { SHARE_API_URL } from "../lib/config";

type Message = { role: "user" | "assistant"; content: string };

export function SharePage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setError("Invalid share link."); setLoading(false); return; }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_000);
    fetch(`${SHARE_API_URL}/${id}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => Promise.reject(e.error ?? "Not found")))
      .then(data => {
        setMessages(data.messages ?? []);
        setCreatedAt(data.created_at ?? null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error && err.name === "AbortError"
          ? "Request timed out. The server may be starting up — please try again in a moment."
          : typeof err === "string" ? err : "Share not found or has expired.";
        setError(msg);
        setLoading(false);
      })
      .finally(() => clearTimeout(timeoutId));
  }, [id]);

  const firstUserMsg = messages.find(m => m.role === "user");
  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <img src="/icon-192x192.png" alt="SCIP" style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 6 }} />
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
            SCIP
          </span>
        </a>
        <span style={{
          fontSize: 12, fontFamily: "var(--font-heading)", fontWeight: 500,
          color: "var(--text-muted)", background: "var(--bg)",
          border: "1px solid var(--border)", borderRadius: 20, padding: "3px 10px",
        }}>
          Shared conversation
        </span>
      </header>

      {/* Content */}
      <main style={{ flex: 1, maxWidth: 720, width: "100%", margin: "0 auto", padding: "32px 16px 48px" }}>
        {loading && (
          <div style={{ textAlign: "center", paddingTop: 80, color: "var(--text-muted)", fontFamily: "var(--font-heading)", fontSize: 14 }}>
            Loading…
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              Link not found
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>
              {error}
            </p>
            <Link
              to="/chat"
              style={{
                display: "inline-block", padding: "10px 24px", background: "var(--brand-navy)",
                color: "#fff", borderRadius: 8, fontFamily: "var(--font-heading)", fontWeight: 600,
                fontSize: 14, textDecoration: "none",
              }}
            >
              Ask SCIP
            </Link>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Conversation title */}
            {firstUserMsg && (
              <div style={{ marginBottom: 24 }}>
                <h1 style={{
                  fontFamily: "var(--font-heading)", fontSize: "clamp(18px, 4vw, 24px)",
                  fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.35, marginBottom: 6,
                }}>
                  {firstUserMsg.content.slice(0, 120)}{firstUserMsg.content.length > 120 ? "…" : ""}
                </h1>
                {formattedDate && (
                  <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
                    Shared from SCIP · {formattedDate}
                  </p>
                )}
              </div>
            )}

            {/* Messages */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {messages.map((msg, i) =>
                msg.role === "user" ? (
                  <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ maxWidth: "82%" }}>
                      <div style={{
                        background: "var(--brand-navy)", color: "#ffffff",
                        padding: "12px 16px", borderRadius: "18px 18px 4px 18px",
                        fontSize: 15, fontFamily: "var(--font-body)", lineHeight: 1.6, whiteSpace: "pre-wrap",
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", background: "var(--brand-navy)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
                    }}>
                      <img src="/icon-192x192.png" alt="SCIP" style={{ width: 18, height: 18, objectFit: "contain", borderRadius: 4 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        background: "var(--surface)", border: "1px solid var(--border)",
                        borderRadius: "4px 18px 18px 18px", padding: "12px 16px",
                        fontFamily: "var(--font-body)", color: "var(--text-primary)",
                        boxShadow: "var(--shadow-xs)",
                      }}>
                        <MarkdownMessage content={msg.content} />
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Disclaimer */}
            <div style={{
              marginTop: 32, padding: "14px 16px", borderRadius: 10,
              background: "rgba(11,37,69,0.04)", border: "1px solid var(--border)",
            }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
                ⚠️ <strong>Clinical Disclaimer:</strong> SCIP is an AI-powered clinical decision support tool based on Ethiopian MoH and WHO guidelines. Always apply professional clinical judgment. Do not share patient-identifiable information.
              </p>
            </div>

            {/* CTA */}
            <div style={{ marginTop: 32, textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 14, fontFamily: "var(--font-body)" }}>
                Have a clinical question?
              </p>
              <Link
                to="/chat"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "12px 28px", background: "var(--brand-green)",
                  color: "#ffffff", borderRadius: 10, textDecoration: "none",
                  fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 15,
                }}
              >
                Ask SCIP
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid var(--border)", padding: "16px 20px", textAlign: "center",
        background: "var(--surface)",
      }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
          Built by{" "}
          <a href="/" style={{ color: "var(--brand-green)", textDecoration: "none" }}>SHIFA Clinical Intelligence</a>
          {" "}· Ethiopia's first AI-powered clinical decision support platform
        </p>
      </footer>
    </div>
  );
}
