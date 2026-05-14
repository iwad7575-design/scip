import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Tab = "profile" | "security" | "notifications" | "subscription" | "danger";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
  { id: "subscription", label: "Subscription" },
  { id: "danger", label: "Danger Zone" },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
      if (!data.user) navigate("/login", { replace: true });
    });
  }, [navigate]);

  if (loading) return null;
  if (!user) return null;

  return (
    <div style={{ minHeight: "100dvh", background: "#f1f5f9" }}>
      {/* Header */}
      <div style={{ background: "#0B2545", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate("/")}
          style={{ color: "rgba(255,255,255,0.65)", background: "none", border: "none", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4, padding: 0 }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <img src="/logo.png" alt="SCIP" style={{ height: 22, width: 22, objectFit: "contain" }} />
        <span style={{ color: "#ffffff", fontWeight: 700, fontSize: 15 }}>Settings</span>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 16px" }}>
        {/* Tab bar */}
        <div style={{ background: "#ffffff", borderRadius: 14, padding: 6, display: "flex", gap: 4, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflowX: "auto" }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flexShrink: 0,
                padding: "7px 16px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                transition: "all 0.15s",
                background: activeTab === tab.id ? "#1B3A6B" : "transparent",
                color: activeTab === tab.id ? "#ffffff" : "#64748b",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "profile"       && <ProfileTab user={user} onUpdate={setUser} />}
        {activeTab === "security"      && <SecurityTab user={user} />}
        {activeTab === "notifications" && <NotificationsTab />}
        {activeTab === "subscription"  && <SubscriptionTab user={user} />}
        {activeTab === "danger"        && <DangerTab user={user} />}
      </div>
    </div>
  );
}

// ── Profile ────────────────────────────────────────────────────────────────────

function ProfileTab({ user, onUpdate }: { user: User; onUpdate: (u: User) => void }) {
  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const [fullName, setFullName]   = useState(meta.full_name || "");
  const [profession, setProfession] = useState(meta.profession || "");
  const [facility, setFacility]   = useState(meta.health_facility || "");
  const [region, setRegion]       = useState(meta.region || "");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const { data, error: err } = await supabase.auth.updateUser({
      data: { full_name: fullName, profession, health_facility: facility, region },
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    if (data.user) onUpdate(data.user);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <Card title="Profile" subtitle="Update your personal information">
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Full name">
          <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Dr. Alem Bekele" />
        </Field>
        <Field label="Email address">
          <input className="input" value={user.email || ""} disabled style={{ opacity: 0.55, cursor: "not-allowed" }} />
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>Email cannot be changed here</p>
        </Field>
        <Field label="Profession">
          <select className="input" value={profession} onChange={e => setProfession(e.target.value)}>
            <option value="">Select profession</option>
            {["Doctor", "Nurse", "Health Officer", "Midwife", "Pharmacist", "Medical Intern", "Other"].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Health facility">
          <input className="input" value={facility} onChange={e => setFacility(e.target.value)} placeholder="e.g. Tikur Anbessa Hospital" />
        </Field>
        <Field label="Region">
          <select className="input" value={region} onChange={e => setRegion(e.target.value)}>
            <option value="">Select region</option>
            {["Addis Ababa","Amhara","Oromia","Tigray","SNNPR","Somali","Afar","Benishangul-Gumuz","Gambella","Harari","Dire Dawa","Sidama","South West"].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Field>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "10px",
            borderRadius: 10,
            border: "none",
            cursor: saving ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: 14,
            color: "#ffffff",
            background: saved ? "#2ECC71" : "#1B3A6B",
            opacity: saving ? 0.7 : 1,
            transition: "background 0.2s",
          }}
        >
          {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Changes"}
        </button>
      </form>
    </Card>
  );
}

// ── Security ───────────────────────────────────────────────────────────────────

function SecurityTab({ user }: { user: User }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent]         = useState(false);
  const [showNew, setShowNew]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState("");
  const [success, setSuccess]                 = useState("");

  const meets8 = newPassword.length >= 8;
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!meets8) { setError("Password must be at least 8 characters."); return; }
    if (!passwordsMatch) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      // Verify current password
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });
      if (verifyErr) { setError("Current password is incorrect."); return; }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) { setError(updateErr.message); return; }
      setSuccess("Password updated successfully!");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card title="Change Password" subtitle="Update your account password">
        <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Current password">
            <PasswordInput
              value={currentPassword}
              onChange={v => { setCurrentPassword(v); setError(""); }}
              show={showCurrent}
              onToggle={() => setShowCurrent(x => !x)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password">
            <PasswordInput
              value={newPassword}
              onChange={v => { setNewPassword(v); setError(""); }}
              show={showNew}
              onToggle={() => setShowNew(x => !x)}
              placeholder="New password"
              autoComplete="new-password"
            />
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
              <Req met={meets8} text="At least 8 characters" />
            </div>
          </Field>
          <Field label="Confirm new password">
            <PasswordInput
              value={confirmPassword}
              onChange={v => { setConfirmPassword(v); setError(""); }}
              show={showConfirm}
              onToggle={() => setShowConfirm(x => !x)}
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
            {confirmPassword && (
              <div style={{ marginTop: 6 }}>
                <Req met={passwordsMatch} text="Passwords match" />
              </div>
            )}
          </Field>
          {error   && <ErrorBanner>{error}</ErrorBanner>}
          {success && <SuccessBanner>{success}</SuccessBanner>}
          <button
            type="submit"
            disabled={loading || !meets8 || !passwordsMatch}
            style={{
              padding: "10px",
              borderRadius: 10,
              border: "none",
              cursor: loading || !meets8 || !passwordsMatch ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 14,
              color: "#ffffff",
              background: "#1B3A6B",
              opacity: loading || !meets8 || !passwordsMatch ? 0.55 : 1,
            }}
          >
            {loading ? "Updating…" : "Update Password"}
          </button>
        </form>
      </Card>

      <Card title="Two-Factor Authentication" subtitle="Add an extra layer of security">
        <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", gap: 8 }}>
          <span>🔐</span>
          <span>Two-factor authentication is coming soon.</span>
        </div>
      </Card>

      <Card title="Active Sessions" subtitle="Sign out of all devices except this one">
        <button
          onClick={() => supabase.auth.signOut({ scope: "global" })}
          style={{
            padding: "8px 16px",
            borderRadius: 9,
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: "#334155",
          }}
        >
          Sign out all devices
        </button>
      </Card>
    </div>
  );
}

