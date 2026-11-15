import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  Link2,
  LogOut,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import {
  analyticsClicks,
  analyticsSummary,
  clearSession,
  createLink,
  deleteLink,
  fetchMe,
  getStoredUser,
  getToken,
  listLinks,
  login,
  register,
  setLinkActive,
  type AnalyticsSummary,
  type ApiLink,
  type ApiUser,
} from "./api";

// ─── Demo access ────────────────────────────────────────────────────────────
// Seeded by the backend (see backend DbSeeder) so anyone can try the app.
const DEMO_EMAIL = "test@gmail.com";
const DEMO_PASSWORD = "test";

// ─── Types ──────────────────────────────────────────────────────────────────

type View = "dashboard" | "links" | "analytics" | "settings";

interface ShortLink {
  id: string;
  slug: string;
  originalUrl: string;
  shortUrl: string;
  clicks: number;
  created: string;
  active: boolean;
}

function toUiLink(l: ApiLink): ShortLink {
  return {
    id: l.id,
    slug: l.slug,
    originalUrl: l.destinationUrl,
    shortUrl: l.shortUrl,
    clicks: l.clicks,
    created: new Date(l.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    active: l.isActive,
  };
}

/** "http://localhost:8080/gh-release" → "localhost:8080/gh-release" */
function displayShort(link: ShortLink): string {
  return link.shortUrl.replace(/^https?:\/\//, "");
}

// ─── Small building blocks ──────────────────────────────────────────────────

function Brand({ size = 32 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="flex items-center justify-center rounded-lg bg-neutral-900 text-white"
        style={{ width: size, height: size }}
      >
        <Link2 size={size * 0.5} />
      </span>
      <span className="text-sm font-semibold tracking-tight">Snip</span>
    </span>
  );
}

function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
    >
      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
    </button>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-neutral-900" : "bg-neutral-200"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-neutral-200 bg-white ${className}`}>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-neutral-600">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none transition-colors";

// ─── Auth ───────────────────────────────────────────────────────────────────

function AuthScreen({ onAuth }: { onAuth: (user: ApiUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user =
        mode === "login"
          ? await login(email.trim(), password)
          : await register(email.trim(), password, name.trim());
      toast.success(mode === "login" ? "Signed in — welcome back" : "Account created — welcome");
      onAuth(user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Is the backend running?"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand size={40} />
        </div>
        <Card className="p-8">
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "login" ? "Sign in" : "Create account"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">Shorten links in seconds.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "register" && (
              <Field label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className={inputClass}
                />
              </Field>
            )}
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </Field>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white transition-opacity hover:bg-neutral-700 disabled:opacity-60"
            >
              {loading
                ? mode === "login"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-neutral-500">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                  className="font-medium text-neutral-900 hover:underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                  className="font-medium text-neutral-900 hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </Card>
        {mode === "login" && (
          <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-white/60 p-4 text-center">
            <p className="text-xs font-medium text-neutral-700">Demo account</p>
            <p className="mt-1 text-xs text-neutral-500">
              <span className="font-mono">{DEMO_EMAIL}</span>
              {" · "}
              <span className="font-mono">{DEMO_PASSWORD}</span>
            </p>
            <p className="mt-1 text-xs text-neutral-400">It's already filled in — just hit sign in.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Navigation ─────────────────────────────────────────────────────────────

const NAV: { id: View; label: string; icon: typeof Link2 }[] = [
  { id: "dashboard", label: "Dashboard", icon: Link2 },
  { id: "links", label: "Links", icon: Copy },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

function TopNav({
  view,
  setView,
  user,
  onLogout,
}: {
  view: View;
  setView: (v: View) => void;
  user: ApiUser;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <button onClick={() => setView("dashboard")}>
          <Brand />
        </button>
        <nav className="flex items-center gap-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                view === id
                  ? "bg-neutral-100 font-medium text-neutral-900"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-neutral-500 sm:block">{user.email}</span>
          <button
            onClick={onLogout}
            title="Sign out"
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>
    </Card>
  );
}

function DashboardView({
  links,
  summary,
  goLinks,
  onNewLink,
}: {
  links: ShortLink[];
  summary: AnalyticsSummary | null;
  goLinks: () => void;
  onNewLink: () => void;
}) {
  const totalLinks = summary?.totalLinks ?? links.length;
  const active = summary?.activeLinks ?? links.filter((l) => l.active).length;
  const totalClicks = summary?.totalClicks ?? links.reduce((s, l) => s + l.clicks, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={onNewLink}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          <Plus size={15} /> New link
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total links" value={totalLinks.toString()} sub={`${active} active`} />
        <StatCard label="Total clicks" value={totalClicks.toLocaleString()} sub="All time" />
        <StatCard
          label="Avg. clicks per link"
          value={totalLinks ? Math.round(totalClicks / totalLinks).toLocaleString() : "0"}
          sub="All time"
        />
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-medium">Top links</h2>
          <button
            onClick={goLinks}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            View all →
          </button>
        </div>
        <div className="divide-y divide-neutral-100">
          {links
            .slice()
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 5)
            .map((link) => (
              <div key={link.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm text-neutral-900">
                    {displayShort(link)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-400">{link.originalUrl}</p>
                </div>
                <span className="ml-4 shrink-0 text-sm font-medium text-neutral-700">
                  {link.clicks.toLocaleString()} clicks
                </span>
              </div>
            ))}
          {links.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-neutral-400">
              No links yet — create your first one.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Links ──────────────────────────────────────────────────────────────────

function NewLinkModal({
  shortBase,
  onClose,
  onCreate,
}: {
  shortBase: string;
  onClose: () => void;
  onCreate: (url: string, slug: string) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim() || saving) return;
    setError("");
    setSaving(true);
    try {
      await onCreate(url.trim(), slug.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the link.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">New short link</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Long URL">
            <input
              type="url"
              required
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/a-very-long-url"
              className={inputClass}
            />
          </Field>
          <Field label="Custom alias (optional)">
            <div className="flex items-center overflow-hidden rounded-lg border border-neutral-200 focus-within:border-neutral-900">
              <span className="shrink-0 border-r border-neutral-200 bg-neutral-50 px-3 py-2.5 font-mono text-sm text-neutral-500">
                {shortBase}/
              </span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="my-link"
                className="w-full px-3 py-2.5 font-mono text-sm focus:outline-none"
              />
            </div>
          </Field>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-neutral-200 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LinksView({
  links,
  total,
  query,
  setQuery,
  showModal,
  setShowModal,
  shortBase,
  onCreate,
  onToggle,
  onDelete,
}: {
  links: ShortLink[];
  total: number;
  query: string;
  setQuery: (q: string) => void;
  showModal: boolean;
  setShowModal: (v: boolean) => void;
  shortBase: string;
  onCreate: (url: string, slug: string) => Promise<void>;
  onToggle: (link: ShortLink) => void;
  onDelete: (link: ShortLink) => void;
}) {
  return (
    <>
      {showModal && (
        <NewLinkModal
          shortBase={shortBase}
          onClose={() => setShowModal(false)}
          onCreate={onCreate}
        />
      )}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Links</h1>
            <p className="mt-0.5 text-sm text-neutral-500">{total} total</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
          >
            <Plus size={15} /> New link
          </button>
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search links…"
            className={`${inputClass} pl-9`}
          />
        </div>

        <Card>
          <div className="divide-y divide-neutral-100">
            {links.map((link) => (
              <div key={link.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <a
                      href={link.shortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`truncate font-mono text-sm hover:underline ${link.active ? "text-neutral-900" : "text-neutral-400 line-through"}`}
                    >
                      {displayShort(link)}
                    </a>
                    <CopyButton text={link.shortUrl} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-1">
                    <p className="truncate text-xs text-neutral-400">{link.originalUrl}</p>
                    <a
                      href={link.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open destination"
                      className="shrink-0 text-neutral-300 hover:text-neutral-600"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <p className="mt-0.5 text-[11px] text-neutral-300">Created {link.created}</p>
                </div>
                <span className="hidden w-20 shrink-0 text-right text-sm text-neutral-600 sm:block">
                  {link.clicks.toLocaleString()}
                </span>
                <Toggle on={link.active} onChange={() => onToggle(link)} />
                <button
                  onClick={() => onDelete(link)}
                  title="Delete"
                  className="shrink-0 rounded-md p-1.5 text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {links.length === 0 && (
              <p className="px-5 py-12 text-center text-sm text-neutral-400">
                {query ? `No links match "${query}".` : "No links yet — create your first one."}
              </p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

// ─── Analytics ──────────────────────────────────────────────────────────────

function BreakdownBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="truncate text-neutral-500">{label}</span>
        <span className="ml-2 shrink-0 font-medium text-neutral-800">{value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-neutral-800"
          style={{ width: `${Math.max((value / max) * 100, 2)}%` }}
        />
      </div>
    </div>
  );
}

function AnalyticsView() {
  const [series, setSeries] = useState<{ date: string; clicks: number }[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [clicks, sum] = await Promise.all([analyticsClicks(30), analyticsSummary()]);
        if (cancelled) return;
        setSeries(
          clicks.map((d) => ({
            date: new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            clicks: d.clicks,
          }))
        );
        setSummary(sum);
      } catch {
        if (!cancelled) toast.error("Could not load analytics.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const windowClicks = series.reduce((s, d) => s + d.clicks, 0);
  const top = summary?.topLinks ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Last 30 days · {windowClicks.toLocaleString()} clicks
          {summary ? ` · ${summary.totalClicks.toLocaleString()} all time` : ""}
        </p>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium">Clicks over time</h2>
        {loading ? (
          <p className="py-16 text-center text-sm text-neutral-400">Loading…</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={series} margin={{ top: 0, right: 0, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="clicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#171717" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#171717" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#a3a3a3" }}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis tick={{ fontSize: 11, fill: "#a3a3a3" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e5e5e5",
                  fontSize: 12,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                }}
              />
              <Area type="monotone" dataKey="clicks" stroke="#171717" strokeWidth={2} fill="url(#clicks)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium">Top links by clicks</h2>
        <div className="space-y-4">
          {top.map((l) => (
            <BreakdownBar
              key={l.slug}
              label={l.slug}
              value={l.clicks}
              max={top[0]?.clicks ?? 1}
            />
          ))}
          {!loading && top.length === 0 && (
            <p className="text-sm text-neutral-400">No links yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Settings ───────────────────────────────────────────────────────────────

function SettingsView({ user, onLogout }: { user: ApiUser; onLogout: () => void }) {
  const [notifications, setNotifications] = useState(
    () => localStorage.getItem("snip_pref_alerts") !== "off"
  );
  const [weeklyDigest, setWeeklyDigest] = useState(
    () => localStorage.getItem("snip_pref_digest") === "on"
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-neutral-500">Manage your account and preferences.</p>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium">Profile</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input value={user.displayName} readOnly className={`${inputClass} bg-neutral-50`} />
          </Field>
          <Field label="Email">
            <input value={user.email} readOnly className={`${inputClass} bg-neutral-50`} />
          </Field>
        </div>
        <p className="mt-3 text-xs text-neutral-400">From your account on the API.</p>
      </Card>

      <Card className="p-5">
        <h2 className="mb-2 text-sm font-medium">Notifications</h2>
        <div className="divide-y divide-neutral-100">
          <div className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm">Click alerts</p>
              <p className="text-xs text-neutral-400">Get notified when a link spikes in traffic.</p>
            </div>
            <Toggle
              on={notifications}
              onChange={() => {
                setNotifications((v) => {
                  localStorage.setItem("snip_pref_alerts", v ? "off" : "on");
                  return !v;
                });
              }}
            />
          </div>
          <div className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm">Weekly digest</p>
              <p className="text-xs text-neutral-400">A summary of your top links, every Monday.</p>
            </div>
            <Toggle
              on={weeklyDigest}
              onChange={() => {
                setWeeklyDigest((v) => {
                  localStorage.setItem("snip_pref_digest", v ? "off" : "on");
                  return !v;
                });
              }}
            />
          </div>
        </div>
      </Card>

      <button
        onClick={onLogout}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      >
        <LogOut size={15} /> Sign out
      </button>
    </div>
  );
}

// ─── App shell ──────────────────────────────────────────────────────────────

function Shell({ user, onLogout }: { user: ApiUser; onLogout: () => void }) {
  const [view, setView] = useState<View>("dashboard");
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shortBase = useMemo(() => {
    const first = links[0]?.shortUrl;
    if (!first) return "localhost:8080";
    return first.replace(/^https?:\/\//, "").replace(/\/[^/]*$/, "");
  }, [links]);

  const loadLinks = useCallback(async (search: string) => {
    const page = await listLinks(search);
    setLinks(page.items.map(toUiLink));
    setTotal(page.total);
  }, []);

  const loadSummary = useCallback(async () => {
    setSummary(await analyticsSummary());
  }, []);

  const reload = useCallback(async () => {
    setApiError("");
    try {
      await Promise.all([loadLinks(query), loadSummary()]);
    } catch {
      setApiError("Can't reach the API. Is the backend running? (dotnet run --project src/Snip.Api)");
    } finally {
      setLoading(false);
    }
  }, [loadLinks, loadSummary, query]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      loadLinks(query).catch(() => toast.error("Search failed — is the API running?"));
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, loadLinks, loading]);

  const handleCreate = useCallback(
    async (url: string, slug: string) => {
      const created = await createLink(url, slug || undefined);
      toast.success(`Created ${displayShort(toUiLink(created))}`);
      await Promise.all([loadLinks(query), loadSummary()]);
    },
    [loadLinks, loadSummary, query]
  );

  const handleToggle = useCallback(
    async (link: ShortLink) => {
      const next = !link.active;
      setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, active: next } : l)));
      try {
        const updated = await setLinkActive(link.id, next);
        setLinks((prev) => prev.map((l) => (l.id === link.id ? toUiLink(updated) : l)));
        loadSummary().catch(() => {});
      } catch {
        setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, active: !next } : l)));
        toast.error("Could not update the link.");
      }
    },
    [loadSummary]
  );

  const handleDelete = useCallback(
    async (link: ShortLink) => {
      try {
        await deleteLink(link.id);
        setLinks((prev) => prev.filter((l) => l.id !== link.id));
        setTotal((t) => Math.max(0, t - 1));
        loadSummary().catch(() => {});
        toast.success("Link deleted");
      } catch {
        toast.error("Could not delete the link.");
      }
    },
    [loadSummary]
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <TopNav view={view} setView={setView} user={user} onLogout={onLogout} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {apiError ? (
          <Card className="p-8 text-center">
            <p className="text-sm font-medium text-neutral-800">{apiError}</p>
            <button
              onClick={reload}
              className="mt-4 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Retry
            </button>
          </Card>
        ) : loading ? (
          <p className="py-16 text-center text-sm text-neutral-400">Loading your links…</p>
        ) : (
          <>
            {view === "dashboard" && (
              <DashboardView
                links={links}
                summary={summary}
                goLinks={() => setView("links")}
                onNewLink={() => setShowModal(true)}
              />
            )}
            {view === "links" && (
              <LinksView
                links={links}
                total={total}
                query={query}
                setQuery={setQuery}
                showModal={showModal}
                setShowModal={setShowModal}
                shortBase={shortBase}
                onCreate={handleCreate}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            )}
            {view === "analytics" && <AnalyticsView />}
            {view === "settings" && <SettingsView user={user} onLogout={onLogout} />}
          </>
        )}
      </main>
      {showModal && view !== "links" && !apiError && (
        <NewLinkModal
          shortBase={shortBase}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<ApiUser | null>(() => getStoredUser());
  const [booting, setBooting] = useState(() => !!getToken());

  useEffect(() => {
    if (!getToken()) {
      setBooting(false);
      return;
    }
    let cancelled = false;
    fetchMe()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) {
          clearSession();
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    clearSession();
    setUser(null);
  };

  return (
    <>
      <Toaster position="bottom-right" />
      {booting ? (
        <div className="flex min-h-screen items-center justify-center bg-neutral-50">
          <Brand size={40} />
        </div>
      ) : user ? (
        <Shell user={user} onLogout={handleLogout} />
      ) : (
        <AuthScreen onAuth={setUser} />
      )}
    </>
  );
}
