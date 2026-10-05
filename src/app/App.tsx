import { useMemo, useState, type FormEvent, type ReactNode } from "react";
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

// ─── Demo access ────────────────────────────────────────────────────────────
// The demo account is intentionally trivial so anyone can try the app.
const DEMO_EMAIL = "test@gmail.com";
const DEMO_PASSWORD = "test";
const DOMAIN = "snip.dev";

// ─── Types ──────────────────────────────────────────────────────────────────

type View = "dashboard" | "links" | "analytics" | "settings";

interface ShortLink {
  id: number;
  slug: string;
  originalUrl: string;
  clicks: number;
  created: string;
  active: boolean;
}

// ─── Mock data ──────────────────────────────────────────────────────────────

const INITIAL_LINKS: ShortLink[] = [
  { id: 1, slug: "gh-release", originalUrl: "https://github.com/dotnet/aspnetcore/releases/tag/v8.0.0", clicks: 24817, created: "2026-05-01", active: true },
  { id: 2, slug: "api-docs", originalUrl: "https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis", clicks: 18432, created: "2026-05-10", active: true },
  { id: 3, slug: "redis-guide", originalUrl: "https://redis.io/docs/manual/patterns/distributed-locks/", clicks: 9241, created: "2026-05-15", active: true },
  { id: 4, slug: "pg-perf", originalUrl: "https://www.postgresql.org/docs/current/performance-tips.html", clicks: 7833, created: "2026-05-20", active: true },
  { id: 5, slug: "jwt-rfc", originalUrl: "https://www.rfc-editor.org/rfc/rfc7519", clicks: 5129, created: "2026-05-22", active: false },
  { id: 6, slug: "k8s-deploy", originalUrl: "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/", clicks: 2741, created: "2026-06-05", active: true },
];

const CLICK_HISTORY = (() => {
  const base = new Date("2026-06-22");
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() - (29 - i));
    const v = 2200 + Math.sin(i * 0.35 + 1) * 700 + (Math.random() - 0.5) * 300;
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      clicks: Math.round(v),
    };
  });
})();

const DEVICE_DATA = [
  { name: "Desktop", value: 54 },
  { name: "Mobile", value: 34 },
  { name: "Tablet", value: 12 },
];

const COUNTRY_DATA = [
  { code: "US", clicks: 38420 },
  { code: "DE", clicks: 18230 },
  { code: "GB", clicks: 14870 },
  { code: "IN", clicks: 12540 },
  { code: "CA", clicks: 9820 },
];

const REFERRER_DATA = [
  { source: "Direct", clicks: 41200 },
  { source: "github.com", clicks: 28340 },
  { source: "twitter.com", clicks: 19870 },
  { source: "news.ycombinator.com", clicks: 14230 },
  { source: "reddit.com", clicks: 11590 },
];

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

