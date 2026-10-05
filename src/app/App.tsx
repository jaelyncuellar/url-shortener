import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import {
  Link2, BarChart3, Settings, LogOut, Copy, Trash2, Plus,
  Search, ExternalLink, Shield, Zap, Globe, X, Check, Activity,
  TrendingUp, Database, Key, RefreshCw, ChevronRight,
  Eye, EyeOff, Lock, ArrowUpRight, Server,
} from "lucide-react";
import { toast, Toaster } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────

type View = "auth" | "dashboard" | "links" | "analytics" | "settings";
type AuthMode = "login" | "register";

interface ShortLink {
  id: number;
  slug: string;
  originalUrl: string;
  clicks: number;
  created: string;
  expires: string | null;
  active: boolean;
  tags: string[];
}

// ─── Mock data ──────────────────────────────────────────────────────────────

const INITIAL_LINKS: ShortLink[] = [
  { id: 1, slug: "gh-release", originalUrl: "https://github.com/dotnet/aspnetcore/releases/tag/v8.0.0", clicks: 24817, created: "2026-05-01", expires: null, active: true, tags: ["github", "dotnet"] },
  { id: 2, slug: "api-docs", originalUrl: "https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis", clicks: 18432, created: "2026-05-10", expires: "2026-12-31", active: true, tags: ["docs", "api"] },
  { id: 3, slug: "redis-guide", originalUrl: "https://redis.io/docs/manual/patterns/distributed-locks/", clicks: 9241, created: "2026-05-15", expires: null, active: true, tags: ["redis", "caching"] },
  { id: 4, slug: "pg-perf", originalUrl: "https://www.postgresql.org/docs/current/performance-tips.html", clicks: 7833, created: "2026-05-20", expires: null, active: true, tags: ["postgres", "perf"] },
  { id: 5, slug: "jwt-rfc", originalUrl: "https://www.rfc-editor.org/rfc/rfc7519", clicks: 5129, created: "2026-05-22", expires: null, active: false, tags: ["auth", "jwt"] },
  { id: 6, slug: "bench-2026", originalUrl: "https://benchmarks.techradar.dev/aspnet-core-2026", clicks: 3892, created: "2026-06-01", expires: "2026-07-01", active: true, tags: ["benchmark"] },
  { id: 7, slug: "k8s-deploy", originalUrl: "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/", clicks: 2741, created: "2026-06-05", expires: null, active: true, tags: ["devops", "k8s"] },
  { id: 8, slug: "efcore-tips", originalUrl: "https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying", clicks: 1956, created: "2026-06-12", expires: null, active: true, tags: ["ef", "dotnet"] },
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
      unique: Math.round(v * 0.67),
      cached: Math.round(v * 0.42),
    };
  });
})();

const DEVICE_DATA = [
  { name: "Desktop", value: 54.2 },
  { name: "Mobile", value: 33.8 },
  { name: "Tablet", value: 12.0 },
];

const COUNTRY_DATA = [
  { code: "US", clicks: 38420 },
  { code: "DE", clicks: 18230 },
  { code: "GB", clicks: 14870 },
  { code: "IN", clicks: 12540 },
  { code: "CA", clicks: 9820 },
  { code: "AU", clicks: 7430 },
];

const REFERRER_DATA = [
  { source: "Direct / None", clicks: 41200 },
  { source: "github.com", clicks: 28340 },
  { source: "twitter.com", clicks: 19870 },
  { source: "news.ycombinator.com", clicks: 14230 },
  { source: "reddit.com", clicks: 11590 },
  { source: "linkedin.com", clicks: 8730 },
];

const CHART_COLORS = ["#00d4e8", "#7c5aed", "#10b981"];

// ─── Shared micro-components ────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, trend,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <div className="bg-card border border-border p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{value}</div>
        <div className="text-[11px] text-muted-foreground mt-1" style={{ fontFamily: "JetBrains Mono, monospace" }}>{sub}</div>
      </div>
      {trend && (
        <div
          className={`flex items-center gap-1 text-[11px] ${trend.positive ? "text-emerald-400" : "text-red-400"}`}
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          <ArrowUpRight size={11} className={trend.positive ? "" : "rotate-90"} />
          {trend.value} vs last month
        </div>
      )}
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] ${active ? "text-emerald-400" : "text-muted-foreground"}`}
      style={{ fontFamily: "JetBrains Mono, monospace" }}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-muted-foreground"}`} />
      {active ? "active" : "inactive"}
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        toast.success("Copied to clipboard");
      }}
      className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

