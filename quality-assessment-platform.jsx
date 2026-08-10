import React, { useState, useEffect, useMemo } from "react";
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, AreaChart, Area, ScatterChart, Scatter, ZAxis,
} from "recharts";
import {
  LayoutDashboard, ClipboardCheck, UploadCloud, Users, FolderKanban,
  BarChart3, FileText, SlidersHorizontal, Moon, Sun,
  TrendingUp, TrendingDown, Clock, Award, AlertTriangle, FileStack,
  ChevronRight, ChevronDown, Check, X, RotateCcw, Sparkles, FileCheck2,
  ScanLine, ListChecks, Gauge, Lightbulb, CheckCircle2, Plus,
  Trophy, Target, Activity, ShieldCheck, Filter, Download, ArrowUpRight,
  ArrowDownRight, Info, CircleDot, Star, Building2, Calendar, User,
  Eye, EyeOff, Pencil, Trash2, ArrowLeft, Lock, Mail,
} from "lucide-react";
import { useData } from "./src/DataContext.jsx";
import { api } from "./src/api.js";
import { useAuth } from "./src/AuthContext.jsx";
import { jsPDF } from "jspdf";

/* ============================ DESIGN TOKENS ============================ */
const C = {
  navy: "#13294B",
  navy2: "#1B3A6B",
  blue: "#2563EB",
  blueSoft: "#EEF3FF",
  emerald: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  bg: "#F6F8FB",
  card: "#FFFFFF",
  ink: "#0F1E38",
  muted: "#64748B",
  faint: "#94A3B8",
  line: "#E7ECF3",
};

/* ============================ MOCK DATA ============================ */
const RUBRIC = [
  { key: "Data Accuracy & Sourcing", weight: 20, desc: "Figures reconcile to source; citations complete and verifiable." },
  { key: "Anonymity Discipline", weight: 10, desc: "No client-identifying detail leaks in blind materials." },
  { key: "Section Completeness", weight: 15, desc: "All mandated sections present at required depth." },
  { key: "Narrative & Positioning", weight: 15, desc: "Investment thesis is sharp, logical and buyer-tuned." },
  { key: "Sector KPIs & Benchmarks", weight: 15, desc: "Right metrics, benchmarked against credible comps." },
  { key: "Risk & Compliance", weight: 10, desc: "Material risks disclosed; regulatory framing correct." },
  { key: "Formatting Consistency", weight: 10, desc: "Typography, tables and branding match house style." },
  { key: "Timeline & Turnaround", weight: 5, desc: "Delivered within agreed SLA without quality trade-off." },
];

const SAMPLE_SCORES = {
  "Data Accuracy & Sourcing": 4.5,
  "Anonymity Discipline": 4.0,
  "Section Completeness": 4.5,
  "Narrative & Positioning": 4.0,
  "Sector KPIs & Benchmarks": 4.5,
  "Risk & Compliance": 4.0,
  "Formatting Consistency": 4.5,
  "Timeline & Turnaround": 4.0,
};

const AI_NOTES = {
  "Data Accuracy & Sourcing": "Revenue build ties to the audited FY25 statements; two footnote references to segment margins are missing a source page.",
  "Anonymity Discipline": "One supplier name appears in the appendix logo strip — recommend redaction before circulation.",
  "Section Completeness": "All eleven IM sections present. Management bios are lighter than house standard.",
  "Narrative & Positioning": "Thesis is coherent; the 'why now' argument could lead the executive summary rather than close it.",
  "Sector KPIs & Benchmarks": "Unit economics (CAC, cohort retention) benchmarked against four listed comps — strong.",
  "Risk & Compliance": "Customer concentration risk disclosed; FX exposure quantified but not stress-tested.",
  "Formatting Consistency": "Consistent grid and type scale throughout; two charts use an off-palette accent.",
  "Timeline & Turnaround": "Delivered 1 day inside the 6-day SLA.",
};

const EMPLOYEES = [
  { name: "Abhinav Dasgupta", unit: "Investment Banking", avg: 4.6, reviews: 42, projects: 17, best: 4.9, low: 3.9, trend: +0.4, ready: 92, consistency: 96, init: "AD" },
  { name: "Banala Dinesh", unit: "Consulting", avg: 4.4, reviews: 38, projects: 15, best: 4.8, low: 3.6, trend: +0.2, ready: 86, consistency: 91, init: "BD" },
  { name: "Devyansh Rajput", unit: "Investment Banking", avg: 4.3, reviews: 35, projects: 14, best: 4.7, low: 3.5, trend: +0.5, ready: 83, consistency: 88, init: "DR" },
  { name: "Dhritiman Mitra", unit: "Deal Advisory", avg: 4.2, reviews: 33, projects: 13, best: 4.6, low: 3.4, trend: +0.1, ready: 80, consistency: 86, init: "DM" },
  { name: "Mayank Yadav", unit: "Deal Advisory", avg: 4.0, reviews: 29, projects: 12, best: 4.5, low: 3.2, trend: -0.1, ready: 74, consistency: 82, init: "MY" },
  { name: "Rishabh Mannari", unit: "Research", avg: 3.9, reviews: 27, projects: 11, best: 4.4, low: 3.1, trend: +0.2, ready: 71, consistency: 80, init: "RM" },
  { name: "Rudransh Bhardwaj", unit: "Investment Banking", avg: 3.8, reviews: 24, projects: 10, best: 4.3, low: 3.0, trend: +0.4, ready: 68, consistency: 77, init: "RB" },
  { name: "Sahil Sachdeva", unit: "Deal Advisory", avg: 3.7, reviews: 22, projects: 9, best: 4.2, low: 2.9, trend: -0.2, ready: 62, consistency: 74, init: "SS" },
  { name: "Sumit Pandey", unit: "Consulting", avg: 3.6, reviews: 20, projects: 8, best: 4.1, low: 2.8, trend: +0.1, ready: 58, consistency: 72, init: "SP" },
  { name: "Tarun Kumar", unit: "Research", avg: 3.5, reviews: 18, projects: 7, best: 4.0, low: 2.7, trend: -0.1, ready: 52, consistency: 69, init: "TK" },
  { name: "Varun Jhaveri", unit: "Research", avg: 3.3, reviews: 15, projects: 6, best: 3.9, low: 2.5, trend: -0.3, ready: 46, consistency: 65, init: "VJ" },
];

const DOC_TYPES = ["Teaser", "Information Memorandum (IM/CIM)", "Financial Model"];

const RECENT = [
  { emp: "Abhinav Dasgupta", project: "Project Meridian", doc: "Information Memorandum", date: "Aug 1, 2026", score: 4.6, status: "Approved" },
  { emp: "Banala Dinesh", project: "Project Kestrel", doc: "Financial Model", date: "Jul 31, 2026", score: 4.3, status: "Approved" },
  { emp: "Devyansh Rajput", project: "Project Aurora", doc: "Teaser", date: "Jul 30, 2026", score: 3.9, status: "Needs Revision" },
  { emp: "Dhritiman Mitra", project: "Project Vantage", doc: "Valuation Report", date: "Jul 29, 2026", score: 4.1, status: "Approved" },
  { emp: "Mayank Yadav", project: "Project Cobalt", doc: "Due Diligence Report", date: "Jul 27, 2026", score: 3.3, status: "Rejected" },
  { emp: "Rishabh Mannari", project: "Project Harbor", doc: "Market Research", date: "Jul 26, 2026", score: 3.8, status: "Approved" },
];

const MONTHLY = [
  { m: "Jan", score: 3.8 }, { m: "Feb", score: 3.9 }, { m: "Mar", score: 4.0 },
  { m: "Apr", score: 3.95 }, { m: "May", score: 4.1 }, { m: "Jun", score: 4.2 },
  { m: "Jul", score: 4.25 }, { m: "Aug", score: 4.3 },
];

const DOC_PERF = [
  { t: "IM", score: 4.4 }, { t: "Teaser", score: 4.0 }, { t: "Model", score: 4.3 },
  { t: "Pitch", score: 3.8 }, { t: "Note", score: 4.1 }, { t: "Research", score: 3.9 },
  { t: "DD", score: 3.7 }, { t: "Valuation", score: 4.2 },
];

const DISTRIBUTION = [
  { name: "0–1", value: 3, color: C.red },
  { name: "1–2", value: 9, color: "#FB7185" },
  { name: "2–3", value: 34, color: C.amber },
  { name: "3–4", value: 118, color: "#60A5FA" },
  { name: "4–5", value: 84, color: C.emerald },
];

const spark = (seed) => Array.from({ length: 12 }, (_, i) =>
  ({ x: i, y: 40 + Math.sin(i / 1.7 + seed) * 14 + (i * (seed % 3)) }));

/* ============================ HELPERS ============================ */
const gradeFor = (s) => s >= 4.5 ? "A+" : s >= 4.0 ? "A" : s >= 3.5 ? "B+" : s >= 3.0 ? "B" : s >= 2.5 ? "C" : "D";
const scoreColor = (s) => s >= 4.5 ? C.emerald : s >= 4.0 ? "#22C55E" : s >= 3.5 ? C.blue : s >= 3.0 ? C.amber : C.red;
const STATUS_STYLES = {
  Approved: { bg: "#E7F8F0", fg: "#0F9D6B", dot: C.emerald },
  Pending: { bg: "#EEF4FF", fg: "#2563EB", dot: C.blue },
  "Needs Revision": { bg: "#FEF5E6", fg: "#B77400", dot: C.amber },
  Rejected: { bg: "#FDECEC", fg: "#C4322B", dot: C.red },
};
const statusStyle = (st) => STATUS_STYLES[st] || { bg: "#F1F5FB", fg: C.faint, dot: C.faint };

/** Short display name for KPI tiles (avoid cryptic "A. D." initials). */
function shortPersonName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function parseInsightLine(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const sep = raw.includes(" — ") ? " — " : raw.includes(" – ") ? " – " : null;
  let head = raw;
  let body = "";
  if (sep) {
    const i = raw.indexOf(sep);
    head = raw.slice(0, i).trim();
    body = raw.slice(i + sep.length).trim();
  }
  let title = head;
  let score = "";
  if (head.includes(" · ")) {
    const parts = head.split(" · ");
    title = parts[0].trim();
    score = parts.slice(1).join(" · ").trim();
  }
  return { title, score, body: body || (!score ? head : "") };
}

function InsightLine({ text, tone }) {
  const parsed = parseInsightLine(text);
  if (!parsed) return null;
  const showSplit = Boolean(parsed.score || (parsed.body && parsed.body !== parsed.title));
  return (
    <div className={`qa-insight-item ${tone || ""}`}>
      {showSplit ? (
        <>
          <div className="qa-insight-top">
            <span className="qa-insight-title">{parsed.title}</span>
            {parsed.score ? <span className="qa-insight-score">{parsed.score}</span> : null}
          </div>
          {parsed.body && parsed.body !== parsed.title ? (
            <p className="qa-insight-body">{parsed.body}</p>
          ) : null}
        </>
      ) : (
        <p className="qa-insight-body solo">{parsed.title}</p>
      )}
    </div>
  );
}

/* ============================ TINY PRIMITIVES ============================ */
function Sparkline({ seed, color }) {
  const data = useMemo(() => spark(seed), [seed]);
  return (
    <ResponsiveContainer width="100%" height={38}>
      <AreaChart data={data} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={`sg${seed}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2} fill={`url(#sg${seed})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Ring({ value, max = 5, size = 168, stroke = 14, animate, light }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const [offset, setOffset] = useState(circ);
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ - circ * pct), animate ? 120 : 0);
    return () => clearTimeout(t);
  }, [circ, pct, animate]);
  const valueColor = light ? "#fff" : C.navy;
  const subColor = light ? "rgba(255,255,255,.65)" : C.faint;
  const track = light ? "rgba(255,255,255,.18)" : C.line;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={C.blue} />
            <stop offset="100%" stopColor={C.emerald} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ringGrad)"
          strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div style={{ fontSize: size * 0.28, fontWeight: 800, color: valueColor, lineHeight: 1 }}>
            {value.toFixed(1)}
          </div>
          <div style={{ fontSize: Math.max(10, size * 0.1), color: subColor, fontWeight: 600, marginTop: 2 }}>out of {max}</div>
        </div>
      </div>
    </div>
  );
}

function Bar5({ value }) {
  return (
    <div className="qa-bar5">
      <div className="qa-bar5-fill" style={{ width: `${(value / 5) * 100}%`, background: scoreColor(value) }} />
    </div>
  );
}

/* ============================ SIDEBAR ============================ */
const NAV_ADMIN = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "reviews", label: "Quality Reviews", icon: ClipboardCheck },
  { id: "upload", label: "Upload Assessment", icon: UploadCloud },
  { id: "employees", label: "Employees", icon: Users },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "rubric", label: "Rubric Settings", icon: SlidersHorizontal },
];

const NAV_EMPLOYEE = [
  { id: "dashboard", label: "My dashboard", icon: LayoutDashboard },
  { id: "projects", label: "My projects", icon: FolderKanban },
];

function Sidebar({ active, setActive }) {
  const { kpis } = useData();
  const { user, isAdmin, logout } = useAuth();
  const nav = isAdmin ? NAV_ADMIN : NAV_EMPLOYEE;
  const used = kpis?.creditsUsed ?? 0;
  const total = kpis?.creditsTotal ?? 2000;
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const reviewer = user?.displayName || kpis?.reviewerName || "User";
  const role = isAdmin ? (kpis?.reviewerRole || "Admin") : (user?.employeeUnit || "Analyst");
  const init = reviewer.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <aside className="qa-sidebar">
      <div className="qa-brand">
        <img src="/evergauge-mark.png?v=5" alt="" className="qa-brand-mark-img" />
        <div className="qa-brand-text">
          <div className="qa-brand-name">Ever<span>Gauge</span></div>
          <div className="qa-brand-sub">{isAdmin ? "Admin workspace" : "Employee workspace"}</div>
        </div>
      </div>

      <div className="qa-nav-group-label">Workspace</div>
      <nav className="qa-nav">
        {nav.map((n) => {
          const A = n.icon;
          const on = active === n.id;
          return (
            <button key={n.id} className={`qa-nav-item ${on ? "on" : ""}`} onClick={() => setActive(n.id)}>
              <A size={18} />
              <span>{n.label}</span>
            </button>
          );
        })}
      </nav>

      {isAdmin && (
        <div className="qa-side-card">
          <div className="qa-side-card-title"><Sparkles size={14} /> AI credits</div>
          <div className="qa-side-card-bar"><span style={{ width: `${pct}%` }} /></div>
          <div className="qa-side-card-meta">{used.toLocaleString()} / {total.toLocaleString()} assessments</div>
        </div>
      )}

      <div className="qa-side-user">
        <div className="qa-avatar" style={{ background: "linear-gradient(135deg,#2563EB,#10B981)" }}>{init}</div>
        <div className="qa-side-user-meta">
          <div className="qa-side-user-name">{reviewer}</div>
          <div className="qa-side-user-role">{role}</div>
        </div>
        <button className="qa-icon-btn" title="Sign out" onClick={() => logout()} style={{ width: 32, height: 32 }}>
          <X size={14} />
        </button>
      </div>
    </aside>
  );
}

/* ============================ TOPBAR ============================ */
function Topbar({ title, subtitle, dark, setDark, onUpload, showUpload }) {
  return (
    <header className="qa-topbar">
      <div>
        <h1 className="qa-topbar-title">{title}</h1>
        {subtitle ? <p className="qa-topbar-sub">{subtitle}</p> : null}
      </div>
      <div className="qa-topbar-actions">
        <button className="qa-icon-btn" onClick={() => setDark(!dark)} title="Toggle theme">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        {showUpload && (
          <button className="qa-btn-primary" onClick={onUpload}>
            <Plus size={16} /> New assessment
          </button>
        )}
      </div>
    </header>
  );
}

/* ============================ DASHBOARD ============================ */
function qualityStreakData(reviews) {
  const byEmp = {};
  for (const r of reviews || []) {
    if (r?.score == null || r.score === "" || !r.emp) continue;
    if (!byEmp[r.emp]) byEmp[r.emp] = [];
    byEmp[r.emp].push(r);
  }

  const active = [];
  const broken = [];

  for (const [name, rows] of Object.entries(byEmp)) {
    const sorted = [...rows].sort((a, b) => {
      const da = new Date(a.review_date || a.date || 0).getTime();
      const db = new Date(b.review_date || b.date || 0).getTime();
      if (db !== da) return db - da;
      return Number(b.id || 0) - Number(a.id || 0);
    });

    let streak = 0;
    for (const r of sorted) {
      if (Number(r.score) >= 4) streak += 1;
      else break;
    }

    if (streak > 0) {
      active.push({
        name: shortPersonName(name),
        full: name,
        streak,
      });
      continue;
    }

    // Latest review fell below 4 — check whether a prior 4.0+ run was broken
    const breaker = sorted[0];
    if (!breaker || Number(breaker.score) >= 4) continue;
    let priorStreak = 0;
    for (const r of sorted.slice(1)) {
      if (Number(r.score) >= 4) priorStreak += 1;
      else break;
    }
    if (priorStreak < 1) continue;
    broken.push({
      name: shortPersonName(name),
      full: name,
      priorStreak,
      at: new Date(breaker.review_date || breaker.date || 0).getTime(),
    });
  }

  active.sort((a, b) => b.streak - a.streak || a.full.localeCompare(b.full));
  broken.sort((a, b) => b.at - a.at || b.priorStreak - a.priorStreak);
  return { active, lastReset: broken[0] || null };
}

