import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { BACKEND_URL } from "../lib/config";
import { LogoutModal } from "../components/LogoutModal";
import { ReferralCard } from "../components/ReferralCard";

type Tab = "profile" | "security" | "notifications" | "subscription" | "referrals" | "support" | "danger";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
  { id: "subscription", label: "Subscription" },
  { id: "referrals", label: "Refer & Earn" },
  { id: "support", label: "Support" },
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
    <div style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      {/* Header */}
      <div style={{ background: "var(--brand-navy)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate("/")}
          style={{
            color: "rgba(255,255,255,0.6)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontFamily: "var(--font-heading)",
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 0",
          }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.15)" }} />
        <div
          onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
        >
          <img src="/logo.jpg" alt="SCIP" style={{ height: 22, width: 22, objectFit: "contain", borderRadius: 5 }} />
          <span style={{ color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 15 }}>SCIP</span>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 16px" }}>
        {/* Tab bar */}
        <div style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", padding: 5, display: "flex", gap: 3, marginBottom: 20, boxShadow: "var(--shadow-xs)", overflowX: "auto", border: "1px solid var(--border)" }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flexShrink: 0,
                padding: "7px 16px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "var(--font-heading)",
                fontWeight: activeTab === tab.id ? 600 : 500,
                transition: "background var(--transition-fast), color var(--transition-fast)",
                background: activeTab === tab.id ? "var(--brand-navy-700)" : "transparent",
                color: activeTab === tab.id ? "#ffffff" : "var(--text-secondary)",
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
        {activeTab === "referrals"     && <ReferralCard />}
        {activeTab === "support"       && <SupportTab />}
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
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Email cannot be changed here</p>
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
          className="btn-primary"
          style={{
            background: saved ? "var(--brand-green)" : "var(--brand-navy)",
            transition: "background var(--transition-base)",
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
  const [showLogoutModal, setShowLogoutModal] = useState(false);
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
    <>
    <LogoutModal
      isOpen={showLogoutModal}
      onCancel={() => setShowLogoutModal(false)}
      onConfirm={() => { setShowLogoutModal(false); supabase.auth.signOut({ scope: "global" }); }}
      title="Sign out all devices?"
      message="You will be signed out on all devices."
      confirmLabel="Sign out all devices"
    />
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
            className="btn-primary"
          >
            {loading ? "Updating…" : "Update Password"}
          </button>
        </form>
      </Card>

      <Card title="Two-Factor Authentication" subtitle="Add an extra layer of security">
        <div style={{ background: "var(--bg)", borderRadius: "var(--radius-md)", padding: "12px 14px", fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--border)" }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          <span>Two-factor authentication is coming soon.</span>
        </div>
      </Card>

      <Card title="Active Sessions" subtitle="Sign out of all devices except this one">
        <button
          onClick={() => setShowLogoutModal(true)}
          style={{
            padding: "9px 18px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            cursor: "pointer",
            fontSize: 13,
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            color: "var(--text-primary)",
            transition: "border-color var(--transition-fast), box-shadow var(--transition-fast)",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--brand-navy-400)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
        >
          Sign out all devices
        </button>
      </Card>
    </div>
    </>
  );
}

// ── Notifications ──────────────────────────────────────────────────────────────

function NotificationsTab() {
  return (
    <Card title="Notification Settings" subtitle="">
      <div style={{ textAlign: "center", padding: "28px 0" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--brand-navy-100)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="var(--brand-navy-700)" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>Notification preferences are coming soon.</p>
      </div>
    </Card>
  );
}

// ── Subscription ───────────────────────────────────────────────────────────────

function SubscriptionTab({ user }: { user: User }) {
  const navigate = useNavigate();
  const [sub, setSub]         = useState<any>(null);
  const [subLoading, setSubLoading] = useState(true);

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setSubLoading(false); return; }
      try {
        const res = await fetch(`${BACKEND_URL}/subscription/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) setSub(await res.json());
      } catch { /* ignore */ } finally {
        setSubLoading(false);
      }
    });
  }, []);

  const planLabel = sub ? (sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)) : "Free";
  const isPaid    = sub && sub.plan !== "free";
  const used      = sub?.questions_used ?? 0;
  const limit     = sub?.questions_limit ?? 20;
  const remaining = sub?.questions_remaining ?? 20;
  const pct       = Math.min((used / Math.max(limit, 1)) * 100, 100);
  const barColor  = pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#2ECC71";
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <Card title="Subscription" subtitle="Manage your SCIP plan">
      {/* Current plan badge */}
      <div style={{
        borderRadius: 12, padding: "16px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(135deg, #0B2545 0%, #1B3A6B 100%)", marginBottom: 14,
      }}>
        <div>
          <div style={{ color: "#ffffff", fontWeight: 700, fontSize: 15 }}>SCIP {planLabel}</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 }}>Member since {memberSince}</div>
        </div>
        <span style={{ background: "#2ECC71", color: "#ffffff", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20 }}>
          Active
        </span>
      </div>

      {subLoading && (
        <div style={{ textAlign: "center", padding: "18px 0", color: "var(--text-muted)", fontSize: 13 }}>Loading usage…</div>
      )}

      {!subLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Usage bar */}
          <div style={{ background: "var(--bg)", borderRadius: "var(--radius-md)", padding: "14px 16px", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Questions this month</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>{used} / {limit}</span>
            </div>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 6, transition: "width 0.4s" }} />
            </div>
            <p style={{ margin: "7px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              {remaining} remaining
              {periodEnd && ` · Resets ${periodEnd}`}
            </p>
          </div>

          {/* Upgrade or manage */}
          {!isPaid ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                You are on the <strong>Free plan</strong> (20 questions/month). Upgrade for more.
              </p>
              <button
                onClick={() => navigate("/pricing")}
                className="btn-primary"
                style={{ background: "var(--brand-green)" }}
              >
                View Plans & Upgrade
              </button>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
              Your <strong>{planLabel}</strong> plan{periodEnd ? ` renews ${periodEnd}` : ""}. To change plans, contact support.
            </p>
          )}
        </div>
      )}
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
      <div style={{ border: "1px solid #fecaca", borderRadius: "var(--radius-lg)", padding: "16px 18px" }}>
        <h3 style={{ fontFamily: "var(--font-heading)", margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Delete Account</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Permanently delete all your conversations and sign you out. Your account credentials will remain in the system — contact support for full deletion.
        </p>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            style={{ padding: "9px 18px", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer", background: "var(--destructive)", color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 13 }}
          >
            Delete My Account
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
              Type <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--destructive)" }}>DELETE</span> to confirm:
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
                  padding: "9px 18px",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  cursor: confirmText !== "DELETE" || deleting ? "not-allowed" : "pointer",
                  background: "var(--destructive)",
                  color: "#ffffff",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: 13,
                  opacity: confirmText !== "DELETE" || deleting ? 0.5 : 1,
                }}
              >
                {deleting ? "Deleting…" : "Confirm Delete"}
              </button>
              <button
                onClick={() => { setShowConfirm(false); setConfirmText(""); setError(""); }}
                style={{ padding: "9px 18px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", cursor: "pointer", background: "var(--surface)", color: "var(--text-primary)", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 13 }}
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

// ── Support ────────────────────────────────────────────────────────────────────

function SupportTab() {
  return (
    <Card title="Contact Us" subtitle="Reach the SCIP team for help or feedback">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <a
          href="mailto:info@scip-et.com"
          style={{
            display: "flex", alignItems: "center", gap: 14,
            background: "var(--bg)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)", padding: "14px 16px",
            textDecoration: "none", color: "var(--text-primary)",
            transition: "border-color var(--transition-fast)",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--brand-navy-400)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; }}
        >
          <span style={{ fontSize: 22, flexShrink: 0 }}>📧</span>
          <div>
            <div style={{ fontSize: 12, fontFamily: "var(--font-heading)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2 }}>Email</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--brand-navy-700)" }}>info@scip-et.com</div>
          </div>
        </a>

        <a
          href="tel:+251966217319"
          style={{
            display: "flex", alignItems: "center", gap: 14,
            background: "var(--bg)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)", padding: "14px 16px",
            textDecoration: "none", color: "var(--text-primary)",
            transition: "border-color var(--transition-fast)",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--brand-navy-400)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; }}
        >
          <span style={{ fontSize: 22, flexShrink: 0 }}>📞</span>
          <div>
            <div style={{ fontSize: 12, fontFamily: "var(--font-heading)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2 }}>Phone</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--brand-navy-700)" }}>+251 966 217 319</div>
          </div>
        </a>

        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          We typically respond within 1 business day.
        </p>
      </div>
    </Card>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function Card({ title, subtitle, danger, children }: { title: string; subtitle: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: "var(--radius-2xl)", padding: "22px 24px", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)" }}>
      <h2 style={{ fontFamily: "var(--font-heading)", margin: "0 0 2px", fontSize: 17, fontWeight: 700, color: danger ? "var(--destructive)" : "var(--brand-navy-700)" }}>{title}</h2>
      {subtitle && <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-secondary)" }}>{subtitle}</p>}
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 13, fontFamily: "var(--font-heading)", fontWeight: 500, color: "var(--text-secondary)" }}>{label}</label>
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
      <div style={{ width: 14, height: 14, borderRadius: "50%", background: met ? "var(--success)" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {met && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
      </div>
      <span style={{ color: met ? "var(--success)" : "var(--text-muted)" }}>{text}</span>
    </div>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: "var(--destructive)", background: "var(--destructive-bg)", border: "1px solid #fecaca", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
      {children}
    </div>
  );
}

function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: "var(--success)", background: "var(--success-bg)", border: "1px solid #bbf7d0", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
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