const tooltipStyle = {
  background: "#0c0e1a",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "2px",
  fontSize: 11,
  fontFamily: "JetBrains Mono, monospace",
  color: "#c8d0e4",
};

// ─── Auth Screen ────────────────────────────────────────────────────────────

function AuthScreen({ onAuth }: { onAuth: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("admin@snip.dev");
  const [password, setPassword] = useState("supersecret1234");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("JWT issued — session active");
      onAuth();
    }, 1100);
  };

  return (
    <div className="min-h-screen bg-background flex" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-[460px] border-r border-border p-12 justify-between bg-card flex-shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-16">
            <div className="w-7 h-7 bg-[#00d4e8] flex items-center justify-center">
              <Link2 size={14} className="text-black" />
            </div>
            <span className="font-bold text-sm tracking-widest uppercase text-foreground">snip.dev</span>
          </div>
          <h1 className="text-[2.1rem] font-bold text-foreground leading-tight mb-4">
            Scale your links.<br />
            <span className="text-[#00d4e8]">Own your data.</span>
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-10">
            Enterprise-grade URL shortener built on ASP.NET Core 8, PostgreSQL, and Redis.
            Sub-10ms redirect latency with async processing and fault-tolerant design.
          </p>
          <div className="space-y-5">
            {[
              { icon: Zap, label: "Redis-powered caching", sub: "94.2% cache hit rate · <3ms median redirect" },
              { icon: Shield, label: "JWT RS256 authentication", sub: "Access + refresh token rotation · secure cookie" },
              { icon: Database, label: "PostgreSQL + EF Core 8", sub: "Async LINQ · Npgsql pooling · B-tree indexes" },
              { icon: Activity, label: "Real-time analytics", sub: "Click events · geo · device · referrer breakdown" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-7 h-7 border border-[#00d4e8]/25 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <Icon size={13} className="text-[#00d4e8]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* System status */}
        <div className="border border-border p-4 space-y-2.5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 font-semibold">System Status</div>
          {[
            { label: "API Gateway", ok: true },
            { label: "PostgreSQL (Npgsql)", ok: true },
            { label: "Redis Cluster", ok: true },
            { label: "Background Workers", ok: true },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center justify-between" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              <span className="text-[11px] text-muted-foreground">{label}</span>
              <span className={`flex items-center gap-1.5 text-[11px] ${ok ? "text-emerald-400" : "text-red-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
                {ok ? "operational" : "degraded"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
            <div className="w-7 h-7 bg-[#00d4e8] flex items-center justify-center">
              <Link2 size={14} className="text-black" />
            </div>
            <span className="font-bold text-sm tracking-widest uppercase text-foreground">snip.dev</span>
          </div>
          <div className="mb-8">
            <h2 className="text-xl font-bold text-foreground">{mode === "login" ? "Sign in" : "Create account"}</h2>
            <p className="text-[11px] text-muted-foreground mt-1" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              {mode === "login" ? "Enter credentials to issue RS256 JWT" : "Register a new service account"}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Display Name</label>
                <input type="text" placeholder="Alex Morgan" className="w-full bg-secondary border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00d4e8]/50 transition-colors" style={{ fontFamily: "JetBrains Mono, monospace" }} />
              </div>
            )}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-secondary border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#00d4e8]/50 transition-colors" style={{ fontFamily: "JetBrains Mono, monospace" }} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Password</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-secondary border border-border px-3 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:border-[#00d4e8]/50 transition-colors" style={{ fontFamily: "JetBrains Mono, monospace" }} />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-[#00d4e8] text-black text-xs font-bold py-3 uppercase tracking-widest hover:bg-[#00c4d8] transition-colors disabled:opacity-60 mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw size={12} className="animate-spin" />
                  Issuing token...
                </span>
              ) : mode === "login" ? "Sign In" : "Create Account"}
            </button>
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <button type="button" onClick={() => setMode(m => m === "login" ? "register" : "login")} className="w-full border border-border text-sm text-foreground py-2.5 hover:bg-secondary transition-colors">
              {mode === "login" ? "Create new account" : "Back to sign in"}
            </button>
          </form>
          <div className="mt-7 flex items-center gap-2.5 border border-border p-3">
            <Lock size={12} className="text-[#00d4e8] flex-shrink-0" />
            <span className="text-[11px] text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>RS256 JWT · 15min access token · 7d refresh rotation</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────────

function Sidebar({ view, setView, onLogout }: { view: Exclude<View, "auth">; setView: (v: Exclude<View, "auth">) => void; onLogout: () => void }) {
  const nav = [
    { id: "dashboard" as const, label: "Dashboard", icon: Activity },
    { id: "links" as const, label: "Links", icon: Link2 },
    { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];
  return (
    <aside className="w-52 bg-card border-r border-border flex flex-col h-full flex-shrink-0" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-[#00d4e8] flex items-center justify-center">
            <Link2 size={12} className="text-black" />
          </div>
          <span className="font-bold text-sm tracking-widest uppercase text-foreground">snip.dev</span>
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>v2.4.1 · enterprise</div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors text-left ${
              view === id
                ? "bg-[#00d4e8]/10 text-[#00d4e8] border-l-2 border-[#00d4e8] -ml-px pl-[13px]"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <Icon size={14} />
            <span className={view === id ? "font-semibold" : ""}>{label}</span>
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2.5 px-1 font-semibold">Stack</div>
        <div className="space-y-1.5">
          {[
            { label: "PostgreSQL", ok: true },
            { label: "Redis", ok: true },
            { label: "Workers", ok: true },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center justify-between px-1">
              <span className="text-[11px] text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{label}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
            </div>
          ))}
        </div>
      </div>
      <div className="p-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#7c5aed]/20 border border-[#7c5aed]/40 flex items-center justify-center">
              <span className="text-[11px] font-bold text-[#7c5aed]">A</span>
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">admin</div>
              <div className="text-[10px] text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>admin@snip.dev</div>
            </div>
          </div>
          <button onClick={onLogout} className="text-muted-foreground hover:text-foreground transition-colors p-1" title="Sign out">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

function DashboardView({ links, setView }: { links: ShortLink[]; setView: (v: Exclude<View, "auth">) => void }) {
  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
  const activeLinks = links.filter(l => l.active).length;
  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <div>
        <h1 className="text-lg font-bold text-foreground">Overview</h1>
        <p className="text-[11px] text-muted-foreground mt-0.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>Jun 22, 2026 · UTC+0 · Redis cache warm</p>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Active Links" value={activeLinks.toString()} sub={`${links.length - activeLinks} inactive · 0 expired`} icon={Link2} trend={{ value: "+12%", positive: true }} />
        <StatCard label="Total Clicks" value={totalClicks.toLocaleString()} sub="last 30 days rolling" icon={TrendingUp} trend={{ value: "+23%", positive: true }} />
        <StatCard label="Cache Hit Rate" value="94.2%" sub="Redis · 3,841 keys warm" icon={Zap} trend={{ value: "+1.3%", positive: true }} />
        <StatCard label="Avg Latency" value="8ms" sub="p50 redirect · p99: 22ms" icon={Activity} trend={{ value: "-4ms", positive: true }} />
      </div>
      <div className="bg-card border border-border p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-sm font-semibold text-foreground">Click Traffic</div>
            <div className="text-[11px] text-muted-foreground mt-0.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>30-day rolling · redirects served from Redis</div>
          </div>
          <div className="flex items-center gap-4" style={{ fontFamily: "JetBrains Mono, monospace" }}>
            <span className="flex items-center gap-1.5 text-[11px] text-[#00d4e8]"><span className="w-2 h-2 rounded-full bg-[#00d4e8]" />clicks</span>
            <span className="flex items-center gap-1.5 text-[11px] text-[#7c5aed]"><span className="w-2 h-2 rounded-full bg-[#7c5aed]" />unique</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={CLICK_HISTORY} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="gc1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00d4e8" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#00d4e8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gc2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c5aed" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#7c5aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#4e5878", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} interval={4} />
            <YAxis tick={{ fontSize: 10, fill: "#4e5878", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#c8d0e4" }} />
            <Area type="monotone" dataKey="clicks" stroke="#00d4e8" strokeWidth={1.5} fill="url(#gc1)" />
            <Area type="monotone" dataKey="unique" stroke="#7c5aed" strokeWidth={1.5} fill="url(#gc2)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-card border border-border">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Top Links</span>
            <button onClick={() => setView("links")} className="text-[11px] text-[#00d4e8] flex items-center gap-1 hover:underline" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              View all <ChevronRight size={11} />
            </button>
          </div>
          <div className="divide-y divide-border">
            {links.slice(0, 5).map(link => (
              <div key={link.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-[#00d4e8] truncate" style={{ fontFamily: "JetBrains Mono, monospace" }}>snip.dev/{link.slug}</div>
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>{link.originalUrl}</div>
                </div>
                <div className="text-xs text-foreground ml-4 flex-shrink-0 font-semibold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{link.clicks.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border p-5 space-y-4">
          <div className="text-sm font-semibold text-foreground">System Health</div>
          {[
            { label: "PostgreSQL", value: "12ms", detail: "Npgsql · 8/50 active conns", ok: true },
            { label: "Redis Cache", value: "94.2%", detail: "3.8k keys · 128MB used", ok: true },
            { label: "Worker Queue", value: "0 pending", detail: "Analytics async processor", ok: true },
            { label: "JWT Service", value: "RS256", detail: "Token valid · 12min left", ok: true },
          ].map(({ label, value, detail, ok }) => (
            <div key={label} className="flex items-start gap-3">
              <div className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{label}</span>
                  <span className="text-[11px] text-[#00d4e8]" style={{ fontFamily: "JetBrains Mono, monospace" }}>{value}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Links ──────────────────────────────────────────────────────────────────

function CreateLinkModal({ onClose, onCreate }: { onClose: () => void; onCreate: (url: string, slug: string) => void }) {
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    onCreate(url, slug || Math.random().toString(36).slice(2, 8));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <div className="bg-card border border-border w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="text-sm font-semibold text-foreground">Create Short Link</div>
            <div className="text-[10px] text-muted-foreground mt-0.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>POST /api/v1/links · cached after first redirect</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
        </div>
        <form onSubmit={handleCreate} className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Destination URL *</label>
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-long-url.com/..." required className="w-full bg-secondary border border-border px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00d4e8]/50 transition-colors" style={{ fontFamily: "JetBrains Mono, monospace" }} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Custom Alias <span className="normal-case tracking-normal text-muted-foreground">(optional)</span></label>
            <div className="flex items-center border border-border">
              <span className="px-3 py-2.5 text-xs text-muted-foreground bg-muted border-r border-border flex-shrink-0" style={{ fontFamily: "JetBrains Mono, monospace" }}>snip.dev/</span>
              <input type="text" value={slug} onChange={e => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ""))} placeholder="my-link" className="flex-1 bg-secondary px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" style={{ fontFamily: "JetBrains Mono, monospace" }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>Stored in PostgreSQL · hashed to Redis key on first redirect</p>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Expires <span className="normal-case tracking-normal text-muted-foreground">(optional)</span></label>
            <input type="date" className="w-full bg-secondary border border-border px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-[#00d4e8]/50 transition-colors" style={{ fontFamily: "JetBrains Mono, monospace" }} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-border text-sm text-foreground py-2.5 hover:bg-secondary transition-colors">Cancel</button>
            <button type="submit" className="flex-1 bg-[#00d4e8] text-black text-xs font-bold py-2.5 hover:bg-[#00c4d8] transition-colors uppercase tracking-widest">Create Link</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LinksView({ links, setLinks }: { links: ShortLink[]; setLinks: React.Dispatch<React.SetStateAction<ShortLink[]>> }) {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const filtered = links.filter(l =>
    l.slug.includes(search.toLowerCase()) ||
    l.originalUrl.toLowerCase().includes(search.toLowerCase()) ||
    l.tags.some(t => t.includes(search.toLowerCase()))
  );

  const handleCreate = (url: string, slug: string) => {
    const newLink: ShortLink = { id: Date.now(), slug, originalUrl: url, clicks: 0, created: new Date().toISOString().split("T")[0], expires: null, active: true, tags: [] };
    setLinks(prev => [newLink, ...prev]);
    toast.success(`snip.dev/${slug} created · INSERT queued to PostgreSQL`);
  };

  const handleDelete = (id: number) => {
    setLinks(prev => prev.filter(l => l.id !== id));
    toast.success("Link deleted · cache key invalidated in Redis");
  };

  const handleToggle = (id: number) => {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, active: !l.active } : l));
  };

  return (
    <>
      {showModal && <CreateLinkModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
      <div className="p-6 space-y-4 h-full" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">Links</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>{links.length} total · GET /api/v1/links · paginated</p>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[#00d4e8] text-black text-[11px] font-bold px-4 py-2.5 uppercase tracking-widest hover:bg-[#00c4d8] transition-colors">
            <Plus size={12} /> New Link
          </button>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search by slug, URL, or tag..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-card border border-border pl-9 pr-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00d4e8]/50 transition-colors" style={{ fontFamily: "JetBrains Mono, monospace" }} />
        </div>
        <div className="bg-card border border-border overflow-hidden">
          <div className="hidden md:grid grid-cols-[2fr_3fr_80px_90px_90px_70px] text-[10px] uppercase tracking-widest text-muted-foreground px-5 py-3 border-b border-border bg-muted/20 font-semibold">
            <span>Slug</span>
            <span>Destination</span>
            <span>Clicks</span>
            <span>Created</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map(link => (
              <div key={link.id} className="flex flex-col md:grid md:grid-cols-[2fr_3fr_80px_90px_90px_70px] md:items-center px-5 py-4 hover:bg-secondary/30 transition-colors group gap-2 md:gap-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#00d4e8]" style={{ fontFamily: "JetBrains Mono, monospace" }}>/{link.slug}</span>
                  <CopyBtn text={`https://snip.dev/${link.slug}`} />
                </div>
                <div className="min-w-0 md:pr-4">
                  <span className="text-[10px] text-muted-foreground truncate block" style={{ fontFamily: "JetBrains Mono, monospace" }}>{link.originalUrl}</span>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {link.tags.map(t => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 bg-[#7c5aed]/15 text-[#7c5aed] border border-[#7c5aed]/20" style={{ fontFamily: "JetBrains Mono, monospace" }}>{t}</span>
                    ))}
                  </div>
                </div>
                <span className="text-[11px] text-foreground font-semibold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{link.clicks.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{link.created}</span>
                <div>
                  <button onClick={() => handleToggle(link.id)}>
                    <StatusPill active={link.active} />
                  </button>
                </div>
                <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <a href={link.originalUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Open destination">
                    <ExternalLink size={12} />
                  </a>
                  <button onClick={() => handleDelete(link.id)} className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors" title="Delete">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-5 py-12 text-center text-[11px] text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>No links match "{search}"</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Analytics ──────────────────────────────────────────────────────────────

function AnalyticsView() {
  const [metric, setMetric] = useState<"clicks" | "unique" | "cached">("clicks");
  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <div>
        <h1 className="text-lg font-bold text-foreground">Analytics</h1>
        <p className="text-[11px] text-muted-foreground mt-0.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>Last 30 days · aggregated async from PostgreSQL timeseries</p>
      </div>
      <div className="flex items-center gap-0 border border-border w-fit">
        {(["clicks", "unique", "cached"] as const).map(m => (
          <button key={m} onClick={() => setMetric(m)} className={`px-5 py-2 text-[11px] uppercase tracking-widest transition-colors ${metric === m ? "bg-[#00d4e8] text-black font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`} style={{ fontFamily: "JetBrains Mono, monospace" }}>
            {m}
          </button>
        ))}
      </div>
      <div className="bg-card border border-border p-5">
        <div className="text-sm font-semibold text-foreground mb-1 capitalize">{metric} over time</div>
        <div className="text-[11px] text-muted-foreground mb-5" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          {metric === "cached" ? "Requests served from Redis without hitting PostgreSQL" : metric === "unique" ? "Deduplicated by IP + User-Agent fingerprint hash" : "Total redirect events processed by ASP.NET Core middleware"}
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={CLICK_HISTORY} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="gm" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00d4e8" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#00d4e8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#4e5878", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} interval={4} />
            <YAxis tick={{ fontSize: 10, fill: "#4e5878", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#c8d0e4" }} />
            <Area type="monotone" dataKey={metric} stroke="#00d4e8" strokeWidth={2} fill="url(#gm)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-5">
          <div className="text-sm font-semibold text-foreground mb-4">Device Breakdown</div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={DEVICE_DATA} cx="50%" cy="50%" innerRadius={40} outerRadius={58} dataKey="value" stroke="none">
                {DEVICE_DATA.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {DEVICE_DATA.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-[11px]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i] }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </span>
                <span className="text-foreground">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border p-5">
          <div className="text-sm font-semibold text-foreground mb-4">Top Countries</div>
          <ResponsiveContainer width="100%" height={185}>
            <BarChart data={COUNTRY_DATA} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 9, fill: "#4e5878", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="code" tick={{ fontSize: 10, fill: "#8b95b0", fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} width={26} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="clicks" fill="#7c5aed" radius={0} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border p-5">
          <div className="text-sm font-semibold text-foreground mb-5">Top Referrers</div>
          <div className="space-y-3.5">
            {REFERRER_DATA.map((r) => {
              const pct = (r.clicks / REFERRER_DATA[0].clicks) * 100;
              return (
                <div key={r.source}>
                  <div className="flex items-center justify-between text-[10px] mb-1" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    <span className="text-muted-foreground truncate">{r.source}</span>
                    <span className="text-foreground ml-2 flex-shrink-0">{r.clicks.toLocaleString()}</span>
                  </div>
                  <div className="h-1 bg-secondary w-full">
                    <div className="h-full bg-[#00d4e8] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Settings ───────────────────────────────────────────────────────────────

function SettingsView() {
  const [showToken, setShowToken] = useState(false);
  const MOCK_JWT = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3IueHh4eHh4IiwibmFtZSI6IkFkbWluIiwicm9sZXMiOlsiYWRtaW4iLCJsaW5rczp3cml0ZSJdLCJleHAiOjE3NTA2MDAwMDB9.SIGNATURE";
  const masked = MOCK_JWT.slice(0, 24) + "•".repeat(28) + MOCK_JWT.slice(-8);

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full max-w-3xl" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
      <div>
        <h1 className="text-lg font-bold text-foreground">Settings</h1>
        <p className="text-[11px] text-muted-foreground mt-0.5" style={{ fontFamily: "JetBrains Mono, monospace" }}>Service configuration · write:admin scope required</p>
      </div>

      {/* Profile */}
      <section className="bg-card border border-border p-5 space-y-4">
        <div className="text-sm font-semibold text-foreground">Profile</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Display Name</label>
            <input defaultValue="Admin" className="w-full bg-secondary border border-border px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-[#00d4e8]/50 transition-colors" style={{ fontFamily: "JetBrains Mono, monospace" }} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Email</label>
            <input defaultValue="admin@snip.dev" className="w-full bg-secondary border border-border px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-[#00d4e8]/50 transition-colors" style={{ fontFamily: "JetBrains Mono, monospace" }} />
          </div>
        </div>
        <button onClick={() => toast.success("Profile updated")} className="bg-[#00d4e8] text-black text-[11px] font-bold px-4 py-2 uppercase tracking-widest hover:bg-[#00c4d8] transition-colors">Save Profile</button>
      </section>

      {/* JWT Auth */}
      <section className="bg-card border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Key size={14} className="text-[#00d4e8]" />
          <span className="text-sm font-semibold text-foreground">JWT Configuration</span>
        </div>
        <div className="grid grid-cols-2 gap-3" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          {[
            { label: "Algorithm", value: "RS256" },
            { label: "Access Token TTL", value: "15 minutes" },
            { label: "Refresh Token TTL", value: "7 days" },
            { label: "Issuer", value: "https://auth.snip.dev" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-secondary border border-border px-4 py-3">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1 font-semibold">{label}</div>
              <div className="text-xs text-foreground">{value}</div>
            </div>
          ))}
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Active Access Token</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-secondary border border-border px-3 py-2.5 text-[10px] text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              {showToken ? MOCK_JWT : masked}
            </code>
            <button onClick={() => setShowToken(v => !v)} className="p-2.5 border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <CopyBtn text={MOCK_JWT} />
          </div>
        </div>
      </section>

      {/* Redis Cache */}
      <section className="bg-card border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-[#00d4e8]" />
          <span className="text-sm font-semibold text-foreground">Redis Cache</span>
        </div>
        <div className="grid grid-cols-3 gap-3" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          {[
            { label: "Hit Rate", value: "94.2%" },
            { label: "Total Keys", value: "3,841" },
            { label: "Memory Used", value: "128 MB" },
            { label: "TTL (redirects)", value: "3600s" },
            { label: "TTL (analytics)", value: "86400s" },
            { label: "Eviction Policy", value: "allkeys-lru" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-secondary border border-border px-3 py-3">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1 font-semibold">{label}</div>
              <div className="text-xs text-foreground">{value}</div>
            </div>
          ))}
        </div>
        <button onClick={() => toast.success("Cache flushed · 3,841 keys evicted from Redis")} className="flex items-center gap-2 border border-red-500/30 text-red-400 text-[11px] px-4 py-2 hover:bg-red-500/10 transition-colors" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          <RefreshCw size={11} /> Flush Cache
        </button>
      </section>

      {/* PostgreSQL */}
      <section className="bg-card border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-[#00d4e8]" />
          <span className="text-sm font-semibold text-foreground">PostgreSQL</span>
        </div>
        <div className="grid grid-cols-3 gap-3" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          {[
            { label: "Max Pool Size", value: "50" },
            { label: "Active Conns", value: "8" },
            { label: "Avg Query Time", value: "12ms" },
            { label: "Driver", value: "Npgsql 8.0" },
            { label: "Schema", value: "public" },
            { label: "Migrations", value: "14 applied" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-secondary border border-border px-3 py-3">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1 font-semibold">{label}</div>
              <div className="text-xs text-foreground">{value}</div>
            </div>
          ))}
        </div>
        <div className="border border-border p-4 bg-muted/20">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2.5 font-semibold">Optimized Query Pattern</div>
          <pre className="text-[10px] text-[#00d4e8] leading-relaxed overflow-x-auto" style={{ fontFamily: "JetBrains Mono, monospace" }}>{`SELECT destination_url, click_count
FROM short_links
WHERE slug = @slug
  AND (expires_at IS NULL OR expires_at > NOW())
  AND is_active = true
-- Index: idx_short_links_slug (B-tree, unique)
-- EF Core async · result cached in Redis on miss`}</pre>
        </div>
      </section>

      {/* Rate Limiting */}
      <section className="bg-card border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-[#00d4e8]" />
          <span className="text-sm font-semibold text-foreground">Rate Limiting</span>
        </div>
        <div className="space-y-2">
          {[
            { endpoint: "POST /api/v1/links", limit: "100 req/min", window: "Sliding", store: "Redis" },
            { endpoint: "GET /:slug", limit: "1000 req/min", window: "Fixed", store: "Redis" },
            { endpoint: "POST /auth/token", limit: "10 req/min", window: "Fixed", store: "Redis" },
          ].map(({ endpoint, limit, window, store }) => (
            <div key={endpoint} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 border border-border px-4 py-3">
              <code className="text-[11px] text-[#7c5aed] flex-1" style={{ fontFamily: "JetBrains Mono, monospace" }}>{endpoint}</code>
              <span className="text-[11px] text-foreground font-semibold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{limit}</span>
              <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{window} · {store}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Backend Architecture reference */}
      <section className="bg-card border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Server size={14} className="text-[#00d4e8]" />
          <span className="text-sm font-semibold text-foreground">Backend Architecture</span>
        </div>
        <div className="grid grid-cols-2 gap-3" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          {[
            { label: "Framework", value: "ASP.NET Core 8 · Minimal APIs" },
            { label: "ORM", value: "EF Core 8 · Npgsql provider" },
            { label: "Auth", value: "JWT Bearer · RS256 · IOptions<>" },
            { label: "Cache", value: "StackExchange.Redis · IDistributedCache" },
            { label: "Patterns", value: "Repository · CQRS · Mediator" },
            { label: "Async", value: "async/await · Channel<T> workers" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-secondary border border-border px-3 py-3">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1 font-semibold">{label}</div>
              <div className="text-[10px] text-foreground">{value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── App layout ─────────────────────────────────────────────────────────────

function AppLayout({ onLogout }: { onLogout: () => void }) {
  const [view, setView] = useState<Exclude<View, "auth">>("dashboard");
  const [links, setLinks] = useState<ShortLink[]>(INITIAL_LINKS);
  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar view={view} setView={setView} onLogout={onLogout} />
      <main className="flex-1 overflow-y-auto">
        {view === "dashboard" && <DashboardView links={links} setView={setView} />}
        {view === "links" && <LinksView links={links} setLinks={setLinks} />}
        {view === "analytics" && <AnalyticsView />}
        {view === "settings" && <SettingsView />}
      </main>
    </div>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function App() {
  const [isAuth, setIsAuth] = useState(false);
  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0c0e1a",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#c8d0e4",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
          },
        }}
      />
      {isAuth
        ? <AppLayout onLogout={() => setIsAuth(false)} />
        : <AuthScreen onAuth={() => setIsAuth(true)} />
      }
    </>
  );
}