function Dashboard({ go }) {
  const { employees = [], reviews = [], analytics = {}, kpis } = useData();
  const distribution = analytics.distribution?.length ? analytics.distribution : DISTRIBUTION;
  const monthly = analytics.monthly?.length ? analytics.monthly : MONTHLY;
  const docPerf = analytics.docPerf?.length ? analytics.docPerf : DOC_PERF;
  const evaluated = employees.filter((e) => Number(e.reviews) > 0 && e.avg != null && Number(e.avg) > 0);
  const leaders = [...evaluated].sort((a, b) => Number(b.avg || 0) - Number(a.avg || 0)).slice(0, 5);
  const top = leaders[0];
  const byLowest = [...evaluated].sort((a, b) => Number(a.avg || 0) - Number(b.avg || 0));
  const low =
    evaluated.length >= 2
      ? byLowest[0]
      : evaluated.length === 1 && Number(evaluated[0].avg) < 3.8
        ? evaluated[0]
        : null;
  const scoredReviews = reviews.filter((r) => r.score != null);
  const avgScore = kpis?.avgScore ?? (scoredReviews.length ? scoredReviews.reduce((a, r) => a + Number(r.score), 0) / scoredReviews.length : 0);
  const reviewCount = kpis?.totalReviews ?? reviews.length;
  const distTotal = distribution.reduce((a, d) => a + Number(d.value || 0), 0) || 1;
  const passPct = Math.round(
    distribution
      .filter((d) => {
        const n = String(d.name || "").replace(/[–—]/g, "-");
        return n === "3-4" || n === "4-5";
      })
      .reduce((a, d) => a + Number(d.value || 0), 0) / distTotal * 100
  );
  const sparkSeed = (kpis?.sparkline || []).map((s) => s.count);
  const { active: streaks, lastReset } = qualityStreakData(reviews);
  const streakMax = Math.max(3, ...streaks.map((s) => s.streak), 1);

  const kpisUi = [
    { label: "Total reviews", value: String(reviewCount), icon: FileStack, tint: C.blue, seed: 1 },
    { label: "Average quality score", value: avgScore ? Number(avgScore).toFixed(2) : "—", icon: Gauge, tint: C.emerald, seed: 2 },
    { label: "Top performer", value: top ? shortPersonName(top.name) : "—", trend: Number(top?.trend || 0), icon: Trophy, tint: "#F59E0B", seed: 6 },
    { label: "Needs coaching", value: low ? shortPersonName(low.name) : "—", trend: Number(low?.trend || 0), icon: AlertTriangle, tint: C.red, seed: 7 },
  ];

  return (
    <div className="qa-stack">
      <div className="qa-kpi-grid qa-kpi-grid-4">
        {kpisUi.map((k, ki) => {
          const I = k.icon;
          const hasTrend = typeof k.trend === "number" && Number.isFinite(k.trend);
          const positive = k.good === "down" ? k.trend < 0 : k.trend > 0;
          return (
            <div key={k.label} className="qa-card qa-kpi reveal">
              <div className="qa-kpi-top">
                <span className="qa-kpi-icon" style={{ background: `${k.tint}18`, color: k.tint }}><I size={18} /></span>
                {hasTrend ? (
                  <span className={`qa-trend ${positive ? "up" : "down"}`}>
                    {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {Math.abs(k.trend)}
                  </span>
                ) : <span />}
              </div>
              <div className="qa-kpi-value">{k.value}</div>
              <div className="qa-kpi-label">{k.label}</div>
              <div className="qa-kpi-spark"><Sparkline seed={sparkSeed[ki] || k.seed} color={k.tint} /></div>
            </div>
          );
        })}
      </div>

      <div className="qa-grid-3">
        <div className="qa-card reveal">
          <CardHead title="Quality distribution" sub={`${distTotal} scored deliverables`} />
          <div style={{ height: 240, position: "relative" }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={distribution} dataKey="value" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="none">
                  {distribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<Tip suffix=" docs" />} cursor={false} />
              </PieChart>
            </ResponsiveContainer>
            <div className="qa-donut-center">
              <div className="qa-donut-num">{passPct}%</div>
              <div className="qa-donut-cap">score ≥ 3.0</div>
            </div>
          </div>
          <div className="qa-legend">
            {distribution.map((d) => (
              <div key={d.name} className="qa-legend-item">
                <span className="qa-dot" style={{ background: d.color }} /> {d.name}
                <b>{d.value}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="qa-card reveal">
          <CardHead
            title="Quality streak"
            sub="Consecutive latest reviews scoring 4.0+ · resets when a review falls below 4"
            right={
              lastReset ? (
                <div className="qa-streak-reset" title={`Previously ${lastReset.priorStreak} in a row at 4.0+`}>
                  <span className="qa-streak-reset-label">Latest reset</span>
                  <span className="qa-streak-reset-name">{lastReset.full}</span>
                </div>
              ) : null
            }
          />
          <div style={{ height: 292 }}>
            {streaks.length ? (
              <ResponsiveContainer>
                <BarChart data={streaks} margin={{ top: 10, right: 12, left: -8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={52} />
                  <YAxis allowDecimals={false} domain={[0, streakMax]} tick={{ fill: C.faint, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={false}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="qa-tip">
                          <div className="qa-tip-label">{d.full}</div>
                          <div className="qa-tip-val">{d.streak} review{d.streak === 1 ? "" : "s"} at 4.0+</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="streak" name="Streak" radius={[6, 6, 0, 0]} maxBarSize={42} activeBar={false}>
                    {streaks.map((d) => (
                      <Cell key={d.full} fill={d.streak >= 3 ? C.emerald : d.streak >= 1 ? C.blue : C.faint} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="qa-empty-chart">
                {lastReset
                  ? `No active streaks — latest reset: ${lastReset.full}`
                  : "No active 4.0+ streaks yet — they appear once consecutive high scores land."}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="qa-grid-2">
        <div className="qa-card reveal">
          <CardHead title="Average quality — monthly trend" sub="Rolling 8 months · 2026" />
          <div style={{ height: 264 }}>
            <ResponsiveContainer>
              <AreaChart data={monthly} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.blue} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="m" tick={{ fill: C.faint, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis domain={[3.5, 4.5]} tick={{ fill: C.faint, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip suffix=" / 5" />} cursor={false} />
                <Area type="monotone" dataKey="score" stroke={C.blue} strokeWidth={3} fill="url(#trend)" dot={{ r: 3, fill: C.blue }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="qa-card reveal">
          <CardHead title="Performance by document type" sub="Average score across the house" />
          <div style={{ height: 264 }}>
            <ResponsiveContainer>
              <BarChart data={docPerf} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="t" tick={{ fill: C.faint, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 5]} tick={{ fill: C.faint, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip suffix=" / 5" />} cursor={false} />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={34} activeBar={false}>
                  {docPerf.map((d, i) => <Cell key={i} fill={scoreColor(d.score)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="qa-card reveal">
          <CardHead title="Employee leaderboard" sub="Top performers this quarter" right={<button className="qa-link" onClick={() => go("employees")}>View all</button>} />
          <div className="qa-lead">
            {leaders.map((e, i) => (
              <div key={e.name} className="qa-lead-row">
                <span className={`qa-rank r${i + 1}`}>{i + 1}</span>
                <div className="qa-avatar sm" style={{ background: rankGrad(i) }}>{e.init}</div>
                <div className="qa-lead-meta">
                  <div className="qa-lead-name">{e.name}</div>
                  <div className="qa-lead-sub">{e.unit} · {e.projects} projects</div>
                </div>
                <div className="qa-lead-score" style={{ color: scoreColor(e.avg) }}>{Number(e.avg).toFixed(1)}</div>
                <span className={`qa-trend mini ${e.trend >= 0 ? "up" : "down"}`}>
                  {e.trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(e.trend)}
                </span>
              </div>
            ))}
            {!leaders.length && <div className="qa-muted" style={{ padding: "12px 4px" }}>No scored employees yet.</div>}
          </div>
        </div>

      <div className="qa-card reveal">
        <CardHead title="Recent reviews" sub="Latest AI-assessed deliverables" right={<button className="qa-link" onClick={() => go("reviews")}>Open all reviews</button>} />
        <ReviewsTable rows={reviews.slice(0, 7)} go={go} />
      </div>
    </div>
  );
}

const rankGrad = (i) => [
  "linear-gradient(135deg,#F59E0B,#FBBF24)",
  "linear-gradient(135deg,#64748B,#94A3B8)",
  "linear-gradient(135deg,#B45309,#D97706)",
  "linear-gradient(135deg,#2563EB,#60A5FA)",
  "linear-gradient(135deg,#10B981,#34D399)",
][i] || "linear-gradient(135deg,#2563EB,#10B981)";

function formatDisplayDate(v) {
  if (v == null || v === "") return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) {
    const s = String(v);
    if (/^[A-Za-z]{3}\s+\d/.test(s)) return s; // already like "Aug 5, 2026"
    return s.slice(0, 10);
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toInputDate(v) {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function scoreTone(s) {
  if (s == null) return { label: "—", color: C.faint };
  if (s >= 4.4) return { label: "Strong", color: C.emerald };
  if (s >= 3.8) return { label: "On track", color: C.blue };
  return { label: "Watch", color: C.amber };
}

function hexToRgb(hex) {
  const h = String(hex || "#000000").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function pdfWrap(doc, text, x, y, maxWidth, lineHeight = 4.6) {
  const lines = doc.splitTextToSize(String(text || ""), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

/** Build and directly download a scorecard PDF (no print dialog). */
function downloadAssessmentScorecardPdf(detail) {
  const dims = (detail.scores || []).map((r) => ({
    key: r.key,
    desc: r.desc || "",
    weight: Number(r.weight || 0),
    score: r.score == null ? null : Number(r.score),
    is_manual: Boolean(r.is_manual),
  }));
  const scored = dims.filter((d) => d.score != null);
  const overall = detail.overall_score == null ? null : Number(detail.overall_score);
  const strengths = (detail.strengths || []).filter((s) => typeof s === "string" && s.trim());
  const improvements = (detail.improvements || []).filter((s) => typeof s === "string" && s.trim());
  const highest = [...scored].sort((a, b) => b.score - a.score)[0];
  const lowest = [...scored].sort((a, b) => a.score - b.score)[0];
  const grade = overall == null ? "—" : gradeFor(overall);
  const overallColor = overall == null ? C.faint : scoreColor(overall);
  const oc = hexToRgb(overallColor);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (need) => {
    if (y + need > pageH - 14) {
      doc.addPage();
      y = margin;
    }
  };

  const sectionTitle = (title, sub) => {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(19, 41, 75);
    doc.text(title, margin, y);
    y += 5;
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      y = pdfWrap(doc, sub, margin, y, contentW, 4);
      y += 2;
    }
  };

  // Brand
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("EverGauge · Assessment scorecard", margin, y);
  y += 8;

  // Header card
  ensureSpace(42);
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, contentW, 36, 3, 3, "FD");
  const headTop = y + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(19, 41, 75);
  doc.text(String(detail.project || "Assessment"), margin + 5, headTop);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    [detail.emp, detail.doc, formatDisplayDate(detail.review_date || detail.date)].filter(Boolean).join("   ·   "),
    margin + 5,
    headTop + 7
  );

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("HIGHEST", margin + 5, headTop + 16);
  doc.text("LOWEST", margin + 55, headTop + 16);
  doc.text("OVERALL", margin + 105, headTop + 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...Object.values(hexToRgb(C.emerald)));
  doc.text(String(highest?.key?.split(" & ")[0] || "—").slice(0, 22), margin + 5, headTop + 22);
  doc.setTextColor(...Object.values(hexToRgb(C.amber)));
  doc.text(String(lowest?.key?.split(" & ")[0] || "—").slice(0, 22), margin + 55, headTop + 22);
  doc.setTextColor(oc.r, oc.g, oc.b);
  doc.text(overall == null ? "—" : overall.toFixed(2), margin + 105, headTop + 22);

  // Grade badge (right)
  const badgeX = pageW - margin - 28;
  doc.setFillColor(oc.r, oc.g, oc.b);
  doc.roundedRect(badgeX, headTop - 2, 22, 22, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(String(grade), badgeX + 11, headTop + 12, { align: "center" });
  doc.setFontSize(8);
  doc.text(overall == null ? "—" : overall.toFixed(1), badgeX + 11, headTop + 18, { align: "center" });
  y += 42;

  // Rubric scorecard
  sectionTitle("Rubric scorecard", `${dims.length} dimensions · overall = average of scores · ${detail.doc || ""}`);
  ensureSpace(10);
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("DIMENSION", margin + 2, y + 4.8);
  doc.text("SCORE", margin + 105, y + 4.8);
  doc.text("SHARE", margin + 125, y + 4.8);
  doc.text("CONTRIB", margin + 145, y + 4.8);
  doc.text("STATUS", margin + 165, y + 4.8);
  y += 9;

  dims.forEach((r) => {
    const s = r.score;
    const w = s == null ? 0 : (s * r.weight / 100);
    const tone = r.is_manual && s == null ? { label: "Manual", color: C.amber } : scoreTone(s);
    const tc = hexToRgb(tone.color);
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const name = `${r.key}${r.is_manual ? " · manual" : ""}`;
    doc.text(name.slice(0, 48), margin + 2, y);
    if (r.desc) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const descLines = doc.splitTextToSize(r.desc, 95);
      doc.text(descLines.slice(0, 2), margin + 2, y + 4);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(tc.r, tc.g, tc.b);
    doc.text(s == null ? "—" : s.toFixed(1), margin + 105, y + 2);
    // mini bar
    if (s != null) {
      const barW = 14;
      const fill = Math.max(0, Math.min(1, s / 5)) * barW;
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(margin + 112, y - 1, barW, 2.2, 1, 1, "F");
      doc.setFillColor(tc.r, tc.g, tc.b);
      doc.roundedRect(margin + 112, y - 1, fill, 2.2, 1, 1, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`${r.weight}%`, margin + 125, y + 2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(s == null ? "—" : w.toFixed(2), margin + 145, y + 2);
    doc.setFontSize(8);
    doc.setTextColor(tc.r, tc.g, tc.b);
    doc.text(tone.label, margin + 165, y + 2);
    y += 12;
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y - 3, pageW - margin, y - 3);
  });

  y += 4;

  // Dimension profile
  sectionTitle("Dimension profile", "Performance across the rubric");
  scored.forEach((r) => {
    ensureSpace(8);
    const col = hexToRgb(scoreColor(r.score));
    const label = String(r.key).slice(0, 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label, margin, y + 2);
    const barX = margin + 52;
    const barMax = contentW - 68;
    const fill = Math.max(0, Math.min(1, r.score / 5)) * barMax;
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(barX, y, barMax, 3.2, 1.5, 1.5, "F");
    doc.setFillColor(col.r, col.g, col.b);
    doc.roundedRect(barX, y, fill, 3.2, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(col.r, col.g, col.b);
    doc.text(r.score.toFixed(1), pageW - margin, y + 2.4, { align: "right" });
    y += 7;
  });
  if (!scored.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("No scored dimensions.", margin, y);
    y += 6;
  }

  y += 4;

  const drawInsightBlock = (title, items, accentHex) => {
    const ac = hexToRgb(accentHex);
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(ac.r, ac.g, ac.b);
    doc.text(title, margin, y);
    y += 6;
    if (!items.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("None recorded.", margin, y);
      y += 8;
      return;
    }
    items.forEach((raw) => {
      const text = String(raw);
      const sep = text.includes(" — ") ? " — " : null;
      let head = text;
      let body = "";
      if (sep) {
        const i = text.indexOf(sep);
        head = text.slice(0, i).trim();
        body = text.slice(i + sep.length).trim();
      }
      const lines = doc.splitTextToSize(body || head, contentW - 8);
      const boxH = 8 + (body ? lines.length * 4.2 : 0) + (body ? 4 : 0);
      ensureSpace(boxH + 4);
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, contentW, boxH, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(head.slice(0, 90), margin + 3, y + 5);
      if (body) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(lines, margin + 3, y + 10);
      }
      y += boxH + 3;
    });
  };

  drawInsightBlock("Strengths", strengths, C.emerald);
  y += 2;
  drawInsightBlock("Improvement opportunities", improvements, C.amber);

  const safe = String(detail.project || "scorecard").replace(/[^\w\-]+/g, "_").slice(0, 40);
  doc.save(`scorecard-${safe}-${detail.id || "review"}.pdf`);
}

/* ============================ REUSABLE TABLE ============================ */
function ReviewsTable({ rows, go, dense, onDeleted }) {
  const { employees, projects, docTypes, setLatestReviewId, refresh } = useData();
  const { isAdmin } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({ employee: "", project: "", document: "", date: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const openReview = (id) => {
    if (id) setLatestReviewId(id);
    go("results");
  };

  const openEdit = (r) => {
    if (!isAdmin || !r?.id) return;
    setEditRow(r);
    setEditForm({
      employee: r.emp || "",
      project: r.project || "",
      document: r.doc || "",
      date: toInputDate(r.review_date || r.date),
    });
  };

  const saveEdit = async () => {
    if (!editRow?.id || savingEdit) return;
    if (!editForm.employee || !editForm.project || !editForm.document || !editForm.date) {
      window.alert("Employee, project, document, and date are required.");
      return;
    }
    setSavingEdit(true);
    try {
      await api.updateReview(editRow.id, {
        employee: editForm.employee,
        project: editForm.project,
        documentType: editForm.document,
        reviewDate: editForm.date,
      });
      await refresh();
      setEditRow(null);
    } catch (err) {
      window.alert(err.message || "Could not save changes");
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteReview = async (r) => {
    if (!r?.id || !isAdmin) return;
    const ok = window.confirm(`Delete review for ${r.emp} · ${r.doc}? This cannot be undone.`);
    if (!ok) return;
    setBusyId(r.id);
    try {
      await api.deleteReview(r.id);
      await refresh();
      onDeleted?.(r.id);
    } catch (err) {
      window.alert(err.message || "Could not delete review");
    } finally {
      setBusyId(null);
    }
  };

  const downloadPdf = async (r) => {
    if (!r?.id) return;
    setBusyId(r.id);
    try {
      const detail = await api.review(r.id);
      downloadAssessmentScorecardPdf(detail);
    } catch (err) {
      window.alert(err.message || "Could not download scorecard");
    } finally {
      setBusyId(null);
    }
  };

  const projectOptions = projects?.length
    ? [...new Set(projects.map((p) => p.name).filter(Boolean))]
    : [...new Set(rows.map((r) => r.project).filter(Boolean))];
  const typeOptions = docTypes?.length ? docTypes : [...new Set(rows.map((r) => r.doc).filter(Boolean))];

  return (
    <>
      <div className="qa-table-wrap">
        <table className="qa-table">
          <thead>
            <tr>
              <th>Employee</th><th>Project</th><th>Document</th><th>Date</th>
              <th>Overall</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const emp = employees.find((e) => e.name === r.emp);
              const score = Number(r.score || 0);
              const busy = busyId === r.id;
              return (
                <tr key={r.id || i} className="qa-row">
                  <td>
                    <div className="qa-cell-emp">
                      <div className="qa-avatar xs" style={{ background: rankGrad(i % 5) }}>{emp?.init || "•"}</div>
                      {r.emp}
                    </div>
                  </td>
                  <td className="qa-muted">{r.project}</td>
                  <td>{r.doc}</td>
                  <td className="qa-muted">{r.date}</td>
                  <td>
                    <div className="qa-score-cell">
                      <span className="qa-grade-chip" style={{ color: scoreColor(score), background: `${scoreColor(score)}14` }}>{gradeFor(score)}</span>
                      <b style={{ color: scoreColor(score) }}>{score.toFixed(1)}</b>
                    </div>
                  </td>
                  <td>
                    <div className="qa-row-actions">
                      <button type="button" className="qa-icon-btn" title="View" disabled={busy} onClick={() => openReview(r.id)}>
                        <Eye size={16} />
                      </button>
                      <button type="button" className="qa-icon-btn" title="Edit details" disabled={busy || !isAdmin} onClick={() => openEdit(r)}>
                        <Pencil size={16} />
                      </button>
                      <button type="button" className="qa-icon-btn danger" title="Delete" disabled={busy || !isAdmin} onClick={() => deleteReview(r)}>
                        <Trash2 size={16} />
                      </button>
                      <button type="button" className="qa-icon-btn" title="Download scorecard PDF" disabled={busy} onClick={() => downloadPdf(r)}>
                        <Download size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editRow && (
        <div className="qa-modal-backdrop" onClick={() => !savingEdit && setEditRow(null)}>
          <div className="qa-modal" onClick={(e) => e.stopPropagation()}>
            <CardHead title="Edit review details" sub={`${editRow.emp} · ${editRow.doc}`} />
            <div className="qa-form" style={{ marginTop: 8 }}>
              <Field label="Employee">
                <Select
                  value={editForm.employee}
                  options={employees.map((e) => e.name)}
                  onChange={(v) => setEditForm((f) => ({ ...f, employee: v }))}
                />
              </Field>
              <Field label="Project">
                <input
                  className="qa-input"
                  list="qa-edit-projects"
                  value={editForm.project}
                  onChange={(e) => setEditForm((f) => ({ ...f, project: e.target.value }))}
                />
                <datalist id="qa-edit-projects">
                  {projectOptions.map((p) => <option key={p} value={p} />)}
                </datalist>
              </Field>
              <Field label="Document">
                <Select
                  value={typeOptions.includes(editForm.document) ? editForm.document : (typeOptions[0] || editForm.document)}
                  options={typeOptions.includes(editForm.document) ? typeOptions : [editForm.document, ...typeOptions].filter(Boolean)}
                  onChange={(v) => setEditForm((f) => ({ ...f, document: v }))}
                />
              </Field>
              <Field label="Date">
                <input
                  className="qa-input"
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                />
              </Field>
            </div>
            <div className="qa-decision" style={{ marginTop: 18 }}>
              <button type="button" className="qa-btn-ghost" disabled={savingEdit} onClick={() => setEditRow(null)}>Cancel</button>
              <div className="qa-decision-spacer" />
              <button type="button" className="qa-btn-primary" disabled={savingEdit} onClick={saveEdit}>
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================ UPLOAD → PROCESSING ============================ */
const STEPS = [
  { label: "Reading document", icon: FileCheck2 },
  { label: "Extracting sections", icon: ScanLine },
  { label: "Checking against rubric", icon: ListChecks },
  { label: "Scoring dimensions", icon: Gauge },
  { label: "Generating insights", icon: Lightbulb },
  { label: "Almost done…", icon: CheckCircle2 },
];

function Upload({ phase, setPhase, go }) {
  const { employees, docTypes, refresh, setLatestReviewId, kpis } = useData();
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    employee: "",
    project: "Project Meridian",
    documentType: "Teaser",
    reviewDate: new Date().toISOString().slice(0, 10),
    reviewer: "Dhritiman Mitra",
    businessUnit: "Capital",
    client: "",
  });

  useEffect(() => {
    if (kpis?.reviewerName) setForm((f) => ({ ...f, reviewer: kpis.reviewerName }));
  }, [kpis?.reviewerName]);

  useEffect(() => {
    if (!form.employee && employees[0]) {
      const unit = ["Capital", "Algodel"].includes(employees[0].unit) ? employees[0].unit : "Capital";
      setForm((f) => ({ ...f, employee: employees[0].name, businessUnit: unit }));
    }
  }, [employees, form.employee]);

  useEffect(() => {
    if (phase !== "processing") return;
    setStep(0); setProgress(8);
    const iv = setInterval(() => setProgress((p) => Math.min(p + 0.35, 92)), 120);
    const sv = setInterval(() => setStep((s) => (s < STEPS.length - 1 ? s + 1 : s)), 1400);
    return () => { clearInterval(iv); clearInterval(sv); };
  }, [phase]);

  const runAssessment = async () => {
    if (!file || saving) return;
    setSaving(true);
    setError("");
    setPhase("processing");
    try {
      const created = await api.createReview(
        {
          employee: form.employee,
          project: form.project,
          documentType: form.documentType,
          reviewDate: form.reviewDate,
          reviewer: form.reviewer,
          businessUnit: form.businessUnit,
          client: form.client || null,
          fileName: file.name,
          fileSize: file.sizeLabel || file.size,
          status: "Pending",
        },
        file.raw || null
      );
      if (!created?.id) throw new Error("Assessment saved but no review id returned");
      setLatestReviewId(created.id);
      await refresh();
      setProgress(100);
      setStep(STEPS.length - 1);
      setPhase("results");
      go("results");
    } catch (err) {
      setError(err.message || "Failed to run AI assessment");
      setPhase("form");
    } finally {
      setSaving(false);
    }
  };

  if (phase === "processing") {
    return (
      <div className="qa-processing">
        <div className="qa-proc-orb">
          <div className="qa-proc-ring" />
          <div className="qa-proc-core"><Sparkles size={30} color="#fff" /></div>
        </div>
        <h2 className="qa-proc-title">Running AI quality assessment</h2>
        <p className="qa-proc-sub">Evaluating <b>{form.project} — {form.documentType}</b> against 8 rubric dimensions</p>

        <div className="qa-proc-steps">
          {STEPS.map((s, i) => {
            const I = s.icon;
            const state = i < step ? "done" : i === step ? "active" : "wait";
            return (
              <div key={i} className={`qa-proc-step ${state}`}>
                <span className="qa-proc-step-ic">{state === "done" ? <Check size={16} /> : <I size={16} />}</span>
                <span>{s.label}</span>
                {state === "active" && <span className="qa-proc-loader" />}
              </div>
            );
          })}
        </div>

        <div className="qa-proc-bar"><span style={{ width: `${progress}%` }} /></div>
        <div className="qa-proc-eta">{Math.round(progress)}% · est. {Math.max(0, Math.ceil((100 - progress) / 22))}s remaining</div>
      </div>
    );
  }

  const employeeOptions = employees.map((e) => e.name);
  const typeOptions = docTypes.length ? docTypes : DOC_TYPES;

  return (
    <div className="qa-stack">
      <div className="qa-grid-form">
        <div className="qa-card reveal">
          <CardHead title="Project information" sub="Context for this assessment" />
          <div className="qa-form">
            <Field label="Owner (employee)">
              <Select
                value={form.employee || employeeOptions[0] || ""}
                options={employeeOptions}
                onChange={(v) => {
                  const emp = employees.find((e) => e.name === v);
                  const unit = ["Capital", "Algodel"].includes(emp?.unit) ? emp.unit : undefined;
                  setForm((f) => ({ ...f, employee: v, ...(unit ? { businessUnit: unit } : {}) }));
                }}
              />
            </Field>
            <Field label="Project name">
              <input className="qa-input" value={form.project} onChange={(e) => setForm((f) => ({ ...f, project: e.target.value }))} />
            </Field>
            <Field label="Document type">
              <Select value={form.documentType} options={typeOptions} onChange={(v) => setForm((f) => ({ ...f, documentType: v }))} />
            </Field>
            <Field label="Review date">
              <input className="qa-input" type="date" value={form.reviewDate} onChange={(e) => setForm((f) => ({ ...f, reviewDate: e.target.value }))} />
            </Field>
            <Field label="Reviewer"><input className="qa-input qa-input-locked" value={form.reviewer} readOnly /></Field>
            <Field label="Business unit">
              <Select
                value={["Capital", "Algodel"].includes(form.businessUnit) ? form.businessUnit : "Capital"}
                options={["Capital", "Algodel"]}
                onChange={(v) => setForm((f) => ({ ...f, businessUnit: v }))}
              />
            </Field>
            <Field label="Client (optional)">
              <input className="qa-input" placeholder="e.g. Confidential — Project Meridian" value={form.client} onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))} />
            </Field>
          </div>
        </div>

        <div className="qa-card reveal">
          <CardHead title="Upload deliverable" sub="PDF · PPTX · DOCX · XLSX up to 50 MB" />
          {!file ? (
            <div
              className={`qa-drop ${drag ? "drag" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setFile({ name: f.name, size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`, sizeLabel: `${(f.size / (1024 * 1024)).toFixed(1)} MB`, raw: f });
              }}
            >
              <div className="qa-drop-ic"><UploadCloud size={30} /></div>
              <div className="qa-drop-title">Drag &amp; drop your document</div>
              <div className="qa-drop-sub">
                or{" "}
                <label className="qa-link" style={{ cursor: "pointer" }}>
                  browse files
                  <input
                    type="file"
                    accept=".pdf,.pptx,.docx,.xlsx,application/pdf"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setFile({ name: f.name, size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`, sizeLabel: `${(f.size / (1024 * 1024)).toFixed(1)} MB`, raw: f });
                    }}
                  />
                </label>
              </div>
              <div className="qa-drop-types">
                {["PDF", "PPTX", "DOCX", "XLSX"].map((t) => <span key={t}>{t}</span>)}
              </div>
            </div>
          ) : (
            <div className="qa-file">
              <div className="qa-file-ic"><FileText size={22} /></div>
              <div className="qa-file-meta">
                <div className="qa-file-name">{file.name}</div>
                <div className="qa-file-sub">{file.size} · uploaded</div>
                <div className="qa-file-bar"><span style={{ width: "100%" }} /></div>
              </div>
              <button className="qa-icon-btn sm" onClick={() => setFile(null)} title="Remove"><X size={16} /></button>
            </div>
          )}

          {error && <div style={{ color: C.red, marginTop: 12, fontSize: 13 }}>{error}</div>}

          <div className="qa-upload-foot">
            <div className="qa-upload-note"><ShieldCheck size={15} /> Claude scores against MySQL rubrics · Timeline stays manual</div>
            <button className="qa-btn-primary lg" disabled={!file || saving || !form.employee} onClick={runAssessment}>
              <Sparkles size={16} /> {saving ? "Claude is scoring…" : "Run AI quality assessment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ RESULTS ============================ */
function Results({ go }) {
  const { latestReviewId, reviews, refresh } = useData();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [notes, setNotes] = useState("");
  const [dimNotes, setDimNotes] = useState({});

  const [timelineDraft, setTimelineDraft] = useState({});
  const [savingTimeline, setSavingTimeline] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const id = latestReviewId || reviews[0]?.id;
      if (!id) {
        setLoadingDetail(false);
        setDetail(null);
        return;
      }
      const alreadyShowing = detail?.id != null && Number(detail.id) === Number(id);
      if (!alreadyShowing) setLoadingDetail(true);
      setLoadError("");
      try {
        const data = await api.review(id);
        if (!alive) return;
        setDetail(data);
        setNotes(data.manager_notes || "");
        setDimNotes(Object.fromEntries((data.scores || []).map((s) => [s.key, s.manager_note || ""])));
        setTimelineDraft(Object.fromEntries(
          (data.scores || []).filter((s) => s.is_manual).map((s) => [s.key, s.score ?? ""])
        ));
      } catch (err) {
        if (alive) {
          if (!alreadyShowing) setDetail(null);
          setLoadError(err.message || "Could not load assessment");
        }
      } finally {
        if (alive) setLoadingDetail(false);
      }
    })();
    return () => { alive = false; };
  }, [latestReviewId, reviews]);

  const saveNotes = async () => {
    if (!detail?.id) return;
    try {
      await api.updateReview(detail.id, { managerNotes: notes, managerScoreNotes: dimNotes });
    } catch {
      /* ignore soft note save failures */
    }
  };

  const saveTimeline = async (key, overrideVal) => {
    if (!detail?.id || savingTimeline) return;
    const raw = overrideVal !== undefined ? overrideVal : timelineDraft[key];
    if (raw === "" || raw == null) return;
    const val = Math.round(Number(raw) * 10) / 10;
    if (!Number.isFinite(val) || val < 1 || val > 5) {
      window.alert("Enter a score between 1 and 5 (decimals allowed, e.g. 3.5).");
      return;
    }
    setSavingTimeline(true);
    setTimelineDraft((t) => ({ ...t, [key]: val }));
    // Instant UI update — recompute overall from current dimension scores
    setDetail((d) => {
      if (!d) return d;
      const scores = (d.scores || []).map((s) => (s.key === key ? { ...s, score: val } : s));
      const nums = scores
        .map((s) => (s.score == null || s.score === "" ? null : Number(s.score)))
        .filter((n) => n != null && Number.isFinite(n));
      const overall_score = nums.length
        ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
        : null;
      return { ...d, scores, overall_score };
    });
    try {
      const updated = await api.updateReview(detail.id, { scores: { [key]: val } });
      if (updated?.overall_score != null) {
        setDetail((d) => (d ? { ...d, overall_score: Number(updated.overall_score) } : d));
      } else {
        const data = await api.review(detail.id);
        setDetail(data);
        setTimelineDraft((t) => ({ ...t, [key]: data.scores?.find((s) => s.key === key)?.score ?? val }));
      }
      refresh().catch(() => {});
    } catch (err) {
      window.alert(err.message || "Could not save timeline score");
      try {
        const data = await api.review(detail.id);
        setDetail(data);
      } catch { /* ignore */ }
    } finally {
      setSavingTimeline(false);
    }
  };

  if (loadingDetail) {
    return <div className="qa-card reveal">Loading assessment results…</div>;
  }

  if (!detail) {
    return (
      <div className="qa-card reveal">
        <CardHead title="No assessment selected" sub={loadError || "Run an upload or open a review from Quality Reviews"} />
        <div style={{ display: "flex", gap: 10 }}>
          <button className="qa-btn-primary" onClick={() => go("upload")}>Start assessment</button>
          <button className="qa-btn-ghost" onClick={() => go("reviews")}>Open quality reviews</button>
        </div>
      </div>
    );
  }

  const dims = (detail.scores || []).map((r) => ({
    key: r.key,
    desc: r.desc,
    weight: Number(r.weight),
    score: r.score == null ? null : Number(r.score),
    is_manual: Boolean(r.is_manual),
    guides: r.guides || [],
    ai_note: r.ai_note || "",
  }));
  const scoredDims = dims.filter((d) => d.score != null);
  const overall = detail.overall_score == null ? null : Number(detail.overall_score);
  const radar = scoredDims.map((r) => ({ dim: r.key.split(" ")[0], full: r.key, score: r.score }));
  const strengths = (detail.strengths || []).filter((s) => typeof s === "string" && s.trim());
  const improvements = (detail.improvements || []).filter((s) => typeof s === "string" && s.trim());
  const highest = [...scoredDims].sort((a, b) => b.score - a.score)[0];
  const lowest = [...scoredDims].sort((a, b) => a.score - b.score)[0];
  const pendingManual = dims.filter((d) => d.is_manual && d.score == null);
  const goBack = () => go(isAdmin ? "reviews" : "dashboard");

  return (
    <div className="qa-stack">
      <div className="qa-card reveal qa-result-head">
        <div className="qa-result-head-left">
          <div className="qa-result-title-row">
            <button type="button" className="qa-result-back" onClick={goBack} title="Back" aria-label="Back">
              <ArrowLeft size={14} strokeWidth={2.5} />
            </button>
            <span className="qa-result-project">{detail.project}</span>
          </div>
          <div className="qa-result-tags">
            <span><User size={12} /> {detail.emp}</span>
            <span><FileText size={12} /> {detail.doc}</span>
            <span><Calendar size={12} /> {formatDisplayDate(detail.review_date || detail.date)}</span>
            <span className="qa-result-tag-sep" aria-hidden />
            <span className="qa-result-hl">
              Highest <b style={{ color: C.emerald }}>{highest?.key?.split(" & ")[0] || "—"}</b>
            </span>
            <span className="qa-result-hl">
              Lowest <b style={{ color: C.amber }}>{lowest?.key?.split(" & ")[0] || "—"}</b>
            </span>
          </div>
          {pendingManual.length > 0 && (
            <div className="qa-result-pending">
              Enter Timeline & Turnaround manually to complete the average score.
            </div>
          )}
        </div>
        <div className="qa-result-ring">
          <Ring value={overall || 0} size={88} stroke={8} animate light />
          <div className="qa-grade-badge" style={{ background: overall == null ? C.faint : scoreColor(overall) }}>
            {overall == null ? "—" : gradeFor(overall)}
          </div>
        </div>
      </div>

      <div className="qa-card reveal">
        <CardHead
          title="Rubric scorecard"
          sub={`${dims.length} dimensions · overall = average of scores · ${detail.doc}`}
          right={<Pill>{overall == null ? "Pending average" : `Average ${overall.toFixed(2)} / 5`}</Pill>}
        />
        <div className="qa-table-wrap">
          <table className="qa-table rubric">
            <thead>
              <tr>
                <th>Dimension</th><th>Score</th><th>Share</th><th>Contribution</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {dims.map((r, i) => {
                const s = r.score;
                const w = s == null ? 0 : (s * r.weight / 100);
                const isOpen = open === i;
                const st = r.is_manual && s == null ? "Manual" : s == null ? "—" : s >= 4.4 ? "Strong" : s >= 3.8 ? "On track" : "Watch";
                const stColor = r.is_manual && s == null ? C.amber : s == null ? C.faint : s >= 4.4 ? C.emerald : s >= 3.8 ? C.blue : C.amber;
                return (
                  <React.Fragment key={r.key}>
                    <tr className={`qa-row rubric ${isOpen ? "open" : ""}`} onClick={() => setOpen(isOpen ? null : i)}>
                      <td>
                        <div className="qa-rub-dim">
                          <span className="qa-rub-name">{r.key}{r.is_manual ? " · manual" : ""}</span>
                          <span className="qa-rub-desc">{r.desc}</span>
                        </div>
                      </td>
                      <td style={{ minWidth: 170 }} onClick={(e) => e.stopPropagation()}>
                        {r.is_manual ? (
                          <div className="qa-rub-score" style={{ gap: 8 }}>
                            <input
                              className="qa-input xs"
                              type="number"
                              inputMode="decimal"
                              min={1}
                              max={5}
                              step={0.1}
                              placeholder="e.g. 3.5"
                              style={{ width: 88 }}
                              value={
                                timelineDraft[r.key] !== "" && timelineDraft[r.key] != null
                                  ? timelineDraft[r.key]
                                  : (s ?? "")
                              }
                              disabled={savingTimeline}
                              onChange={(e) => setTimelineDraft((t) => ({ ...t, [r.key]: e.target.value }))}
                              onBlur={() => saveTimeline(r.key)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                }
                              }}
                            />
                            {s != null && <Bar5 value={Number(s)} />}
                          </div>
                        ) : (
                          <div className="qa-rub-score">
                            <b style={{ color: scoreColor(s || 0) }}>{s == null ? "—" : s.toFixed(1)}</b>
                            {s != null && <Bar5 value={s} />}
                          </div>
                        )}
                      </td>
                      <td className="qa-muted">{r.weight}%</td>
                      <td><b>{s == null ? "—" : w.toFixed(2)}</b></td>
                      <td><span className="qa-tag" style={{ color: stColor, background: `${stColor}14` }}>{st}</span></td>
                      <td><ChevronDown size={16} className="qa-chev" style={{ transform: isOpen ? "rotate(180deg)" : "none" }} /></td>
                    </tr>
                    {isOpen && (
                      <tr className="qa-expand">
                        <td colSpan={6}>
                          <div className="qa-expand-grid">
                            <div>
                              <div className="qa-expand-label"><Sparkles size={13} /> {r.is_manual ? "Timeline guide" : "AI explanation"}</div>
                              <p>{r.ai_note}</p>
                              {r.guides?.length > 0 && (
                                <div style={{ marginTop: 10 }}>
                                  {r.guides.map((g, gi) => (
                                    <div key={gi} style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                                      <b style={{ color: scoreColor(gi + 1) }}>{gi + 1}:</b> {g}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="qa-expand-label"><User size={13} /> Manager notes</div>
                              <textarea
                                className="qa-textarea sm"
                                placeholder="Add a note for the review record…"
                                value={dimNotes[r.key] || ""}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setDimNotes((m) => ({ ...m, [r.key]: e.target.value }))}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="qa-grid-2">
        <div className="qa-card reveal">
          <CardHead title="Dimension profile" sub="Performance across the rubric" />
          <div style={{ height: 320 }}>
            <ResponsiveContainer>
              <RadarChart data={radar} outerRadius="72%">
                <PolarGrid stroke={C.line} />
                <PolarAngleAxis dataKey="dim" tick={{ fill: C.muted, fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 5]} tick={{ fill: C.faint, fontSize: 10 }} axisLine={false} />
                <Radar dataKey="score" stroke={C.blue} fill={C.blue} fillOpacity={0.22} strokeWidth={2} />
                <Tooltip content={<Tip suffix=" / 5" nameKey="full" />} cursor={false} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="qa-stack">
          <div className="qa-card reveal qa-insight strong">
            <div className="qa-insight-head"><CheckCircle2 size={17} color={C.emerald} /> Strengths</div>
            <ul className="qa-insight-list">
              {strengths.length ? strengths.map((s, i) => (
                <li key={`s-${i}`}><InsightLine text={s} tone="strong" /></li>
              )) : (
                <li className="qa-insight-empty">No clear strengths yet — complete scoring to surface top dimensions.</li>
              )}
            </ul>
          </div>
          <div className="qa-card reveal qa-insight weak">
            <div className="qa-insight-head"><AlertTriangle size={17} color={C.amber} /> Improvement opportunities</div>
            <ul className="qa-insight-list">
              {improvements.length ? improvements.map((s, i) => (
                <li key={`i-${i}`}><InsightLine text={s} tone="weak" /></li>
              )) : (
                <li className="qa-insight-empty">No improvement items — scores look evenly strong across the rubric.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="qa-card reveal">
        <CardHead title="Review notes" sub="Optional notes for this assessment" />
        <textarea
          className="qa-textarea"
          placeholder="Add notes for this assessment…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
        />
        <div className="qa-decision">
          <div className="qa-decision-spacer" />
              <button className="qa-btn-ghost" onClick={goBack}>Back</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ EMPLOYEES ============================ */
function Employees() {
  const { employees, kpis } = useData();
  const [sel, setSel] = useState("");
  const [tab, setTab] = useState("Overview");
  const [detail, setDetail] = useState(null);
  const [coachNote, setCoachNote] = useState("");
  const [savingCoach, setSavingCoach] = useState(false);
  const [activeRubric, setActiveRubric] = useState([]);

  useEffect(() => {
    if (!sel && employees[0]) setSel(employees[0].name);
  }, [employees, sel]);

  useEffect(() => {
    if (!sel) return;
    let alive = true;
    api.employee(sel)
      .then((d) => { if (alive) setDetail(d); })
      .catch(() => { if (alive) setDetail(null); });
    return () => { alive = false; };
  }, [sel]);

  const e = detail || employees.find((x) => x.name === sel) || employees[0];
  if (!e) return <div className="qa-card reveal">No employees in database yet.</div>;

  const trend = detail?.monthly?.length
    ? detail.monthly
    : MONTHLY.map((m, i) => ({ m: m.m, score: +(Math.max(1, Math.min(5, e.avg - 0.5 + i * 0.06))).toFixed(2) }));
  const rubricBreak = (detail?.rubric?.length ? detail.rubric : RUBRIC.map((r, i) => ({
    dim: r.key.split(" ")[0], full: r.key, score: +(Math.min(5, Math.max(1, e.avg + ((i % 3) - 1) * 0.3))).toFixed(1),
  }))).map((r) => ({ dim: r.dim || r.key.split(" ")[0], full: r.full || r.key, score: Number(r.score) }));
  const history = detail?.history || [];
  const coaching = detail?.coaching || [];
  const rubricRows = activeRubric.length ? activeRubric : rubricBreak;
  const strongest = [...rubricRows].sort((a, b) => Number(b.score) - Number(a.score)).slice(0, 3);
  const weakest = [...rubricRows].sort((a, b) => Number(a.score) - Number(b.score)).slice(0, 3);

  const addCoach = async () => {
    if (!coachNote.trim() || savingCoach) return;
    setSavingCoach(true);
    try {
      await api.addCoaching(e.name, { note: coachNote, author: kpis?.reviewerName });
      const d = await api.employee(e.name);
      setDetail(d);
      setCoachNote("");
      setTab("Coaching");
    } finally {
      setSavingCoach(false);
    }
  };

  return (
    <div className="qa-stack">
      <div className="qa-emp-select qa-card reveal">
        <div className="qa-emp-select-left">
          <span className="qa-field-label">Employee</span>
          <Select value={sel || e.name} options={employees.map((x) => x.name)} onChange={setSel} wide />
        </div>
        <div className="qa-emp-tabs">
          {["Overview", "History", "Coaching"].map((t) => (
            <button key={t} className={`qa-tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="qa-grid-profile">
        <div className="qa-card reveal qa-profile">
          <div className="qa-avatar xl" style={{ background: rankGrad(employees.findIndex((x) => x.name === e.name) % 5) }}>{e.init}</div>
          <div className="qa-profile-name">{e.name}</div>
          <div className="qa-profile-role">{e.unit}</div>
          <div className="qa-profile-grade" style={{ color: scoreColor(e.avg), background: `${scoreColor(e.avg)}14` }}>
            Grade {gradeFor(e.avg)} · {Number(e.avg).toFixed(1)} avg
          </div>
          <div className="qa-profile-stats">
            {[["Total reviews", e.reviews], ["Projects", e.projects], ["Best score", Number(e.best).toFixed(1)], ["Lowest", Number(e.low).toFixed(1)]].map(([k, v]) => (
              <div key={k}><b>{v}</b><span>{k}</span></div>
            ))}
          </div>
          <Gauge2 label="Promotion readiness" value={Number(e.ready)} color={C.blue} />
          <Gauge2 label="Consistency index" value={Number(e.consistency)} color={C.emerald} />
          <div className="qa-profile-trend">
            <span>Improvement trend</span>
            <b className={e.trend >= 0 ? "up" : "down"}>{e.trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {e.trend >= 0 ? "+" : ""}{e.trend}</b>
          </div>
        </div>

        <div className="qa-stack">
          {tab === "Overview" && (
            <>
              <div className="qa-grid-2">
                <div className="qa-card reveal">
                  <CardHead title="Monthly score trend" sub="From MySQL review history" />
                  <div style={{ height: 210 }}>
                    <ResponsiveContainer>
                      <LineChart data={trend} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                        <XAxis dataKey="m" tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[3, 5]} tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<Tip suffix=" / 5" />} cursor={false} />
                        <Line type="monotone" dataKey="score" stroke={C.blue} strokeWidth={3} dot={{ r: 3, fill: C.blue }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <RubricBarsCard
                  title="Rubric breakdown"
                  sub="Avg dimension scores"
                  byDocType={detail?.rubricByDocType}
                  fallbackRows={rubricBreak}
                  onActiveRows={setActiveRubric}
                />
              </div>
              <div className="qa-grid-2">
                <div className="qa-card reveal qa-insight strong">
                  <div className="qa-insight-head"><Star size={16} color={C.emerald} /> Strongest rubrics</div>
                  {strongest.map((s) => <RowMini key={s.full} label={s.full} value={s.score} color={C.emerald} />)}
                </div>
                <div className="qa-card reveal qa-insight weak">
                  <div className="qa-insight-head"><Target size={16} color={C.amber} /> Weakest rubrics</div>
                  {weakest.map((s) => <RowMini key={s.full} label={s.full} value={s.score} color={C.amber} />)}
                </div>
              </div>
            </>
          )}

          {tab === "History" && (
            <div className="qa-card reveal">
              <CardHead title="Review history" sub={`${history.length} evaluated deliverables`} />
              <ReviewsTable rows={history} go={() => {}} />
            </div>
          )}

          {tab === "Coaching" && (
            <div className="qa-card reveal">
              <CardHead title="Coaching notes" sub="Persisted to MySQL" />
              <textarea className="qa-textarea" placeholder="Add a coaching note…" value={coachNote} onChange={(e) => setCoachNote(e.target.value)} />
              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <button className="qa-btn-primary sm" disabled={savingCoach || !coachNote.trim()} onClick={addCoach}>
                  {savingCoach ? "Saving…" : "Save note"}
                </button>
              </div>
              <div className="qa-audit" style={{ marginTop: 18 }}>
                {coaching.length ? coaching.map((c) => (
                  <div key={c.id} className="qa-audit-row">
                    <CircleDot size={12} color={C.blue} />
                    <span><b>{c.author}</b> {c.note}</span>
                    <span className="qa-audit-when">{c.date}</span>
                  </div>
                )) : <div className="qa-muted">No coaching notes yet.</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {tab === "Overview" && (
        <div className="qa-card reveal">
          <CardHead title="Project history" sub={`${history.length} evaluated deliverables`} />
          <ReviewsTable rows={history.slice(0, 7)} go={() => {}} />
        </div>
      )}
    </div>
  );
}

function Gauge2({ label, value, color }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), 150); return () => clearTimeout(t); }, [value]);
  return (
    <div className="qa-gauge2">
      <div className="qa-gauge2-top"><span>{label}</span><b style={{ color }}>{value}%</b></div>
      <div className="qa-bar5"><div className="qa-bar5-fill" style={{ width: `${w}%`, background: color }} /></div>
    </div>
  );
}
function RowMini({ label, value, color }) {
  return (
    <div className="qa-rowmini">
      <span>{label}</span>
      <div className="qa-rowmini-r"><Bar5 value={value} /><b style={{ color }}>{value.toFixed(1)}</b></div>
    </div>
  );
}

function RubricBars({ rows, maxHeight = 280 }) {
  const bars = useMemo(
    () =>
      [...(rows || [])].map((r) => {
        const full = r.full || r.key || r.dim || "";
        const words = full.split(/\s+/).filter(Boolean);
        const short = words.length <= 2
          ? full.slice(0, 16)
          : `${words[0]} ${words[1]}${words[1].length < 6 && words[2] ? ` ${words[2].slice(0, 4)}` : ""}`.slice(0, 18);
        return {
          ...r,
          score: Number(r.score),
          full,
          short: short.length >= full.length ? full : `${short.replace(/\s+$/, "")}…`,
        };
      }),
    [rows]
  );
  if (!bars.length) return <div className="qa-muted" style={{ padding: 24 }}>No dimension scores yet</div>;
  return (
    <div className="qa-rubric-bars" style={{ height: maxHeight }}>
      <ResponsiveContainer>
        <BarChart data={bars} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
          <XAxis
            dataKey="short"
            interval={0}
            angle={-28}
            textAnchor="end"
            height={68}
            tick={{ fill: C.muted, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis domain={[0, 5]} tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip suffix=" / 5" nameKey="full" />} cursor={false} />
          <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={36} activeBar={false}>
            {bars.map((d, i) => <Cell key={i} fill={scoreColor(d.score)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RubricBarsCard({ title, sub, byDocType, fallbackRows, onActiveRows }) {
  const groups = byDocType || [];
  const options = groups.map((d) => d.label || d.doc);
  const [doc, setDoc] = useState("");

  useEffect(() => {
    if (!options.length) { setDoc(""); return; }
    if (!doc || !options.includes(doc)) setDoc(options[0]);
  }, [options.join("|")]);

  const rows = useMemo(() => {
    if (groups.length) {
      const g = groups.find((d) => (d.label || d.doc) === doc) || groups[0];
      return g?.dimensions || [];
    }
    return fallbackRows || [];
  }, [groups, doc, fallbackRows]);

  useEffect(() => {
    onActiveRows?.(rows);
    // Intentionally key off content signature to avoid parent re-render loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => `${r.full || r.key}:${r.score}`).join("|")]);

  return (
    <div className="qa-card reveal">
      <CardHead
        title={title}
        sub={sub}
        right={options.length ? (
          <div className="qa-rubric-slicer">
            <span className="qa-field-label" style={{ margin: 0 }}>Doc type</span>
            <Select value={doc || options[0]} options={options} onChange={setDoc} small />
          </div>
        ) : null}
      />
      <RubricBars rows={rows} />
    </div>
  );
}

/* ============================ ANALYTICS ============================ */
function Analytics() {
  const { employees, analytics, docTypes } = useData();
  const scatter = employees.map((e) => ({ x: e.reviews, y: e.avg, z: e.projects, name: e.name }));
  const improved = [...employees].sort((a, b) => b.trend - a.trend).slice(0, 5);
  const weakAreas = analytics.weakAreas?.length
    ? analytics.weakAreas.slice(0, 6)
    : RUBRIC.map((r, i) => ({ area: r.key.split(" ")[0], full: r.key, gap: +(0.4 + (i % 5) * 0.18).toFixed(2) }));

  return (
    <div className="qa-stack">
      <div className="qa-card reveal qa-filters">
        <div className="qa-filters-title"><Filter size={16} /> Filters</div>
        {[["Business unit", "All units"], ["Document type", docTypes[0] ? "All types" : "All types"], ["Reviewer", "All reviewers"], ["Period", "2026 YTD"]].map(([l, v]) => (
          <div key={l} className="qa-filter">
            <span>{l}</span>
            <Select value={v} options={[v]} small />
          </div>
        ))}
        <div className="qa-filters-spacer" />
        <button className="qa-btn-ghost sm" onClick={() => window.open("/api/reports/employees?format=csv", "_blank")}><Download size={15} /> Export</button>
      </div>

      <div className="qa-grid-2">
        <div className="qa-card reveal">
          <CardHead title="Score vs. volume" sub="Bubble size = projects delivered" />
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 16, left: -14, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                <XAxis type="number" dataKey="x" name="Reviews" tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="number" dataKey="y" name="Avg score" domain={[3, 5]} tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                <ZAxis type="number" dataKey="z" range={[80, 600]} />
                <Tooltip content={<ScatterTip />} cursor={false} />
                <Scatter data={scatter} fill={C.blue} fillOpacity={0.65} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="qa-card reveal">
          <CardHead title="Top weak areas" sub="Largest average gap to target (5.0) · from MySQL" />
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <BarChart layout="vertical" data={weakAreas} margin={{ top: 6, right: 18, left: 8, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
                <XAxis type="number" domain={[0, Math.max(1.6, ...weakAreas.map((w) => w.gap))]} tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="area" width={80} tick={{ fill: C.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip suffix=" gap" nameKey="full" />} cursor={false} />
                <Bar dataKey="gap" radius={[0, 6, 6, 0]} maxBarSize={20} fill={C.amber} activeBar={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="qa-grid-2">
        <div className="qa-card reveal">
          <CardHead title="Quality heatmap" sub="Unit × document type — average score" />
          <Heatmap data={analytics.heatmap || []} />
        </div>
        <div className="qa-card reveal">
          <CardHead title="Most improved employees" sub="Δ score vs. prior 30 days" />
          <div className="qa-improved">
            {improved.map((e, i) => (
              <div key={e.name} className="qa-improved-row">
                <div className="qa-avatar sm" style={{ background: rankGrad(i) }}>{e.init}</div>
                <div className="qa-improved-meta">
                  <div className="qa-lead-name">{e.name}</div>
                  <div className="qa-lead-sub">{e.unit}</div>
                </div>
                <div className="qa-improved-bar"><span style={{ width: `${Math.max(10, (e.trend + 0.3) / 0.8 * 100)}%`, background: e.trend >= 0 ? C.emerald : C.red }} /></div>
                <b className={e.trend >= 0 ? "up" : "down"} style={{ color: e.trend >= 0 ? C.emerald : C.red }}>{e.trend >= 0 ? "+" : ""}{e.trend}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Heatmap({ data = [] }) {
  const units = ["IB", "Consulting", "Advisory", "Research"];
  const docs = [...new Set(data.map((d) => d.doc))];
  const docCols = docs.length ? docs : ["IM", "Teaser", "Model", "Pitch", "Note", "DD"];
  const lookup = Object.fromEntries(data.map((d) => [`${d.unit}|${d.doc}`, d.score]));
  return (
    <div className="qa-heat">
      <div className="qa-heat-corner" />
      {docCols.map((d) => <div key={d} className="qa-heat-colh">{d}</div>)}
      {units.map((u) => (
        <React.Fragment key={u}>
          <div className="qa-heat-rowh">{u}</div>
          {docCols.map((d) => {
            const v = lookup[`${u}|${d}`] ?? null;
            return (
              <div key={d} className="qa-heat-cell" style={{ background: v == null ? C.line : heatColor(v) }} title={v == null ? `${u} · ${d}: n/a` : `${u} · ${d}: ${v.toFixed(1)}`}>
                {v == null ? "—" : v.toFixed(1)}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}
const heatColor = (v) => {
  const t = (v - 3.2) / 1.7; // 0..1
  const from = [251, 191, 36], to = [16, 185, 129];
  const mix = from.map((f, i) => Math.round(f + (to[i] - f) * t));
  return `rgba(${mix[0]},${mix[1]},${mix[2]},${0.28 + t * 0.55})`;
};

/* ============================ PROJECTS ============================ */
function Projects({ go }) {
  const { projects, rubric, analytics } = useData();
  const [sel, setSel] = useState("");
  const [tab, setTab] = useState("Overview");
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeRubric, setActiveRubric] = useState([]);

  useEffect(() => {
    if (!sel && projects[0]) setSel(projects[0].name);
  }, [projects, sel]);

  useEffect(() => {
    if (!sel) return;
    let alive = true;
    setLoadingDetail(true);
    api.project(sel)
      .then((d) => { if (alive) setDetail(d); })
      .catch(() => { if (alive) setDetail(null); })
      .finally(() => { if (alive) setLoadingDetail(false); });
    return () => { alive = false; };
  }, [sel]);

  const p = detail || projects.find((x) => x.name === sel) || projects[0];
  if (!projects.length) return <div className="qa-card reveal">No projects in database yet.</div>;
  if (!p) return <div className="qa-card reveal">Select a project.</div>;

  const dims = (detail?.rubric?.length ? detail.rubric : (rubric.length ? rubric : RUBRIC).map((r, i) => ({
    dim: r.key.split(" ")[0],
    full: r.key,
    key: r.key,
    score: +(Math.min(5, Math.max(1, (p.avg || 4) + ((i % 3) - 1) * 0.25))).toFixed(1),
  })));
  const rubricBreak = dims.map((r) => ({
    dim: r.dim || r.key.split(" ")[0],
    full: r.full || r.key,
    score: Number(r.score),
  }));
  const monthlyFallback = analytics.monthly?.length ? analytics.monthly : MONTHLY;
  const trend = (detail?.monthly?.length ? detail.monthly : monthlyFallback.map((m, i) => ({
    m: m.m,
    score: +(Math.max(1, Math.min(5, (p.avg || 4) - 0.4 + i * 0.05))).toFixed(2),
  })));
  const rubricRows = activeRubric.length ? activeRubric : rubricBreak;
  const strongest = [...rubricRows].sort((a, b) => Number(b.score) - Number(a.score)).slice(0, 3);
  const weakest = [...rubricRows].sort((a, b) => Number(a.score) - Number(b.score)).slice(0, 3);
  const docPerf = detail?.docPerf?.length ? detail.docPerf : [];
  const team = detail?.team || [];
  const history = detail?.reviews || [];
  const idx = projects.findIndex((x) => x.name === p.name);
  const avg = Number(p.avg || 0);
  const best = Number(p.best || 0);
  const low = Number(p.low || 0);
  const consistency = Number(p.consistency || 0);

  return (
    <div className="qa-stack">
      <div className="qa-emp-select qa-card reveal">
        <div className="qa-emp-select-left">
          <span className="qa-field-label">Project</span>
          <Select value={sel || p.name} options={projects.map((x) => x.name)} onChange={setSel} wide />
        </div>
        <div className="qa-emp-tabs">
          {["Overview", "Documents", "Team"].map((t) => (
            <button key={t} className={`qa-tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      {loadingDetail && !detail ? (
        <div className="qa-card reveal">Loading project analytics…</div>
      ) : (
        <>
          <div className="qa-grid-profile">
            <div className="qa-card reveal qa-profile">
              <div className="qa-avatar xl" style={{ background: rankGrad(idx % 5) }}>
                <FolderKanban size={28} color="#fff" />
              </div>
              <div className="qa-profile-name">{p.name}</div>
              <div className="qa-profile-role"><Building2 size={12} /> {p.unit} · {p.client || "Confidential"}</div>
              <div className="qa-profile-grade" style={{ color: scoreColor(avg), background: `${scoreColor(avg)}14` }}>
                Grade {gradeFor(avg)} · {avg.toFixed(1)} avg
              </div>
              <div className="qa-profile-stats">
                {[["Documents", p.docs || 0], ["Employees", p.emps || 0], ["Best", best.toFixed(1)], ["Lowest", low.toFixed(1)]].map(([k, v]) => (
                  <div key={k}><b>{v}</b><span>{k}</span></div>
                ))}
              </div>
              <Gauge2 label="Score consistency" value={consistency} color={C.blue} />
              <div className="qa-profile-trend">
                <span>Quality trend</span>
                <b className={p.trend >= 0 ? "up" : "down"}>
                  {p.trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {p.trend >= 0 ? "+" : ""}{Number(p.trend || 0)}
                </b>
              </div>
            </div>

            <div className="qa-stack">
              <div className="qa-kpi-grid qa-proj-kpis">
                {[
                  { label: "Avg quality", value: avg ? avg.toFixed(2) : "—", icon: Gauge, tint: C.emerald },
                  { label: "Team members", value: String(p.emps || 0), icon: Users, tint: "#0EA5E9" },
                  { label: "Best score", value: best ? best.toFixed(1) : "—", icon: Trophy, tint: "#F59E0B" },
                  { label: "Lowest score", value: low ? low.toFixed(1) : "—", icon: AlertTriangle, tint: C.red },
                  { label: "Documents", value: String(p.docs || 0), icon: FileStack, tint: C.blue },
                  { label: "Consistency", value: consistency ? `${consistency}%` : "—", icon: Activity, tint: "#7C3AED" },
                ].map((k) => {
                  const I = k.icon;
                  return (
                    <div key={k.label} className="qa-card qa-kpi reveal">
                      <div className="qa-kpi-top">
                        <span className="qa-kpi-icon" style={{ background: `${k.tint}18`, color: k.tint }}><I size={18} /></span>
                      </div>
                      <div className="qa-kpi-value">{k.value}</div>
                      <div className="qa-kpi-label">{k.label}</div>
                    </div>
                  );
                })}
              </div>

              {tab === "Overview" && (
                <>
                  <div className="qa-grid-2">
                    <div className="qa-card reveal">
                      <CardHead title="Monthly quality trend" sub="Project score over time" />
                      <div style={{ height: 210 }}>
                        <ResponsiveContainer>
                          <AreaChart data={trend} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="projTrend" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={C.blue} stopOpacity={0.28} />
                                <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                            <XAxis dataKey="m" tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis domain={[3, 5]} tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<Tip suffix=" / 5" />} cursor={false} />
                            <Area type="monotone" dataKey="score" stroke={C.blue} strokeWidth={3} fill="url(#projTrend)" dot={{ r: 3, fill: C.blue }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <RubricBarsCard
                      title="Rubric breakdown"
                      sub="Avg dimension scores on this project"
                      byDocType={detail?.rubricByDocType}
                      fallbackRows={rubricBreak}
                      onActiveRows={setActiveRubric}
                    />
                  </div>

                  <div className="qa-grid-2">
                    <div className="qa-card reveal qa-insight strong">
                      <div className="qa-insight-head"><Star size={16} color={C.emerald} /> Strongest rubrics</div>
                      {strongest.map((s) => <RowMini key={s.full} label={s.full} value={s.score} color={C.emerald} />)}
                    </div>
                    <div className="qa-card reveal qa-insight weak">
                      <div className="qa-insight-head"><Target size={16} color={C.amber} /> Weakest rubrics</div>
                      {weakest.map((s) => <RowMini key={s.full} label={s.full} value={s.score} color={C.amber} />)}
                    </div>
                  </div>

                  <div className="qa-card reveal">
                    <CardHead title="Score by document type" sub="Average quality within this project" />
                    <div style={{ height: 240 }}>
                      {docPerf.length ? (
                        <ResponsiveContainer>
                          <BarChart data={docPerf} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                            <XAxis dataKey="t" tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 5]} tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<Tip suffix=" / 5" nameKey="full" />} cursor={false} />
                            <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={34} activeBar={false}>
                              {docPerf.map((d, i) => <Cell key={i} fill={scoreColor(d.score)} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="qa-muted" style={{ padding: 24 }}>No document scores yet</div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {tab === "Documents" && (
                <div className="qa-card reveal">
                  <CardHead title="Document scorecard" sub="Every assessed deliverable on this project" />
                  {history.length ? (
                    <ReviewsTable rows={history} go={go || (() => {})} />
                  ) : (
                    <div className="qa-muted" style={{ padding: "8px 0" }}>No documents assessed yet.</div>
                  )}
                </div>
              )}

              {tab === "Team" && (
                <div className="qa-card reveal">
                  <CardHead title="Project team performance" sub="Contributors ranked by average score" />
                  <div className="qa-lead">
                    {team.length ? team.map((e, i) => (
                      <div key={e.name} className="qa-lead-row">
                        <span className={`qa-rank r${Math.min(i + 1, 5)}`}>{i + 1}</span>
                        <div className="qa-avatar sm" style={{ background: rankGrad(i % 5) }}>{e.init}</div>
                        <div className="qa-lead-meta">
                          <div className="qa-lead-name">{e.name}</div>
                          <div className="qa-lead-sub">{e.unit} · {e.reviews} review{e.reviews === 1 ? "" : "s"} · best {e.best.toFixed(1)}</div>
                        </div>
                        <div className="qa-lead-score" style={{ color: scoreColor(e.avg) }}>{Number(e.avg || 0).toFixed(1)}</div>
                        <span className="qa-grade-chip" style={{ color: scoreColor(e.avg), background: `${scoreColor(e.avg)}14` }}>{gradeFor(e.avg)}</span>
                      </div>
                    )) : (
                      <div className="qa-muted">No contributors yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {tab === "Overview" && (
            <div className="qa-card reveal">
              <CardHead title="Deliverable history" sub={`${history.length} evaluated documents on ${p.name}`} />
              {history.length ? (
                <ReviewsTable rows={history} go={go || (() => {})} />
              ) : (
                <div className="qa-muted" style={{ padding: "8px 0" }}>No reviews linked to this project yet.</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================ REVIEWS PAGE ============================ */
function Reviews({ go }) {
  const { reviews: allReviews, employees, docTypes, refresh } = useData();
  const [document, setDocument] = useState("All documents");
  const [employee, setEmployee] = useState("All employees");
  const [rows, setRows] = useState(allReviews);
  const [loadingRows, setLoadingRows] = useState(false);

  useEffect(() => { setRows(allReviews); }, [allReviews]);

  useEffect(() => {
    let alive = true;
    setLoadingRows(true);
    api.reviews({
      document: document === "All documents" ? undefined : document,
      employee: employee === "All employees" ? undefined : employee,
    })
      .then((data) => { if (alive) setRows(data); })
      .catch(() => {})
      .finally(() => { if (alive) setLoadingRows(false); });
    return () => { alive = false; };
  }, [document, employee, allReviews]);

  return (
    <div className="qa-stack">
      <div className="qa-card reveal qa-filters">
        <div className="qa-filters-title"><Filter size={16} /> Filter reviews</div>
        <div className="qa-filter">
          <span>Document</span>
          <Select value={document} options={["All documents", ...(docTypes.length ? docTypes : DOC_TYPES)]} onChange={setDocument} small />
        </div>
        <div className="qa-filter">
          <span>Employee</span>
          <Select value={employee} options={["All employees", ...employees.map((e) => e.name)]} onChange={setEmployee} small />
        </div>
        <div className="qa-filters-spacer" />
        <button className="qa-btn-ghost sm" onClick={() => refresh()}><RotateCcw size={14} /> Refresh</button>
      </div>
      <div className="qa-card reveal">
        <CardHead title="All quality reviews" sub={`${rows.length} deliverables assessed`} />
        {loadingRows && !rows.length ? (
          <div className="qa-muted">Loading reviews…</div>
        ) : rows.length ? (
          <ReviewsTable rows={rows} go={go} />
        ) : (
          <div className="qa-muted" style={{ padding: "8px 0" }}>
            No reviews yet. Upload an assessment to create the first one.
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ RUBRIC MANAGEMENT ============================ */
function RubricMgmt() {
  const { rubricsByDocType, docTypeMeta, audit, refresh } = useData();
  const tabs = (rubricsByDocType?.length ? rubricsByDocType : DOC_TYPES.map((name) => ({ name, dimensions: [], sla_note: "" })));
  const [tab, setTab] = useState("");
  const [rows, setRows] = useState([]);
  const [openGuide, setOpenGuide] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!tab && tabs[0]) setTab(tabs[0].name);
  }, [tabs, tab]);

  useEffect(() => {
    const current = tabs.find((t) => t.name === tab);
    setRows((current?.dimensions || []).map((r) => ({ ...r, on: r.on !== false })));
    setOpenGuide(null);
  }, [tab, rubricsByDocType]);

  const meta = tabs.find((t) => t.name === tab) || docTypeMeta?.find((t) => t.name === tab);
  const total = rows.filter((r) => r.on).reduce((a, r) => a + Number(r.weight), 0);

  const publish = async () => {
    setSaving(true);
    setMsg("");
    try {
      await api.saveRubric(rows, "D. Malhotra", tab);
      await refresh();
      setMsg(`${tab} rubric published.`);
    } catch (err) {
      setMsg(err.message || "Failed to publish");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="qa-stack">
      <div className="qa-emp-select qa-card reveal">
        <div className="qa-emp-select-left">
          <span className="qa-field-label">Document type</span>
        </div>
        <div className="qa-emp-tabs">
          {tabs.map((t) => (
            <button key={t.name} className={`qa-tab ${tab === t.name ? "on" : ""}`} onClick={() => setTab(t.name)}>
              {t.short_label || t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="qa-card reveal qa-rubric-head">
        <div>
          <CardHead
            title={tab || "Quality rubric"}
            sub={meta?.sla_note ? `SLA: ${meta.sla_note} · Scoring 1–5 · Overall = average of variable scores` : "Evernile IB material rubrics"}
          />
        </div>
        <div className="qa-rubric-head-right">
          <div className={`qa-weight-pill ${Math.abs(total - 100) < 0.5 ? "ok" : "warn"}`}>
            {Math.abs(total - 100) < 0.5 ? <Check size={14} /> : <Info size={14} />} Equal shares {total.toFixed(0)}%
          </div>
          <button className="qa-btn-primary sm" disabled={saving || !tab} onClick={publish}>
            <Check size={15} /> {saving ? "Saving…" : "Publish"}
          </button>
        </div>
      </div>
      {msg && <div className="qa-card reveal" style={{ color: msg.includes("Failed") ? C.red : C.emerald }}>{msg}</div>}

      <div className="qa-card reveal">
        <div className="qa-table-wrap">
          <table className="qa-table rubric-edit">
            <thead>
              <tr><th>Variable</th><th>Level 5 definition</th><th>Share</th><th>Type</th><th>Guides</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <React.Fragment key={r.key}>
                  <tr className="qa-row">
                    <td><b className="qa-rub-name">{r.key}</b></td>
                    <td style={{ minWidth: 320, maxWidth: 480 }}>
                      <textarea
                        className="qa-textarea sm qa-rub-desc"
                        value={r.desc || ""}
                        rows={3}
                        onChange={(e) => {
                          const desc = e.target.value;
                          setRows((rs) => rs.map((x, j) => {
                            if (j !== i) return x;
                            const guides = [...(x.guides || [])];
                            while (guides.length < 5) guides.push("");
                            guides[4] = desc;
                            return { ...x, desc, guides };
                          }));
                        }}
                      />
                    </td>
                    <td>
                      <div className="qa-weight-edit">
                        <input className="qa-input xs" type="number" value={r.weight}
                          onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, weight: +e.target.value } : x))} />
                        <span>%</span>
                      </div>
                    </td>
                    <td>
                      <span className="qa-tag" style={{ color: r.is_manual ? C.amber : C.blue, background: `${r.is_manual ? C.amber : C.blue}14` }}>
                        {r.is_manual ? "Manual" : "Scored"}
                      </span>
                    </td>
                    <td>
                      <button className="qa-link" onClick={() => setOpenGuide(openGuide === i ? null : i)}>
                        {openGuide === i ? "Hide 1–5" : "Show 1–5"}
                      </button>
                    </td>
                  </tr>
                  {openGuide === i && (
                    <tr className="qa-expand">
                      <td colSpan={5}>
                        <div style={{ display: "grid", gap: 8 }}>
                          {(r.guides || []).map((g, gi) => (
                            <div key={gi} style={{ fontSize: 13, color: C.muted }}>
                              <b style={{ color: scoreColor(gi + 1) }}>Score {gi + 1}:</b> {g}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="qa-audit">
          <div className="qa-audit-title"><Activity size={14} /> Audit trail</div>
          {(audit.length ? audit : []).map((row, i) => (
            <div key={row.id || i} className="qa-audit-row">
              <CircleDot size={12} color={C.blue} />
              <span><b>{row.who}</b> {row.what}</span>
              <span className="qa-audit-when">{row.when}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================ REPORTS ============================ */
function Reports() {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState("");
  const items = [
    { key: "quarterly", t: "Quarterly quality review", d: "Firm-wide scorecard from live KPIs", ic: BarChart3, tint: C.blue },
    { key: "employees", t: "Employee performance pack", d: "Per-analyst rubric breakdown", ic: Users, tint: C.emerald },
    { key: "projects", t: "Deal deliverable audit", d: "By project and document type", ic: FolderKanban, tint: "#7C3AED" },
    { key: "compliance", t: "Compliance & anonymity log", d: "Redaction and disclosure flags", ic: ShieldCheck, tint: C.amber },
  ];

  const load = async (key) => {
    setLoading(key);
    try {
      const data = await api.report(key);
      setPreview(data);
    } catch (err) {
      setPreview({ error: err.message });
    } finally {
      setLoading("");
    }
  };

  const exportReport = async (key) => {
    if (key === "employees") {
      window.open("/api/reports/employees?format=csv", "_blank");
      return;
    }
    const data = await api.report(key);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${key}-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="qa-stack">
      <div className="qa-report-grid">
        {items.map((r) => {
          const I = r.ic;
          return (
            <div key={r.key} className="qa-card reveal qa-report">
              <div className="qa-report-ic" style={{ background: `${r.tint}14`, color: r.tint }}><I size={20} /></div>
              <div className="qa-report-t">{r.t}</div>
              <div className="qa-report-d">{r.d}</div>
              <div className="qa-report-actions">
                <button className="qa-btn-ghost sm" onClick={() => load(r.key)}>
                  <FileText size={14} /> {loading === r.key ? "Loading…" : "Preview"}
                </button>
                <button className="qa-btn-primary sm" onClick={() => exportReport(r.key)}><Download size={14} /> Export</button>
              </div>
            </div>
          );
        })}
      </div>
      {preview && (
        <div className="qa-card reveal">
          <CardHead title="Report preview" sub={preview.type || "error"} right={<button className="qa-link" onClick={() => setPreview(null)}>Close</button>} />
          <pre style={{ fontSize: 12, overflow: "auto", maxHeight: 360, background: C.bg, padding: 14, borderRadius: 10 }}>
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ============================ SHARED SMALL COMPONENTS ============================ */
function CardHead({ title, sub, right }) {
  return (
    <div className="qa-cardhead">
      <div>
        <div className="qa-cardhead-title">{title}</div>
        {sub && <div className="qa-cardhead-sub">{sub}</div>}
      </div>
      {right}
    </div>
  );
}
function Pill({ children }) { return <span className="qa-pill">{children}</span>; }
function Field({ label, children }) {
  return <label className="qa-fieldwrap"><span className="qa-field-label">{label}</span>{children}</label>;
}
function Select({ value, options, onChange, wide, small }) {
  return (
    <div className={`qa-select ${wide ? "wide" : ""} ${small ? "sm" : ""}`}>
      <select value={value} onChange={(e) => onChange && onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={15} />
    </div>
  );
}
function Tip({ active, payload, suffix = "", nameKey }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const label = nameKey ? p.payload[nameKey] : (p.name || p.payload.m || p.payload.name);
  return (
    <div className="qa-tip">
      <div className="qa-tip-label">{label}</div>
      <div className="qa-tip-val">{typeof p.value === "number" ? p.value.toFixed(p.value % 1 ? 2 : 0) : p.value}{suffix}</div>
    </div>
  );
}
function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="qa-tip">
      <div className="qa-tip-label">{d.name}</div>
      <div className="qa-tip-val">{d.y.toFixed(1)} / 5 · {d.x} reviews · {d.z} projects</div>
    </div>
  );
}

/* ============================ ROOT ============================ */
/* ============================ EMPLOYEE HOME ============================ */
function EmployeeHome() {
  const { me, employees } = useData();
  const { user } = useAuth();
  const [detail, setDetail] = useState(me || null);
  const [tab, setTab] = useState("Overview");
  const [activeRubric, setActiveRubric] = useState([]);

  useEffect(() => {
    const key = me?.name || me?.id || user?.employeeName || user?.employeeId;
    if (!key) return;
    let alive = true;
    api.employee(key)
      .then((d) => { if (alive) setDetail(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [me?.name, me?.id, user?.employeeName, user?.employeeId]);

  useEffect(() => {
    if (me && !detail) setDetail(me);
  }, [me, detail]);

  const e = detail || me || employees[0];
  if (!e) {
    return <div className="qa-card reveal">Your employee profile is not linked yet. Ask an admin to map your user ID.</div>;
  }

  const trend = detail?.monthly?.length
    ? detail.monthly
    : MONTHLY.map((m, i) => ({ m: m.m, score: +(Math.max(1, Math.min(5, Number(e.avg || 3.5) - 0.5 + i * 0.06))).toFixed(2) }));
  const rubricBreak = (detail?.rubric?.length ? detail.rubric : []).map((r) => ({
    dim: r.dim || String(r.key || "").split(" ")[0],
    full: r.full || r.key,
    score: Number(r.score),
  }));
  const history = detail?.history || [];
  const coaching = detail?.coaching || [];
  const rubricRows = activeRubric.length ? activeRubric : rubricBreak;
  const strongest = [...rubricRows].sort((a, b) => Number(b.score) - Number(a.score)).slice(0, 3);
  const weakest = [...rubricRows].sort((a, b) => Number(a.score) - Number(b.score)).slice(0, 3);
  const avg = Number(e.avg || 0);

  return (
    <div className="qa-stack">
      <div className="qa-emp-select qa-card reveal">
        <div className="qa-emp-select-left">
          <span className="qa-field-label">Employee</span>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{e.name}</div>
        </div>
        <div className="qa-emp-tabs">
          {["Overview", "History", "Coaching"].map((t) => (
            <button key={t} className={`qa-tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="qa-grid-profile">
        <div className="qa-card reveal qa-profile">
          <div className="qa-avatar xl" style={{ background: rankGrad(0) }}>{e.init || user?.employeeInit}</div>
          <div className="qa-profile-name">{e.name}</div>
          <div className="qa-profile-role">{e.unit}</div>
          <div className="qa-profile-grade" style={{ color: scoreColor(avg), background: `${scoreColor(avg)}14` }}>
            Grade {gradeFor(avg)} · {avg.toFixed(1)} avg
          </div>
          <div className="qa-profile-stats">
            {[["Total reviews", e.reviews], ["Projects", e.projects], ["Best score", Number(e.best || 0).toFixed(1)], ["Lowest", Number(e.low || 0).toFixed(1)]].map(([k, v]) => (
              <div key={k}><b>{v}</b><span>{k}</span></div>
            ))}
          </div>
          <Gauge2 label="Promotion readiness" value={Number(e.ready || 0)} color={C.blue} />
          <Gauge2 label="Consistency index" value={Number(e.consistency || 0)} color={C.emerald} />
          <div className="qa-profile-trend">
            <span>Improvement trend</span>
            <b className={Number(e.trend) >= 0 ? "up" : "down"}>
              {Number(e.trend) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {Number(e.trend) >= 0 ? "+" : ""}{e.trend}
            </b>
          </div>
        </div>

        <div className="qa-stack">
          {tab === "Overview" && (
            <>
              <div className="qa-grid-2">
                <div className="qa-card reveal">
                  <CardHead title="Monthly score trend" sub="From MySQL review history" />
                  <div style={{ height: 210 }}>
                    <ResponsiveContainer>
                      <LineChart data={trend} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                        <XAxis dataKey="m" tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[3, 5]} tick={{ fill: C.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<Tip suffix=" / 5" />} cursor={false} />
                        <Line type="monotone" dataKey="score" stroke={C.blue} strokeWidth={3} dot={{ r: 3, fill: C.blue }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <RubricBarsCard
                  title="Rubric breakdown"
                  sub="Avg dimension scores"
                  byDocType={detail?.rubricByDocType}
                  fallbackRows={rubricBreak}
                  onActiveRows={setActiveRubric}
                />
              </div>
              <div className="qa-grid-2">
                <div className="qa-card reveal qa-insight strong">
                  <div className="qa-insight-head"><Star size={16} color={C.emerald} /> Strongest rubrics</div>
                  {strongest.length
                    ? strongest.map((s) => <RowMini key={s.full} label={s.full} value={s.score} color={C.emerald} />)
                    : <div className="qa-muted">No rubric scores yet.</div>}
                </div>
                <div className="qa-card reveal qa-insight weak">
                  <div className="qa-insight-head"><Target size={16} color={C.amber} /> Weakest rubrics</div>
                  {weakest.length
                    ? weakest.map((s) => <RowMini key={s.full} label={s.full} value={s.score} color={C.amber} />)
                    : <div className="qa-muted">No rubric scores yet.</div>}
                </div>
              </div>
            </>
          )}

          {tab === "History" && (
            <div className="qa-card reveal">
              <CardHead title="Review history" sub={`${history.length} evaluated deliverables`} />
              {history.length
                ? <ReviewsTable rows={history} go={() => {}} />
                : <div className="qa-muted">No reviews yet.</div>}
            </div>
          )}

          {tab === "Coaching" && (
            <div className="qa-card reveal">
              <CardHead title="Coaching notes" sub="Notes from your manager" />
              <div className="qa-audit" style={{ marginTop: 4 }}>
                {coaching.length ? coaching.map((c) => (
                  <div key={c.id} className="qa-audit-row">
                    <CircleDot size={12} color={C.blue} />
                    <span><b>{c.author}</b> {c.note}</span>
                    <span className="qa-audit-when">{c.date}</span>
                  </div>
                )) : <div className="qa-muted">No coaching notes yet.</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {tab === "Overview" && (
        <div className="qa-card reveal">
          <CardHead title="Project history" sub={`${history.length} evaluated deliverables`} />
          {history.length
            ? <ReviewsTable rows={history.slice(0, 7)} go={() => {}} />
            : <div className="qa-muted">No reviews yet.</div>}
        </div>
      )}
    </div>
  );
}

/* ============================ LOGIN LANDING ============================ */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 5.5 29.3 3.5 24 3.5 12.4 3.5 3 12.9 3 24.5S12.4 45.5 24 45.5 45 36.1 45 24.5c0-1.4-.1-2.7-.4-4z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12.5 24 12.5c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 5.5 29.3 3.5 24 3.5 16.3 3.5 9.6 7.8 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 45.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 36.9 26.7 38 24 38c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.5 41.1 16.2 45.5 24 45.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1.1 6.2 5.2C39.2 37.1 45 32 45 24.5c0-1.4-.1-2.7-.4-4z" />
    </svg>
  );
}

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("google-gsi");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google script failed")), { once: true });
      if (window.google?.accounts?.id) resolve();
      return;
    }
    const s = document.createElement("script");
    s.id = "google-gsi";
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Google Sign-In"));
    document.head.appendChild(s);
  });
}

function LoginScreen() {
  const { login, loginWithGoogle, error, setError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(
    () => String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim()
  );
  const googleBtnRef = React.useRef(null);

  useEffect(() => {
    if (googleClientId) return;
    let alive = true;
    const load = () =>
      api.authConfig()
        .then((cfg) => {
          if (!alive) return;
          const id = String(cfg.googleClientId || "").trim();
          if (id) setGoogleClientId(id);
        })
        .catch(() => {});
    load();
    const t = setTimeout(load, 1500);
    return () => { alive = false; clearTimeout(t); };
  }, [googleClientId]);

  useEffect(() => {
    if (!googleClientId) return;
    let cancelled = false;

    const mountButton = async () => {
      try {
        await loadGoogleScript();
        if (cancelled || !googleBtnRef.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            setBusy(true);
            setError(null);
            try {
              await loginWithGoogle(response.credential);
            } catch (err) {
              setError(err.message || "Google sign-in failed");
            } finally {
              setBusy(false);
            }
          },
        });
        googleBtnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline",
          size: "large",
          width: Math.max(googleBtnRef.current.offsetWidth || 320, 280),
          text: "continue_with",
          shape: "rectangular",
        });
      } catch (err) {
        if (!cancelled) setError(err.message || "Google Sign-In unavailable");
      }
    };

    // Wait a frame so the ref div is mounted
    const raf = requestAnimationFrame(() => { mountButton(); });
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [googleClientId, loginWithGoogle, setError]);

  const onGoogleClick = async () => {
    if (!googleClientId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await loadGoogleScript();
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          try {
            await loginWithGoogle(response.credential);
          } catch (err) {
            setError(err.message || "Google sign-in failed");
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment() || notification.isDismissedMoment()) {
          setBusy(false);
          // Fall back: click the rendered Google button if present
          const iframe = googleBtnRef.current?.querySelector("div[role=button], iframe");
          if (!iframe) {
            setError("Google sign-in popup was blocked. Use the Google button below, or allow popups.");
          }
        }
      });
    } catch (err) {
      setBusy(false);
      setError(err.message || "Google sign-in failed");
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="qa-land">
      <Styles />
      <div className="qa-land-bg" aria-hidden>
        <div className="qa-land-orb qa-land-orb-a" />
        <div className="qa-land-orb qa-land-orb-b" />
        <div className="qa-land-grid" />
      </div>

      <div className="qa-land-shell">
        <section className="qa-land-hero">
          <div className="qa-land-brand">
            <img src="/evergauge-mark.png?v=5" alt="" className="qa-land-mark" />
            <div className="qa-land-wordmark">Ever<span>Gauge</span></div>
          </div>
          <p className="qa-land-lede">
            Quality assessment for investment-banking deliverables — scored against Evernile rubrics.
          </p>
        </section>

        <section className="qa-land-panel" aria-label="Sign in">
          <div className="qa-land-panel-head">
            <h2>Sign in</h2>
            <p>Evernile email or Google</p>
          </div>

          {error && <div className="qa-login-error" role="alert">{error}</div>}

          <form className="qa-land-form" onSubmit={onSubmit}>
            <label className="qa-land-field">
              <span>Email</span>
              <div className="qa-land-input-wrap">
                <Mail size={16} />
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="you@evernile.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
            </label>
            <label className="qa-land-field">
              <span>Password</span>
              <div className="qa-land-input-wrap">
                <Lock size={16} />
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
                <button type="button" className="qa-land-eye" onClick={() => setShowPw((v) => !v)} tabIndex={-1} aria-label={showPw ? "Hide password" : "Show password"}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <button type="submit" className="qa-land-submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="qa-land-divider"><span>or</span></div>

          {googleClientId ? (
            <>
              <button type="button" className="qa-land-google-btn" onClick={onGoogleClick} disabled={busy}>
                <GoogleIcon /> {busy ? "Connecting…" : "Continue with Google"}
              </button>
              <div className="qa-land-google-host" ref={googleBtnRef} aria-hidden />
            </>
          ) : (
            <button type="button" className="qa-land-google-btn" disabled>
              <GoogleIcon /> Loading Google…
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="qa-card reveal" style={{ color: C.red }}>
          <div style={{ marginBottom: 8 }}>UI error: {this.state.error.message || String(this.state.error)}</div>
          <button className="qa-btn-primary sm" onClick={() => { this.setState({ error: null }); window.location.reload(); }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { authenticated, booting, isAdmin, isEmployee } = useAuth();
  const { loading, error, ready, refresh } = useData();
  const [active, setActive] = useState("dashboard");
  const [dark, setDark] = useState(false);
  const [phase, setPhase] = useState("form");

  useEffect(() => {
    if (!authenticated) return;
    const allowed = isAdmin
      ? ["dashboard", "reviews", "upload", "employees", "projects", "analytics", "reports", "rubric"]
      : ["dashboard", "projects"];
    if (!allowed.includes(active)) setActive("dashboard");
  }, [authenticated, isAdmin, active]);

  if (booting) {
    return (
      <div className="qa-land">
        <Styles />
        <div className="qa-land-bg" aria-hidden>
          <div className="qa-land-orb qa-land-orb-a" />
          <div className="qa-land-orb qa-land-orb-b" />
        </div>
        <div className="qa-land-boot">Starting EverGauge…</div>
      </div>
    );
  }
  if (!authenticated) return <LoginScreen />;

  const go = (id) => { if (id === "results") { setActive("upload"); setPhase("results"); } else { setActive(id); } };
  const openUpload = () => { setActive("upload"); setPhase("form"); };

  const meta = {
    dashboard: isEmployee
      ? ["My dashboard", "Your quality profile and review history"]
      : ["Dashboard", "Deliverable quality across the firm · August 2026"],
    reviews: ["Quality reviews", "Every AI-assessed deliverable in one place"],
    upload: phase === "results" ? ["Assessment results", ""] : ["Upload assessment", "Score a new deliverable against the rubric"],
    employees: ["Employee performance", "Individual quality trends and coaching signals"],
    projects: isEmployee
      ? ["My projects", "Engagements you are assigned to"]
      : ["Projects", "Quality rolled up by engagement"],
    analytics: ["Analytics", "Patterns across units, documents and people"],
    reports: ["Reports", "Export quality packs for leadership"],
    rubric: ["Rubric settings", "Define how deliverables are scored"],
  }[active] || ["EverGauge", ""];

  let body;
  if (loading && !ready) body = <div className="qa-card reveal">{error || "Loading workspace…"}</div>;
  else if (error && !ready) {
    body = (
      <div className="qa-card reveal" style={{ color: C.red }}>
        <div style={{ marginBottom: 8 }}>{error}</div>
        <button className="qa-btn-primary sm" onClick={() => refresh().catch(() => {})}>Retry</button>
      </div>
    );
  } else if (isEmployee) {
    switch (active) {
      case "projects": body = <Projects go={go} />; break;
      case "dashboard":
      default: body = <EmployeeHome go={go} />; break;
    }
  } else {
    switch (active) {
      case "dashboard": body = <Dashboard go={go} />; break;
      case "reviews": body = <Reviews go={go} />; break;
      case "upload": body = phase === "results" ? <Results go={go} /> : <Upload phase={phase} setPhase={setPhase} go={go} />; break;
      case "employees": body = <Employees />; break;
      case "projects": body = <Projects go={go} />; break;
      case "analytics": body = <Analytics />; break;
      case "reports": body = <Reports />; break;
      case "rubric": body = <RubricMgmt />; break;
      default: body = <Dashboard go={go} />;
    }
  }

  return (
    <div className={`qa-app ${dark ? "dark" : ""}`}>
      <Styles />
      <Sidebar active={active} setActive={(id) => { setActive(id); if (id === "upload") setPhase("form"); }} />
      <main className="qa-main">
        <Topbar
          title={meta[0]}
          subtitle={meta[1]}
          dark={dark}
          setDark={setDark}
          onUpload={openUpload}
          showUpload={isAdmin && active !== "upload"}
        />
        <div className="qa-scroll" key={active + phase}>
          <ScreenErrorBoundary key={active + phase}>{body}</ScreenErrorBoundary>
        </div>
      </main>
    </div>
  );
}

/* ============================ STYLES ============================ */
function Styles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap');
.qa-app *{box-sizing:border-box;margin:0;padding:0;}

/* LANDING / LOGIN */
.qa-land{min-height:100vh;position:relative;overflow:auto;color:#F4F0EC;
  font-family:'Source Sans 3',system-ui,sans-serif;background:#0B1628;}
.qa-land-bg{position:fixed;inset:0;pointer-events:none;z-index:0;
  background:linear-gradient(155deg,#0B1628 0%,#13294B 55%,#18355F 100%);}
.qa-land-orb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.38;}
.qa-land-orb-a{width:360px;height:360px;left:-100px;top:-40px;background:rgba(196,165,116,.3);
  animation:landFloat 12s ease-in-out infinite;}
.qa-land-orb-b{width:320px;height:320px;right:-80px;bottom:8%;background:rgba(70,120,170,.2);
  animation:landFloat 14s ease-in-out infinite reverse;}
.qa-land-grid{position:absolute;inset:0;opacity:.12;
  background-image:linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px);
  background-size:56px 56px;mask-image:radial-gradient(ellipse at 35% 40%,#000 15%,transparent 68%);}
@keyframes landFloat{0%,100%{transform:translate(0,0)}50%{transform:translate(18px,14px)}}
@keyframes landIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.qa-land-shell{position:relative;z-index:1;min-height:100vh;display:grid;
  grid-template-columns:minmax(0,1fr) 380px;column-gap:72px;align-items:center;
  max-width:980px;margin:0 auto;padding:56px 40px;}
.qa-land-hero{animation:landIn .65s ease both;display:flex;flex-direction:column;gap:18px;max-width:420px;}
.qa-land-brand{display:flex;align-items:center;gap:16px;}
.qa-land-mark{width:56px;height:56px;border-radius:14px;object-fit:contain;flex-shrink:0;
  background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.28);}
.qa-land-wordmark{font-family:'Cormorant Garamond',Georgia,serif;font-size:44px;font-weight:700;
  letter-spacing:.01em;line-height:1;color:#F7F3F0;margin:0;}
.qa-land-wordmark span{color:#C4A574;font-weight:600;}
.qa-land-lede{font-size:15.5px;line-height:1.55;color:#9FB0C9;margin:0;max-width:36ch;}
.qa-land-panel{background:#fff;color:#13294B;border-radius:18px;padding:28px 28px 22px;
  box-shadow:0 24px 48px rgba(0,0,0,.32);animation:landIn .65s .1s ease both;
  display:flex;flex-direction:column;gap:0;}
.qa-land-panel-head{margin:0 0 20px;}
.qa-land-panel-head h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;font-weight:700;
  color:#13294B;margin:0 0 4px;line-height:1.15;}
.qa-land-panel-head p{margin:0;font-size:13px;color:#7B8BA3;line-height:1.4;}
.qa-land-form{display:flex;flex-direction:column;gap:12px;}
.qa-land-field{display:flex;flex-direction:column;gap:5px;}
.qa-land-field > span{font-size:11.5px;font-weight:650;color:#5B6B84;letter-spacing:.03em;}
.qa-land-input-wrap{display:flex;align-items:center;gap:10px;border:1px solid #D7DFEB;border-radius:11px;
  padding:0 12px;background:#FBFCFD;transition:border-color .15s,box-shadow .15s,background .15s;}
.qa-land-input-wrap:focus-within{border-color:#B8955E;background:#fff;box-shadow:0 0 0 3px rgba(196,165,116,.18);}
.qa-land-input-wrap svg{color:#8FA3C4;flex-shrink:0;}
.qa-land-input-wrap input{flex:1;border:none;outline:none;background:transparent;padding:11px 0;
  font:inherit;font-size:14.5px;color:#13294B;min-width:0;}
.qa-land-eye{border:none;background:none;padding:4px;cursor:pointer;color:#8FA3C4;display:grid;place-items:center;}
.qa-land-submit{margin-top:6px;width:100%;border:none;border-radius:11px;padding:12px 16px;
  background:#13294B;color:#fff;font:inherit;font-size:14.5px;
  font-weight:650;cursor:pointer;transition:background .15s,transform .15s;}
.qa-land-submit:hover:not(:disabled){background:#1B3A6B;}
.qa-land-submit:disabled{opacity:.65;cursor:wait;}
.qa-land-divider{display:flex;align-items:center;gap:12px;margin:16px 0 14px;color:#94A3B8;font-size:11.5px;font-weight:600;}
.qa-land-divider::before,.qa-land-divider::after{content:'';flex:1;height:1px;background:#E6EBF3;}
.qa-land-google{width:100%;min-height:42px;display:flex;justify-content:center;}
.qa-land-google > div{width:100% !important;}
.qa-land-google-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;
  border:1px solid #D7DFEB;border-radius:11px;padding:11px 14px;background:#fff;color:#1F2937;
  font:inherit;font-size:14px;font-weight:650;cursor:pointer;transition:border-color .15s,box-shadow .15s,background .15s;}
.qa-land-google-btn:hover:not(:disabled){border-color:#C4A574;background:#FFFCFA;box-shadow:0 0 0 3px rgba(196,165,116,.12);}
.qa-land-google-btn:disabled{opacity:.7;cursor:wait;}
.qa-land-google-host{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
.qa-land-google-fallback{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;
  border:1px solid #D7DFEB;border-radius:11px;padding:11px 14px;background:#fff;color:#334155;
  font:inherit;font-size:14px;font-weight:600;cursor:not-allowed;opacity:.7;}
.qa-land-demo-toggle{margin-top:18px;width:100%;border:none;background:none;color:#7B8BA3;font:inherit;
  font-size:12.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;
  padding:4px 0;}
.qa-land-demo-toggle:hover{color:#13294B;}
.qa-land-demo{margin-top:12px;border-top:1px solid #E8EEF6;padding-top:4px;}
.qa-land-boot{position:relative;z-index:1;min-height:100vh;display:grid;place-items:center;
  font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;color:#C4A574;}
.qa-login-error{background:#FDECEC;color:#C4322B;border-radius:10px;padding:10px 12px;font-size:13px;margin:0 0 14px;}
.qa-login-section{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8FA3C4;margin:12px 0 6px;}
.qa-login-list{display:flex;flex-direction:column;gap:6px;}
.qa-login-list.tall{max-height:180px;overflow:auto;padding-right:2px;}
.qa-login-row{
  display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:1px solid #E2E8F0;
  background:#fff;border-radius:10px;padding:9px 10px;cursor:pointer;transition:border-color .15s,box-shadow .15s;
  font-family:inherit;color:inherit;
}
.qa-login-row:hover{border-color:#C4A574;box-shadow:0 0 0 3px rgba(196,165,116,.12);}
.qa-login-row:disabled{opacity:.6;cursor:wait;}
.qa-login-meta{flex:1;display:flex;flex-direction:column;gap:1px;}
.qa-login-meta b{font-size:13px;}
.qa-login-meta span{font-size:11.5px;color:#64748B;}
@media(max-width:860px){
  .qa-land-shell{grid-template-columns:1fr;row-gap:36px;column-gap:0;padding:40px 22px 48px;align-items:start;
    max-width:440px;}
  .qa-land-hero{max-width:none;gap:14px;}
  .qa-land-wordmark{font-size:36px;}
  .qa-land-mark{width:48px;height:48px;border-radius:12px;}
  .qa-land-panel{padding:24px 22px 18px;}
}
.qa-app{
  --navy:${C.navy};--blue:${C.blue};--emerald:${C.emerald};--bg:${C.bg};--card:${C.card};
  --ink:${C.ink};--muted:${C.muted};--faint:${C.faint};--line:${C.line};
  display:flex;height:100vh;width:100%;overflow:hidden;background:var(--bg);
  font-family:'Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;
  color:var(--ink);-webkit-font-smoothing:antialiased;
}
.qa-app.dark{--bg:#0B1220;--card:#111A2E;--ink:#E8EEF8;--muted:#9AAAC4;--faint:#6C7C99;--line:#1E2A44;}
.qa-app.dark .qa-topbar{background:rgba(17,26,46,.72);}
.qa-app.dark .qa-input,.qa-app.dark .qa-select select,.qa-app.dark .qa-search,.qa-app.dark .qa-textarea{background:#0E1728;border-color:#22304C;color:var(--ink);}
.qa-app.dark .qa-heat-cell,.qa-app.dark .qa-grade-chip{color:inherit;}
.recharts-tooltip-cursor,.recharts-rectangle.recharts-tooltip-cursor{fill:transparent!important;stroke:none!important;opacity:0!important;}
.qa-app.dark .recharts-tooltip-cursor,.qa-app.dark .recharts-rectangle.recharts-tooltip-cursor{fill:transparent!important;stroke:none!important;opacity:0!important;}

/* SIDEBAR */
.qa-sidebar{width:264px;flex-shrink:0;background:linear-gradient(180deg,#13294B 0%,#0F2140 100%);
  color:#C6D3E8;display:flex;flex-direction:column;padding:20px 16px;position:relative;}
.qa-sidebar::after{content:'';position:absolute;top:0;right:0;width:1px;height:100%;background:rgba(255,255,255,.06);}
.qa-brand{display:flex;align-items:center;gap:12px;padding:4px 6px 18px;}
.qa-brand-mark-img{width:40px;height:40px;border-radius:11px;object-fit:contain;flex-shrink:0;
  background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.22);}
.qa-brand-text{min-width:0;display:flex;flex-direction:column;gap:1px;}
.qa-brand-mark{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#2563EB,#10B981);
  display:grid;place-items:center;box-shadow:0 6px 16px rgba(37,99,235,.4);}
.qa-brand-name{font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-weight:700;
  font-size:22px;color:#F4F0EC;letter-spacing:.02em;line-height:1.1;}
.qa-brand-name span{color:#C4A574;font-weight:600;}
.qa-brand-name.dark{color:#1A2A47;}
.qa-brand-name.dark span{color:#8B7355;}
.qa-brand-sub{font-size:11px;color:#7E92B4;font-weight:500;margin-top:1px;}
.qa-nav-group-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:#5F7399;
  font-weight:700;padding:8px 10px 6px;}
.qa-nav{display:flex;flex-direction:column;gap:3px;flex:1;}
.qa-nav-item{display:flex;align-items:center;gap:11px;padding:10px 12px;border:none;background:none;
  color:#AEBFDA;font-size:13.5px;font-weight:500;border-radius:10px;cursor:pointer;text-align:left;
  width:100%;font-family:inherit;transition:all .18s ease;position:relative;}
.qa-nav-item:hover{background:rgba(255,255,255,.05);color:#fff;}
.qa-nav-item.on{background:linear-gradient(90deg,rgba(37,99,235,.28),rgba(37,99,235,.08));color:#fff;
  box-shadow:inset 0 0 0 1px rgba(96,165,250,.25);}
.qa-nav-item.on::before{content:'';position:absolute;left:-16px;top:8px;bottom:8px;width:3px;
  background:#5EEAD4;border-radius:0 3px 3px 0;}
.qa-nav-badge{margin-left:auto;background:#2563EB;color:#fff;font-size:10.5px;font-weight:700;
  padding:1px 7px;border-radius:20px;}
.qa-side-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);border-radius:14px;
  padding:14px;margin:8px 0 14px;}
.qa-side-card-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:#DCE6F5;}
.qa-side-card-bar{height:6px;border-radius:6px;background:rgba(255,255,255,.1);margin:10px 0 7px;overflow:hidden;}
.qa-side-card-bar span{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#2563EB,#5EEAD4);}
.qa-side-card-meta{font-size:11px;color:#8298BC;}
.qa-side-user{display:flex;align-items:center;gap:10px;padding:8px;border-radius:12px;cursor:pointer;transition:.18s;}
.qa-side-user:hover{background:rgba(255,255,255,.05);}
.qa-side-user-meta{flex:1;}
.qa-side-user-name{font-size:13px;font-weight:600;color:#fff;}
.qa-side-user-role{font-size:11px;color:#8298BC;}

/* AVATAR */
.qa-avatar{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;color:#fff;
  font-weight:700;font-size:13px;flex-shrink:0;}
.qa-avatar.xs{width:28px;height:28px;border-radius:8px;font-size:10.5px;}
.qa-avatar.sm{width:34px;height:34px;border-radius:9px;font-size:12px;}
.qa-avatar.xl{width:76px;height:76px;border-radius:20px;font-size:24px;box-shadow:0 10px 26px rgba(19,41,75,.22);}

/* MAIN */
.qa-main{flex:1;display:flex;flex-direction:column;min-width:0;}
.qa-topbar{display:flex;align-items:center;justify-content:space-between;padding:18px 30px;
  background:rgba(246,248,251,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20;gap:20px;}
.qa-topbar-title{font-size:21px;font-weight:800;letter-spacing:-.5px;color:var(--ink);}
.qa-topbar-sub{font-size:13px;color:var(--muted);margin-top:2px;}
.qa-topbar-actions{display:flex;align-items:center;gap:10px;}
.qa-search{display:flex;align-items:center;gap:9px;background:var(--card);border:1px solid var(--line);
  border-radius:11px;padding:9px 13px;width:320px;transition:.2s;}
.qa-search:focus-within{border-color:var(--blue);box-shadow:0 0 0 3px rgba(37,99,235,.12);}
.qa-search input{border:none;outline:none;background:none;font-size:13px;flex:1;color:var(--ink);font-family:inherit;}
.qa-search input::placeholder{color:var(--faint);}
.qa-kbd{display:flex;align-items:center;gap:2px;font-size:11px;color:var(--faint);background:var(--bg);
  border:1px solid var(--line);border-radius:6px;padding:2px 6px;font-weight:600;}
.qa-icon-btn{width:40px;height:40px;border-radius:11px;border:1px solid var(--line);background:var(--card);
  display:grid;place-items:center;cursor:pointer;color:var(--muted);transition:.18s;position:relative;}
.qa-icon-btn:hover{color:var(--blue);border-color:var(--blue);transform:translateY(-1px);}
.qa-icon-btn.sm{width:34px;height:34px;border-radius:9px;}
.qa-bell-dot{position:absolute;top:9px;right:10px;width:8px;height:8px;border-radius:50%;background:${C.red};
  border:2px solid var(--card);}
.qa-btn-primary{display:inline-flex;align-items:center;gap:7px;background:linear-gradient(135deg,#2563EB,#1D4ED8);
  color:#fff;border:none;padding:10px 16px;border-radius:11px;font-size:13px;font-weight:600;cursor:pointer;
  font-family:inherit;box-shadow:0 6px 16px rgba(37,99,235,.28);transition:.2s;white-space:nowrap;}
.qa-btn-primary:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(37,99,235,.36);}
.qa-btn-primary:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none;}
.qa-btn-primary.lg{padding:13px 22px;font-size:14px;}
.qa-btn-primary.sm{padding:8px 13px;font-size:12.5px;}
.qa-btn-ghost{display:inline-flex;align-items:center;gap:7px;background:var(--card);border:1px solid var(--line);
  color:var(--muted);padding:9px 15px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;
  font-family:inherit;transition:.18s;}
.qa-btn-ghost:hover{color:var(--blue);border-color:var(--blue);}
.qa-btn-ghost.sm{padding:7px 12px;font-size:12.5px;}
.qa-link{background:none;border:none;color:var(--blue);font-weight:600;font-size:13px;cursor:pointer;font-family:inherit;}
.qa-link:hover{text-decoration:underline;}

.qa-scroll{flex:1;overflow-y:auto;padding:26px 30px 60px;animation:pageIn .45s ease;}
@keyframes pageIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
.qa-stack{display:flex;flex-direction:column;gap:20px;}

/* CARD */
.qa-card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:22px;
  box-shadow:0 1px 2px rgba(16,30,54,.04),0 8px 24px rgba(16,30,54,.05);}
.reveal{animation:reveal .5s cubic-bezier(.22,1,.36,1) both;}
@keyframes reveal{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:none;}}
.qa-cardhead{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;gap:12px;}
.qa-cardhead-title{font-size:15.5px;font-weight:700;letter-spacing:-.2px;}
.qa-cardhead-sub{font-size:12.5px;color:var(--muted);margin-top:3px;}
.qa-streak-reset{text-align:right;max-width:46%;line-height:1.25;flex-shrink:0;}
.qa-streak-reset-label{display:block;font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);}
.qa-streak-reset-name{display:block;margin-top:3px;font-size:13px;font-weight:650;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.qa-rubric-slicer{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.qa-rubric-slicer .qa-select{min-width:140px;}
.qa-pill{font-size:11.5px;font-weight:600;color:var(--blue);background:${C.blueSoft};padding:5px 11px;border-radius:20px;white-space:nowrap;}

/* KPI */
.qa-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
.qa-kpi-grid-4{grid-template-columns:repeat(4,1fr);}
.qa-proj-kpis{grid-template-columns:repeat(3,1fr);}
.qa-proj-kpis .qa-kpi-spark{display:none;}
.qa-avatar.xl svg{display:block;}
.qa-kpi{padding:18px;position:relative;overflow:hidden;transition:transform .22s,box-shadow .22s;}
.qa-kpi:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(16,30,54,.1);}
.qa-kpi-top{display:flex;align-items:center;justify-content:space-between;}
.qa-kpi-icon{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;}
.qa-trend{display:inline-flex;align-items:center;gap:2px;font-size:12px;font-weight:700;padding:3px 8px;border-radius:20px;}
.qa-trend.up{color:#0F9D6B;background:#E7F8F0;}
.qa-trend.down{color:#C4322B;background:#FDECEC;}
.qa-trend.mini{padding:2px 6px;font-size:11px;}
.qa-kpi-value{font-size:26px;font-weight:800;letter-spacing:-.6px;margin-top:14px;color:var(--ink);}
.qa-kpi-label{font-size:12.5px;color:var(--muted);font-weight:500;margin-top:2px;}
.qa-kpi-spark{margin:8px -18px -18px;height:38px;}
.qa-empty-chart{height:100%;display:grid;place-items:center;text-align:center;padding:24px;
  color:var(--muted);font-size:13.5px;line-height:1.45;}

.qa-grid-3{display:grid;grid-template-columns:1.05fr 2fr;gap:20px;}
.qa-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.qa-donut-center{position:absolute;top:calc(50% - 8px);left:0;right:0;text-align:center;pointer-events:none;}
.qa-donut-num{font-size:28px;font-weight:800;color:var(--ink);letter-spacing:-.5px;}
.qa-donut-cap{font-size:11.5px;color:var(--faint);}
.qa-legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:6px;justify-content:center;}
.qa-legend-item{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);font-weight:500;}
.qa-legend-item b{color:var(--ink);}
.qa-dot{width:9px;height:9px;border-radius:50%;display:inline-block;}

/* LEADERBOARD */
.qa-lead{display:flex;flex-direction:column;gap:4px;}
.qa-lead-row{display:flex;align-items:center;gap:12px;padding:9px 8px;border-radius:11px;transition:.16s;}
.qa-lead-row:hover{background:var(--bg);}
.qa-rank{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;font-size:11px;font-weight:800;
  color:#fff;background:var(--faint);flex-shrink:0;}
.qa-rank.r1{background:linear-gradient(135deg,#F59E0B,#FBBF24);}
.qa-rank.r2{background:linear-gradient(135deg,#94A3B8,#64748B);}
.qa-rank.r3{background:linear-gradient(135deg,#D97706,#B45309);}
.qa-lead-meta{flex:1;min-width:0;}
.qa-lead-name{font-size:13.5px;font-weight:600;}
.qa-lead-sub{font-size:11.5px;color:var(--muted);}
.qa-lead-score{font-size:16px;font-weight:800;}

/* TABLE */
.qa-table-wrap{overflow-x:auto;margin:0 -6px;}
.qa-table{width:100%;border-collapse:collapse;font-size:13px;}
.qa-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--faint);
  font-weight:700;padding:10px 14px;border-bottom:1px solid var(--line);}
.qa-table td{padding:13px 14px;border-bottom:1px solid var(--line);vertical-align:middle;}
.qa-table tbody tr:last-child td{border-bottom:none;}
.qa-row{transition:background .15s;}
.qa-row:hover{background:var(--bg);}
.qa-muted{color:var(--muted);}
.qa-cell-emp{display:flex;align-items:center;gap:10px;font-weight:600;}
.qa-score-cell{display:flex;align-items:center;gap:8px;}
.qa-grade-chip{font-size:11px;font-weight:800;padding:2px 7px;border-radius:6px;}
.qa-status{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;}
.qa-view{display:inline-flex;align-items:center;gap:2px;background:none;border:none;color:var(--blue);
  font-weight:600;font-size:12.5px;cursor:pointer;font-family:inherit;padding:5px 8px;border-radius:7px;transition:.15s;}
.qa-view:hover{background:${C.blueSoft};}
.qa-row-actions{display:inline-flex;align-items:center;gap:4px;}
.qa-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;
  border:1px solid var(--line);background:var(--card);color:var(--muted);cursor:pointer;transition:.15s;}
.qa-icon-btn:hover:not(:disabled){color:var(--blue);border-color:#BFDBFE;background:${C.blueSoft};}
.qa-icon-btn.danger:hover:not(:disabled){color:${C.red};border-color:#FECACA;background:#FEF2F2;}
.qa-icon-btn:disabled{opacity:.45;cursor:not-allowed;}
.qa-modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;
  z-index:80;padding:20px;backdrop-filter:blur(2px);}
.qa-modal{width:min(480px,100%);background:var(--card);border-radius:18px;border:1px solid var(--line);
  box-shadow:0 24px 60px rgba(15,23,42,.2);padding:22px 24px;}

/* FORM / UPLOAD */
.qa-grid-form{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.qa-form{display:grid;grid-template-columns:1fr 1fr;gap:15px;}
.qa-fieldwrap{display:flex;flex-direction:column;gap:6px;}
.qa-fieldwrap:first-child,.qa-fieldwrap:nth-child(7){grid-column:span 2;}
.qa-field-label{font-size:12px;font-weight:600;color:var(--muted);}
.qa-input{border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:13px;font-family:inherit;
  background:var(--card);color:var(--ink);outline:none;transition:.18s;width:100%;}
.qa-input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(37,99,235,.12);}
.qa-input-locked{background:var(--bg);color:var(--muted);}
.qa-input.xs{width:64px;padding:6px 8px;}
.qa-select{position:relative;}
.qa-select select{appearance:none;border:1px solid var(--line);border-radius:10px;padding:10px 34px 10px 12px;
  font-size:13px;font-family:inherit;background:var(--card);color:var(--ink);width:100%;cursor:pointer;outline:none;transition:.18s;}
.qa-select select:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(37,99,235,.12);}
.qa-select svg{position:absolute;right:11px;top:50%;transform:translateY(-50%);color:var(--faint);pointer-events:none;}
.qa-select.wide select{min-width:230px;}
.qa-select.sm select{padding:7px 30px 7px 11px;font-size:12.5px;}
.qa-textarea{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:13px;
  font-family:inherit;resize:vertical;min-height:88px;outline:none;color:var(--ink);background:var(--card);transition:.18s;}
.qa-textarea:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(37,99,235,.12);}
.qa-textarea.sm{min-height:62px;}
.qa-drop{border:2px dashed var(--line);border-radius:16px;padding:38px 20px;text-align:center;transition:.2s;background:var(--bg);}
.qa-drop.drag{border-color:var(--blue);background:${C.blueSoft};transform:scale(1.005);}
.qa-drop-ic{width:64px;height:64px;border-radius:18px;background:${C.blueSoft};color:var(--blue);
  display:grid;place-items:center;margin:0 auto 14px;}
.qa-drop.drag .qa-drop-ic{animation:bounce .6s infinite alternate;}
@keyframes bounce{to{transform:translateY(-6px);}}
.qa-drop-title{font-size:15px;font-weight:700;}
.qa-drop-sub{font-size:13px;color:var(--muted);margin-top:4px;}
.qa-drop-types{display:flex;gap:8px;justify-content:center;margin-top:16px;}
.qa-drop-types span{font-size:11px;font-weight:700;color:var(--faint);background:var(--card);
  border:1px solid var(--line);padding:4px 10px;border-radius:7px;}
.qa-file{display:flex;align-items:center;gap:14px;border:1px solid var(--line);border-radius:14px;padding:16px;background:var(--bg);}
.qa-file-ic{width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#EF4444,#DC2626);
  color:#fff;display:grid;place-items:center;flex-shrink:0;}
.qa-file-meta{flex:1;min-width:0;}
.qa-file-name{font-size:13.5px;font-weight:600;}
.qa-file-sub{font-size:11.5px;color:var(--muted);margin:2px 0 8px;}
.qa-file-bar{height:5px;border-radius:5px;background:var(--line);overflow:hidden;}
.qa-file-bar span{display:block;height:100%;background:linear-gradient(90deg,#2563EB,#10B981);
  border-radius:5px;animation:fill 1s ease;}
@keyframes fill{from{width:0;}}
.qa-upload-foot{display:flex;align-items:center;justify-content:space-between;margin-top:20px;gap:14px;flex-wrap:wrap;}
.qa-upload-note{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--muted);}

/* PROCESSING */
.qa-processing{display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;padding:40px 20px;max-width:560px;margin:20px auto;}
.qa-proc-orb{position:relative;width:110px;height:110px;margin-bottom:26px;}
.qa-proc-ring{position:absolute;inset:0;border-radius:50%;border:3px solid transparent;
  border-top-color:#2563EB;border-right-color:#10B981;animation:spin 1s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.qa-proc-core{position:absolute;inset:16px;border-radius:50%;background:linear-gradient(135deg,#2563EB,#10B981);
  display:grid;place-items:center;box-shadow:0 10px 30px rgba(37,99,235,.4);animation:pulse 1.8s ease-in-out infinite;}
@keyframes pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.06);}}
.qa-proc-title{font-size:22px;font-weight:800;letter-spacing:-.4px;}
.qa-proc-sub{font-size:13.5px;color:var(--muted);margin-top:6px;}
.qa-proc-steps{width:100%;margin:28px 0 18px;display:flex;flex-direction:column;gap:9px;}
.qa-proc-step{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;
  font-size:13.5px;font-weight:500;border:1px solid var(--line);background:var(--card);
  color:var(--faint);transition:.3s;}
.qa-proc-step-ic{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;
  background:var(--bg);color:var(--faint);transition:.3s;}
.qa-proc-step.active{border-color:var(--blue);color:var(--ink);box-shadow:0 4px 14px rgba(37,99,235,.12);}
.qa-proc-step.active .qa-proc-step-ic{background:${C.blueSoft};color:var(--blue);}
.qa-proc-step.done{color:var(--ink);}
.qa-proc-step.done .qa-proc-step-ic{background:#E7F8F0;color:#0F9D6B;}
.qa-proc-loader{margin-left:auto;width:16px;height:16px;border:2px solid ${C.blueSoft};
  border-top-color:var(--blue);border-radius:50%;animation:spin .7s linear infinite;}
.qa-proc-bar{width:100%;height:8px;border-radius:8px;background:var(--line);overflow:hidden;}
.qa-proc-bar span{display:block;height:100%;border-radius:8px;background:linear-gradient(90deg,#2563EB,#10B981);
  transition:width .1s linear;}
.qa-proc-eta{font-size:12.5px;color:var(--muted);margin-top:10px;font-weight:500;}

/* RESULTS */
.qa-result-head{display:flex;align-items:center;justify-content:space-between;gap:16px;
  background:linear-gradient(120deg,#13294B 0%,#1B3A6B 100%);border:none;color:#fff;
  position:relative;padding:14px 16px;}
.qa-result-head *{color:#fff;}
.qa-result-title-row{display:flex;align-items:center;gap:10px;min-width:0;}
.qa-result-back{flex-shrink:0;width:26px;height:26px;border-radius:7px;border:1px solid rgba(255,255,255,.16);
  background:rgba(255,255,255,.08);display:inline-flex;align-items:center;justify-content:center;
  cursor:pointer;transition:.15s;padding:0;color:#fff;line-height:0;}
.qa-result-back:hover{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.3);}
.qa-result-back svg{color:#fff;display:block;}
.qa-result-head-left{flex:1;min-width:0;}
.qa-result-project{font-size:18px;font-weight:750;letter-spacing:-.3px;line-height:1.2;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.qa-result-tags{display:flex;align-items:center;gap:12px;margin-top:6px;flex-wrap:wrap;}
.qa-result-tags > span{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#B9CBE8 !important;}
.qa-result-tag-sep{width:1px;height:12px;background:rgba(255,255,255,.22);padding:0 !important;}
.qa-result-hl{gap:6px !important;}
.qa-result-hl b{font-weight:700;font-size:12.5px;}
.qa-result-pending{margin-top:6px;font-size:12px;color:#FBBF24 !important;}
.qa-strength-row{display:flex;gap:26px;margin-top:22px;}
.qa-mini-k{font-size:11px;color:#8FA6C9 !important;font-weight:600;}
.qa-mini-v{font-size:15px;font-weight:700;margin-top:3px;}
.qa-result-ring{position:relative;flex-shrink:0;background:rgba(255,255,255,.08);border-radius:14px;padding:8px 10px;}
.qa-grade-badge{position:absolute;top:2px;right:2px;width:28px;height:28px;border-radius:8px;
  display:grid;place-items:center;font-size:11px;font-weight:800;color:#fff !important;
  box-shadow:0 3px 10px rgba(0,0,0,.22);}

/* RUBRIC TABLE */
.qa-table.rubric td{padding:15px 14px;cursor:pointer;}
.qa-rub-dim{display:flex;flex-direction:column;gap:3px;max-width:340px;}
.qa-rub-name{font-weight:700;font-size:13.5px;}
.qa-rub-desc{min-height:72px;resize:vertical;line-height:1.45;color:var(--ink);}
.qa-table.rubric-edit td{vertical-align:top;padding-top:12px;padding-bottom:12px;}
.qa-rub-desc{font-size:12px;color:var(--muted);}
.qa-rub-score{display:flex;align-items:center;gap:10px;}
.qa-rub-score b{font-size:15px;width:30px;}
.qa-bar5{flex:1;min-width:60px;height:7px;border-radius:6px;background:var(--line);overflow:hidden;}
.qa-bar5-fill{height:100%;border-radius:6px;transition:width 1s cubic-bezier(.22,1,.36,1);}
.qa-tag{font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:20px;}
.qa-chev{color:var(--faint);transition:transform .25s;}
.qa-row.rubric.open{background:var(--bg);}
.qa-expand td{background:var(--bg);padding:0 14px;}
.qa-expand-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;padding:6px 4px 18px;animation:reveal .35s ease;}
.qa-expand-label{display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700;
  text-transform:uppercase;letter-spacing:.05em;color:var(--faint);margin-bottom:8px;}
.qa-expand-grid p{font-size:13px;color:var(--ink);line-height:1.6;}

/* INSIGHTS */
.qa-insight{border-left:3px solid var(--line);}
.qa-insight.strong{border-left-color:${C.emerald};}
.qa-insight.weak{border-left-color:${C.amber};}
.qa-insight-head{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:700;margin-bottom:14px;}
.qa-insight-list{list-style:none;display:flex;flex-direction:column;gap:10px;margin:0;padding:0;}
.qa-insight-list li{position:relative;padding:0;margin:0;list-style:none;}
.qa-insight-list li::before{display:none;}
.qa-insight-item{padding:12px 14px;border-radius:12px;background:rgba(15,23,42,.03);border:1px solid var(--line);}
.qa-insight.strong .qa-insight-item{background:rgba(16,185,129,.06);border-color:rgba(16,185,129,.18);}
.qa-insight.weak .qa-insight-item{background:rgba(245,158,11,.07);border-color:rgba(245,158,11,.2);}
.qa-insight-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:6px;}
.qa-insight-title{font-size:13.5px;font-weight:700;color:var(--ink);line-height:1.35;}
.qa-insight-score{font-size:12px;font-weight:700;color:var(--muted);white-space:nowrap;}
.qa-insight.strong .qa-insight-score{color:${C.emerald};}
.qa-insight.weak .qa-insight-score{color:#B77400;}
.qa-insight-body{margin:0;font-size:13px;color:var(--muted);line-height:1.55;}
.qa-insight-body.solo{font-size:13.5px;color:var(--ink);}
.qa-insight-empty{font-size:13px;color:var(--faint);padding:8px 2px;list-style:none;}
.qa-decision-locked .qa-decision-notes{margin:0;padding:14px 16px;border-radius:12px;background:rgba(15,23,42,.03);
  border:1px solid var(--line);font-size:13.5px;color:var(--ink);line-height:1.55;white-space:pre-wrap;}
.qa-status-dot{width:7px;height:7px;border-radius:50%;display:inline-block;}

/* DECISION */
.qa-decision{display:flex;align-items:center;gap:10px;margin-top:16px;flex-wrap:wrap;}
.qa-decide{display:inline-flex;align-items:center;gap:7px;padding:11px 20px;border-radius:11px;
  font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid transparent;transition:.18s;}
.qa-decide.approve{background:linear-gradient(135deg,#10B981,#059669);color:#fff;box-shadow:0 6px 16px rgba(16,185,129,.28);}
.qa-decide.revise{background:#FEF5E6;color:#B77400;border-color:#F5D9A6;}
.qa-decide.reject{background:#FDECEC;color:#C4322B;border-color:#F5C4C0;}
.qa-decide:hover{transform:translateY(-1px);}
.qa-decision-spacer{flex:1;}

/* EMPLOYEE */
.qa-emp-select{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 22px;}
.qa-emp-select-left{display:flex;align-items:center;gap:14px;}
.qa-emp-tabs,.qa-tab{display:flex;gap:6px;}
.qa-tab{padding:8px 16px;border-radius:9px;border:1px solid var(--line);background:var(--card);
  font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;font-family:inherit;transition:.15s;}
.qa-tab.on{background:var(--navy);color:#fff;border-color:var(--navy);}
.qa-grid-profile{display:grid;grid-template-columns:300px 1fr;gap:20px;}
.qa-profile{display:flex;flex-direction:column;align-items:center;text-align:center;}
.qa-profile-name{font-size:19px;font-weight:800;margin-top:14px;letter-spacing:-.3px;}
.qa-profile-role{font-size:13px;color:var(--muted);margin-top:2px;}
.qa-profile-grade{font-size:12.5px;font-weight:700;padding:6px 14px;border-radius:20px;margin:14px 0;}
.qa-profile-stats{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;margin-bottom:18px;}
.qa-profile-stats>div{background:var(--bg);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:2px;}
.qa-profile-stats b{font-size:18px;font-weight:800;color:var(--ink);}
.qa-profile-stats span{font-size:11px;color:var(--muted);}
.qa-gauge2{width:100%;margin-bottom:14px;text-align:left;}
.qa-gauge2-top{display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px;}
.qa-profile-trend{display:flex;align-items:center;justify-content:space-between;width:100%;
  border-top:1px solid var(--line);padding-top:14px;font-size:13px;color:var(--muted);font-weight:600;}
.qa-profile-trend b{display:inline-flex;align-items:center;gap:4px;}
.qa-profile-trend b.up{color:#0F9D6B;}.qa-profile-trend b.down{color:#C4322B;}
.qa-rowmini{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:9px 0;
  border-bottom:1px solid var(--line);font-size:12.5px;font-weight:600;}
.qa-rowmini:last-child{border-bottom:none;}
.qa-rowmini-r{display:flex;align-items:center;gap:10px;width:130px;}
.qa-rowmini-r b{width:28px;text-align:right;}

/* ANALYTICS */
.qa-filters{display:flex;align-items:center;gap:16px;padding:16px 22px;flex-wrap:wrap;}
.qa-filters-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--ink);}
.qa-filter{display:flex;flex-direction:column;gap:4px;}
.qa-filter>span{font-size:11px;font-weight:600;color:var(--faint);}
.qa-filters-spacer{flex:1;}
.qa-improved{display:flex;flex-direction:column;gap:6px;}
.qa-improved-row{display:flex;align-items:center;gap:12px;padding:8px;border-radius:10px;transition:.15s;}
.qa-improved-row:hover{background:var(--bg);}
.qa-improved-meta{width:130px;}
.qa-improved-bar{flex:1;height:8px;border-radius:8px;background:var(--line);overflow:hidden;}
.qa-improved-bar span{display:block;height:100%;border-radius:8px;transition:width 1s ease;}
.qa-improved-row b{width:34px;text-align:right;font-size:13px;}

/* HEATMAP */
.qa-heat{display:grid;grid-template-columns:70px repeat(6,1fr);gap:6px;}
.qa-heat-corner{}
.qa-heat-colh{font-size:11px;font-weight:700;color:var(--faint);text-align:center;padding-bottom:2px;}
.qa-heat-rowh{font-size:12px;font-weight:600;color:var(--muted);display:flex;align-items:center;}
.qa-heat-cell{height:46px;border-radius:9px;display:grid;place-items:center;font-size:13px;
  font-weight:700;color:#0B3B2E;cursor:default;transition:transform .15s;}
.qa-heat-cell:hover{transform:scale(1.06);}

/* PROJECTS */
.qa-proj-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
.qa-proj{display:flex;flex-direction:column;align-items:center;text-align:center;transition:transform .22s,box-shadow .22s;}
.qa-proj:hover{transform:translateY(-3px);box-shadow:0 16px 36px rgba(16,30,54,.1);}
.qa-proj-top{display:flex;align-items:center;justify-content:space-between;width:100%;}
.qa-proj-ic{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;}
.qa-proj-name{font-size:16px;font-weight:800;margin-top:14px;letter-spacing:-.3px;}
.qa-proj-unit{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--muted);margin-top:3px;}
.qa-proj-score{margin:16px 0;}
.qa-proj-foot{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:100%;border-top:1px solid var(--line);padding-top:14px;}
.qa-proj-foot>div{display:flex;flex-direction:column;gap:1px;}
.qa-proj-foot b{font-size:15px;font-weight:800;}
.qa-proj-foot span{font-size:10.5px;color:var(--muted);}

/* RUBRIC MGMT */
.qa-rubric-head{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:18px 22px;}
.qa-rubric-head .qa-cardhead{margin-bottom:0;}
.qa-rubric-head-right{display:flex;align-items:center;gap:10px;}
.qa-weight-pill{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;padding:8px 13px;border-radius:10px;}
.qa-weight-pill.ok{color:#0F9D6B;background:#E7F8F0;}
.qa-weight-pill.warn{color:#B77400;background:#FEF5E6;}
.qa-weight-edit{display:flex;align-items:center;gap:5px;font-size:13px;color:var(--muted);}
.qa-toggle{width:42px;height:24px;border-radius:20px;background:var(--line);border:none;cursor:pointer;
  position:relative;transition:.2s;padding:0;}
.qa-toggle.on{background:var(--emerald);}
.qa-toggle-knob{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;
  transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.2);}
.qa-toggle.on .qa-toggle-knob{left:21px;}
.qa-scoreguide{display:flex;gap:5px;}
.qa-sg-chip{width:22px;height:22px;border-radius:6px;display:grid;place-items:center;font-size:11px;font-weight:800;}
.qa-audit{margin-top:20px;border-top:1px solid var(--line);padding-top:16px;}
.qa-audit-title{display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700;
  text-transform:uppercase;letter-spacing:.05em;color:var(--faint);margin-bottom:12px;}
.qa-audit-row{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted);padding:6px 0;}
.qa-audit-row b{color:var(--ink);}
.qa-audit-when{margin-left:auto;font-size:11.5px;color:var(--faint);}

/* REPORTS */
.qa-report-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;}
.qa-report{display:flex;flex-direction:column;transition:transform .22s,box-shadow .22s;}
.qa-report:hover{transform:translateY(-3px);box-shadow:0 16px 36px rgba(16,30,54,.1);}
.qa-report-ic{width:48px;height:48px;border-radius:13px;display:grid;place-items:center;margin-bottom:14px;}
.qa-report-t{font-size:16px;font-weight:700;}
.qa-report-d{font-size:13px;color:var(--muted);margin-top:4px;flex:1;}
.qa-report-actions{display:flex;gap:10px;margin-top:18px;}

/* TOOLTIP */
.qa-tip{background:var(--navy);color:#fff;border-radius:10px;padding:9px 13px;box-shadow:0 10px 26px rgba(0,0,0,.25);}
.qa-tip-label{font-size:11px;color:#9FB4D6;font-weight:600;}
.qa-tip-val{font-size:15px;font-weight:800;margin-top:2px;}

/* SCROLLBAR */
.qa-scroll::-webkit-scrollbar{width:9px;}
.qa-scroll::-webkit-scrollbar-thumb{background:#CBD5E5;border-radius:9px;border:2px solid var(--bg);}
.qa-scroll::-webkit-scrollbar-thumb:hover{background:#94A3B8;}

/* RESPONSIVE */
@media(max-width:1200px){
  .qa-kpi-grid{grid-template-columns:repeat(2,1fr);}
  .qa-grid-3,.qa-grid-2,.qa-grid-form,.qa-grid-profile,.qa-proj-grid,.qa-report-grid,.qa-expand-grid{grid-template-columns:1fr;}
  .qa-grid-3 .qa-card[style]{grid-column:auto !important;}
}
@media(max-width:820px){
  .qa-sidebar{display:none;}
  .qa-search{width:180px;}
  .qa-form{grid-template-columns:1fr;}
  .qa-fieldwrap:first-child,.qa-fieldwrap:nth-child(7){grid-column:auto;}
  .qa-result-head{flex-direction:column;align-items:stretch;}
  .qa-result-ring{align-self:flex-start;}
}
@media(prefers-reduced-motion:reduce){*{animation:none !important;transition:none !important;}}
    `}</style>
  );
}
