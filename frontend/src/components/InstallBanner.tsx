import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "scip_install_dismissed";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const isAndroid = /android/i.test(navigator.userAgent);
    if (!isAndroid) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const ts = localStorage.getItem(DISMISS_KEY);
    if (ts && Date.now() - Number(ts) < SEVEN_DAYS) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
    if (outcome === "accepted") setSuccess(true);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  if (success) {
    return (
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
        background: "#2ECC71", color: "#fff",
        padding: "1rem 1.25rem", textAlign: "center",
        fontWeight: 600, fontSize: "0.9rem",
      }}>
        SCIP installed successfully! Find it on your home screen.
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "#0B2545",
      borderTop: "1px solid rgba(255,255,255,0.15)",
      padding: "0.75rem 1rem",
      display: "flex", alignItems: "center", gap: "0.75rem",
    }}>
      <img src="/icon-192x192.png" alt="SCIP" style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0 }} />
      <p style={{ flex: 1, margin: 0, color: "#fff", fontSize: "0.85rem", lineHeight: 1.4 }}>
        Install SCIP for quick access during patient care
      </p>
      <button
        onClick={handleInstall}
        style={{
          flexShrink: 0, background: "#2ECC71", color: "#fff",
          border: "none", borderRadius: 8,
          padding: "0.5rem 1rem", fontWeight: 700,
          fontSize: "0.875rem", cursor: "pointer",
          minHeight: 44, minWidth: 44,
        }}
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss install banner"
        style={{
          flexShrink: 0, background: "transparent", border: "none",
          color: "rgba(255,255,255,0.55)", cursor: "pointer",
          minHeight: 44, minWidth: 44,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1rem",
        }}
      >
        ✕
      </button>
    </div>
  );
}