function AuthScreen({ onAuth }: { onAuth: () => void }) {
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (email.trim() === DEMO_EMAIL && password === DEMO_PASSWORD) {
        toast.success("Signed in — welcome back");
        onAuth();
      } else {
        setError("That doesn't match the demo account. Try the pre-filled credentials.");
      }
    }, 700);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand size={40} />
        </div>
        <Card className="p-8">
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-neutral-500">Shorten links in seconds.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </Card>
        <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-white/60 p-4 text-center">
          <p className="text-xs font-medium text-neutral-700">Demo account</p>
          <p className="mt-1 text-xs text-neutral-500">
            <span className="font-mono">{DEMO_EMAIL}</span>
            {" · "}
            <span className="font-mono">{DEMO_PASSWORD}</span>
          </p>
          <p className="mt-1 text-xs text-neutral-400">It's already filled in — just hit sign in.</p>
        </div>
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
  onLogout,
}: {
  view: View;
  setView: (v: View) => void;
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
          <span className="hidden text-xs text-neutral-500 sm:block">{DEMO_EMAIL}</span>
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
  goLinks,
  onNewLink,
}: {
  links: ShortLink[];
  goLinks: () => void;
  onNewLink: () => void;
}) {
  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
  const active = links.filter((l) => l.active).length;

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
        <StatCard label="Total links" value={links.length.toString()} sub={`${active} active`} />
        <StatCard label="Total clicks" value={totalClicks.toLocaleString()} sub="All time" />
        <StatCard
          label="Avg. clicks per link"
          value={links.length ? Math.round(totalClicks / links.length).toLocaleString() : "0"}
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
                    {DOMAIN}/{link.slug}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-400">{link.originalUrl}</p>
                </div>
                <span className="ml-4 shrink-0 text-sm font-medium text-neutral-700">
                  {link.clicks.toLocaleString()} clicks
                </span>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Links ──────────────────────────────────────────────────────────────────

function NewLinkModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (url: string, slug: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onCreate(url.trim(), slug.trim() || Math.random().toString(36).slice(2, 8));
    onClose();
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
                {DOMAIN}/
              </span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ""))}
                placeholder="my-link"
                className="w-full px-3 py-2.5 font-mono text-sm focus:outline-none"
              />
            </div>
          </Field>
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
              className="flex-1 rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Create link
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LinksView({
  links,
  setLinks,
  showModal,
  setShowModal,
}: {
  links: ShortLink[];
  setLinks: React.Dispatch<React.SetStateAction<ShortLink[]>>;
  showModal: boolean;
  setShowModal: (v: boolean) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return links.filter(
      (l) => l.slug.toLowerCase().includes(q) || l.originalUrl.toLowerCase().includes(q)
    );
  }, [links, search]);

  const handleCreate = (url: string, slug: string) => {
    const newLink: ShortLink = {
      id: Date.now(),
      slug,
      originalUrl: url,
      clicks: 0,
      created: new Date().toISOString().split("T")[0],
      active: true,
    };
    setLinks((prev) => [newLink, ...prev]);
    toast.success(`Created ${DOMAIN}/${slug}`);
  };

  return (
    <>
      {showModal && <NewLinkModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Links</h1>
            <p className="mt-0.5 text-sm text-neutral-500">{links.length} total</p>
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search links…"
            className={`${inputClass} pl-9`}
          />
        </div>

        <Card>
          <div className="divide-y divide-neutral-100">
            {filtered.map((link) => (
              <div key={link.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className={`truncate font-mono text-sm ${link.active ? "text-neutral-900" : "text-neutral-400 line-through"}`}>
                      {DOMAIN}/{link.slug}
                    </p>
                    <CopyButton text={`https://${DOMAIN}/${link.slug}`} />
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
                </div>
                <span className="hidden w-20 shrink-0 text-right text-sm text-neutral-600 sm:block">
                  {link.clicks.toLocaleString()}
                </span>
                <Toggle
                  on={link.active}
                  onChange={() =>
                    setLinks((prev) =>
                      prev.map((l) => (l.id === link.id ? { ...l, active: !l.active } : l))
                    )
                  }
                />
                <button
                  onClick={() => {
                    setLinks((prev) => prev.filter((l) => l.id !== link.id));
                    toast.success("Link deleted");
                  }}
                  title="Delete"
                  className="shrink-0 rounded-md p-1.5 text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-5 py-12 text-center text-sm text-neutral-400">
                {search ? `No links match "${search}".` : "No links yet — create your first one."}
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
        <span className="text-neutral-500">{label}</span>
        <span className="font-medium text-neutral-800">{value.toLocaleString()}</span>
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
  const totalClicks = CLICK_HISTORY.reduce((s, d) => s + d.clicks, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Last 30 days · {totalClicks.toLocaleString()} clicks
        </p>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium">Clicks over time</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={CLICK_HISTORY} margin={{ top: 0, right: 0, left: -18, bottom: 0 }}>
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
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-medium">Devices</h2>
          <div className="space-y-4">
            {DEVICE_DATA.map((d) => (
              <BreakdownBar key={d.name} label={d.name} value={d.value} max={100} />
            ))}
          </div>
          <p className="mt-3 text-[11px] text-neutral-400">Share of clicks, in %</p>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-medium">Top countries</h2>
          <div className="space-y-4">
            {COUNTRY_DATA.map((c) => (
              <BreakdownBar key={c.code} label={c.code} value={c.clicks} max={COUNTRY_DATA[0].clicks} />
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-medium">Top referrers</h2>
          <div className="space-y-4">
            {REFERRER_DATA.map((r) => (
              <BreakdownBar key={r.source} label={r.source} value={r.clicks} max={REFERRER_DATA[0].clicks} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Settings ───────────────────────────────────────────────────────────────

function SettingsView({ onLogout }: { onLogout: () => void }) {
  const [name, setName] = useState("Demo User");
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [notifications, setNotifications] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

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
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <button
          onClick={() => toast.success("Profile saved")}
          className="mt-4 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Save changes
        </button>
      </Card>

      <Card className="p-5">
        <h2 className="mb-2 text-sm font-medium">Notifications</h2>
        <div className="divide-y divide-neutral-100">
          <div className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm">Click alerts</p>
              <p className="text-xs text-neutral-400">Get notified when a link spikes in traffic.</p>
            </div>
            <Toggle on={notifications} onChange={() => setNotifications((v) => !v)} />
          </div>
          <div className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm">Weekly digest</p>
              <p className="text-xs text-neutral-400">A summary of your top links, every Monday.</p>
            </div>
            <Toggle on={weeklyDigest} onChange={() => setWeeklyDigest((v) => !v)} />
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

// ─── App ────────────────────────────────────────────────────────────────────

function Shell({ onLogout }: { onLogout: () => void }) {
  const [view, setView] = useState<View>("dashboard");
  const [links, setLinks] = useState<ShortLink[]>(INITIAL_LINKS);
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <TopNav view={view} setView={setView} onLogout={onLogout} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {view === "dashboard" && (
          <DashboardView links={links} goLinks={() => setView("links")} onNewLink={() => setShowModal(true)} />
        )}
        {view === "links" && (
          <LinksView links={links} setLinks={setLinks} showModal={showModal} setShowModal={setShowModal} />
        )}
        {view === "analytics" && <AnalyticsView />}
        {view === "settings" && <SettingsView onLogout={onLogout} />}
      </main>
      {showModal && view !== "links" && (
        <NewLinkModal
          onClose={() => setShowModal(false)}
          onCreate={(url, slug) => {
            setLinks((prev) => [
              {
                id: Date.now(),
                slug,
                originalUrl: url,
                clicks: 0,
                created: new Date().toISOString().split("T")[0],
                active: true,
              },
              ...prev,
            ]);
            toast.success(`Created ${DOMAIN}/${slug}`);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  const [isAuth, setIsAuth] = useState(false);
  return (
    <>
      <Toaster position="bottom-right" />
      {isAuth ? <Shell onLogout={() => setIsAuth(false)} /> : <AuthScreen onAuth={() => setIsAuth(true)} />}
    </>
  );
}