// ── Notifications ──────────────────────────────────────────────────────────────

function NotificationsTab() {
  return (
    <Card title="Notification Settings" subtitle="">
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔔</div>
        <p style={{ color: "#64748b", fontSize: 14 }}>Notification preferences are coming soon.</p>
      </div>
    </Card>
  );
}

// ── Subscription ───────────────────────────────────────────────────────────────

function SubscriptionTab({ user }: { user: User }) {
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";
  return (
    <Card title="Subscription" subtitle="Manage your SCIP plan">
      <div
        style={{
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0B2545 0%, #1B3A6B 100%)",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ color: "#ffffff", fontWeight: 700, fontSize: 15 }}>SCIP Free</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 }}>Member since {memberSince}</div>
        </div>
        <span style={{ background: "#2ECC71", color: "#ffffff", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20 }}>
          Active
        </span>
      </div>
      <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", gap: 8 }}>
        <span>⭐</span>
        <span>Premium features and payment options are coming soon.</span>
      </div>
    </Card>
  );
}

// ── Danger Zone ────────────────────────────────────────────────────────────────

function DangerTab({ user }: { user: User }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting]       = useState(false);
  const [error, setError]             = useState("");

  async function handleDelete() {
    if (confirmText !== "DELETE") return;
    setDeleting(true); setError("");
    try {
      await supabase.from("chat_sessions").delete().eq("user_id", user.id);
      await supabase.from("chat_history").delete().eq("user_id", user.id);
      await supabase.auth.signOut();
      window.location.replace("/");
    } catch {
      setError("Something went wrong. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <Card title="Danger Zone" subtitle="Irreversible actions — proceed with caution" danger>
      <div style={{ border: "1px solid #fecaca", borderRadius: 12, padding: "16px 18px" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Delete Account</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
          Permanently delete all your conversations and sign you out. Your account credentials will remain in the system — contact support for full deletion.
        </p>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            style={{ padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", background: "#dc2626", color: "#ffffff", fontWeight: 600, fontSize: 13 }}
          >
            Delete My Account
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#334155" }}>
              Type <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#dc2626" }}>DELETE</span> to confirm:
            </p>
            <input
              className="input"
              value={confirmText}
              onChange={e => { setConfirmText(e.target.value.toUpperCase()); setError(""); }}
              placeholder="DELETE"
              autoFocus
            />
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleDelete}
                disabled={confirmText !== "DELETE" || deleting}
                style={{
                  padding: "8px 16px",
                  borderRadius: 9,
                  border: "none",
                  cursor: confirmText !== "DELETE" || deleting ? "not-allowed" : "pointer",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: 13,
                  opacity: confirmText !== "DELETE" || deleting ? 0.5 : 1,
                }}
              >
                {deleting ? "Deleting…" : "Confirm Delete"}
              </button>
              <button
                onClick={() => { setShowConfirm(false); setConfirmText(""); setError(""); }}
                style={{ padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", background: "#f1f5f9", color: "#334155", fontWeight: 600, fontSize: 13 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function Card({ title, subtitle, danger, children }: { title: string; subtitle: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: "#ffffff", borderRadius: 16, padding: "22px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
      <h2 style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 700, color: danger ? "#dc2626" : "#1B3A6B" }}>{title}</h2>
      {subtitle && <p style={{ margin: "0 0 18px", fontSize: 13, color: "#64748b" }}>{subtitle}</p>}
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "#475569" }}>{label}</label>
      {children}
    </div>
  );
}

function PasswordInput({
  value, onChange, show, onToggle, placeholder, autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
  autoComplete: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        className="input"
        style={{ paddingRight: 40 }}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#94a3b8",
          display: "flex",
          alignItems: "center",
          padding: 0,
        }}
      >
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

function Req({ met, text }: { met: boolean; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
      <span>{met ? "✅" : "⚪"}</span>
      <span style={{ color: met ? "#059669" : "#94a3b8" }}>{text}</span>
    </div>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", borderRadius: 8, padding: "8px 12px" }}>
      {children}
    </div>
  );
}

function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: "#059669", background: "#f0fdf4", borderRadius: 8, padding: "8px 12px" }}>
      {children}
    </div>
  );
}

function Eye() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}
