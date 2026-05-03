import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface ChatRecord {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

interface Stats {
  total: number;
  thisWeek: number;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<ChatRecord[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, thisWeek: 0 });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const [historyRes, totalRes, weekRes] = await Promise.all([
          supabase
            .from("chat_history")
            .select("id, question, answer, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("chat_history")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("chat_history")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("created_at", getWeekStart().toISOString()),
        ]);

        setHistory(historyRes.data ?? []);
        setStats({ total: totalRes.count ?? 0, thisWeek: weekRes.count ?? 0 });
      }

      setLoading(false);
    }
    load();
  }, []);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading) return <LoadingScreen />;

  const meta = (user?.user_metadata ?? {}) as Record<string, string>;
  const fullName = meta.full_name || user?.email?.split("@")[0] || "User";
  const profession = meta.profession || "";
  const facility = meta.health_facility || "";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  const welcomeName = formatWelcomeName(fullName, profession);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header style={{ backgroundColor: "#1B3A6B" }} className="px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm bg-white"
              style={{ color: "#1B3A6B" }}
            >
              S
            </div>
            <span className="text-white font-semibold">SCIP</span>
            <span className="hidden sm:inline text-xs px-2 py-0.5 rounded-full bg-white/20 text-white/80">
              SHIFA Clinical Intelligence Platform
            </span>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {welcomeName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Here's your clinical intelligence summary</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          <StatCard
            icon={<ChatIcon />}
            value={stats.thisWeek}
            label="Questions this week"
          />
          <StatCard
            icon={<StackIcon />}
            value={stats.total}
            label="Total questions"
          />
          <StatCard
            icon={<CalendarIcon />}
            value={memberSince}
            label="Member since"
            small
          />
        </div>

        {/* Ask SCIP CTA */}
        <button
          onClick={() => navigate("/agent")}
          className="w-full mb-8 rounded-2xl px-6 py-5 flex items-center justify-between text-white group hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "#1B3A6B" }}
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="font-semibold text-base sm:text-lg">Ask SCIP a Clinical Question</div>
              <div className="text-xs sm:text-sm text-white/70 mt-0.5">
                Powered by Ethiopian national guidelines
              </div>
            </div>
          </div>
          <svg
            className="w-5 h-5 opacity-60 group-hover:translate-x-1 transition-transform flex-shrink-0"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Recent history */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="font-semibold text-slate-900 mb-1">Recent Questions</h2>
              <p className="text-xs text-slate-400 mb-4">Last 10 questions you asked SCIP</p>

              {history.length === 0 ? (
                <EmptyHistory onAsk={() => navigate("/agent")} />
              ) : (
                <div className="divide-y divide-slate-100">
                  {history.map(item => (
                    <HistoryItem
                      key={item.id}
                      item={item}
                      isExpanded={expanded.has(item.id)}
                      onToggle={() => toggleExpand(item.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Profile card */}
          <div>
            <ProfileCard
              user={user}
              fullName={fullName}
              profession={profession}
              facility={facility}
              onUpdated={(name, prof, fac) => {
                setUser(u => u ? {
                  ...u,
                  user_metadata: { ...u.user_metadata, full_name: name, profession: prof, health_facility: fac }
                } : u);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon, value, label, small = false,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  small?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm px-4 py-4 flex flex-col gap-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EEF2FF" }}>
        <span style={{ color: "#1B3A6B" }}>{icon}</span>
      </div>
      <div className={`font-bold text-slate-900 leading-none ${small ? "text-base sm:text-lg" : "text-2xl"}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500 leading-snug">{label}</div>
    </div>
  );
}

function HistoryItem({
  item, isExpanded, onToggle,
}: {
  item: ChatRecord;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const preview = item.answer.slice(0, 140).trimEnd() + (item.answer.length > 140 ? "…" : "");

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-medium text-slate-900 text-sm leading-snug flex-1">{item.question}</p>
        <span className="text-xs text-slate-400 flex-shrink-0 mt-0.5">{relativeTime(item.created_at)}</span>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">
        {isExpanded ? item.answer : preview}
      </p>
      {item.answer.length > 140 && (
        <button
          onClick={onToggle}
          className="mt-1.5 text-xs font-medium hover:underline"
          style={{ color: "#1B3A6B" }}
        >
          {isExpanded ? "Hide" : "Show full answer"}
        </button>
      )}
    </div>
  );
}

function EmptyHistory({ onAsk }: { onAsk: () => void }) {
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <p className="text-sm text-slate-500 mb-3">No questions yet</p>
      <button
        onClick={onAsk}
        className="text-sm font-medium hover:underline"
        style={{ color: "#1B3A6B" }}
      >
        Ask your first clinical question →
      </button>
    </div>
  );
}

function ProfileCard({
  user, fullName, profession, facility, onUpdated,
}: {
  user: User | null;
  fullName: string;
  profession: string;
  facility: string;
  onUpdated: (name: string, prof: string, fac: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(fullName);
  const [prof, setProf] = useState(profession);
  const [fac, setFac] = useState(facility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name, profession: prof, health_facility: fac },
    });
    setSaving(false);
    if (error) {
      setError(error.message);
    } else {
      onUpdated(name, prof, fac);
      setEditing(false);
    }
  }

  const PROFESSIONS = ["Doctor", "Nurse", "Public Health Officer", "Other"];
  const initials = fullName.replace(/^Dr\.?\s*/i, "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="font-semibold text-slate-900 mb-4">Profile</h2>

      {!editing ? (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
              style={{ backgroundColor: "#1B3A6B" }}
            >
              {initials || "?"}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 truncate">{fullName}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 mb-5">
            <ProfileRow label="Profession" value={profession || "—"} />
            <ProfileRow label="Health Facility" value={facility || "—"} />
          </div>

          <button
            onClick={() => setEditing(true)}
            className="w-full py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-slate-50"
            style={{ borderColor: "#1B3A6B", color: "#1B3A6B" }}
          >
            Edit Profile
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Full name</label>
            <input
              className="input w-full"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Profession</label>
            <select className="input w-full" value={prof} onChange={e => setProf(e.target.value)}>
              {PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Health facility</label>
            <input
              className="input w-full"
              value={fac}
              onChange={e => setFac(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: "#1B3A6B" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setName(fullName); setProf(profession); setFac(facility); }}
              className="flex-1 py-2 rounded-lg border text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm text-slate-800 font-medium">{value}</p>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: "#1B3A6B" }}>S</div>
        <p className="text-sm text-slate-500">Loading your dashboard…</p>
      </div>
    </div>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function ChatIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatWelcomeName(fullName: string, profession: string): string {
  const clean = fullName.replace(/^Dr\.?\s*/i, "").trim();
  const first = clean.split(" ")[0];
  if (!first) return "there";
  if (profession === "Doctor" || /^Dr\.?\s/i.test(fullName)) return `Dr. ${first}`;
  return first;
}
