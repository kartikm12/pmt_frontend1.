import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Download, Clock, FolderKanban, Printer, User as UserIcon } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { api, type ReportData } from "@/lib/api";
import type { Project, User } from "@/lib/api-types";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { isManager as isManagerRole } from "@/utils/roleUtils";
import { safeFormat } from "@/utils/dateUtils";
import { downloadCsv } from "@/lib/csv";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";
import { PageLoader } from "@/components/ui/PageLoader";
import { useMediaQuery } from "@/lib/useMediaQuery";

const PERIODS = [7, 30, 90];
// Validated with the dataviz palette checker (light and dark): green/indigo pass CVD with the dashed line as
// second cue; status hues pass with labels on every segment. To-do grey is neutral on purpose.
const LINE = { completed: "#059669", new: "#6366F1" };
const STATUS: { key: string; label: string; light: string; dark: string }[] = [
  { key: "TODO", label: "To do", light: "#94A3B8", dark: "#94A3B8" },
  { key: "IN_PROGRESS", label: "In progress", light: "#D97706", dark: "#D97706" },
  { key: "REVIEW", label: "Review", light: "#7C3AED", dark: "#8B5CF6" },
  { key: "DONE", label: "Done", light: "#059669", dark: "#059669" }
];
const HEALTH = {
  on_track: { label: "On track", icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  at_risk: { label: "At risk", icon: AlertTriangle, cls: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  overdue: { label: "Overdue", icon: Clock, cls: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" }
} as const;

function useDarkMode() {
  const { theme } = useTheme(); // re-render when the theme changes
  return useMemo(() => document.documentElement.classList.contains("dark"), [theme]);
}

export function Reports() {
  const { currentUser } = useAuth();
  const manager = isManagerRole(currentUser?.role);
  const dark = useDarkMode();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [projectId, setProjectId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getProjects(), manager ? api.getTeam() : Promise.resolve([] as User[])])
      .then(([p, u]) => { setProjects(p); setPeople(u); })
      .catch(() => undefined);
  }, [manager]);

  useEffect(() => {
    let stale = false;
    setIsLoading(true);
    api.getComprehensiveReport({ days, projectId: projectId || undefined, memberId: memberId || undefined })
      .then((r) => !stale && setData(r))
      .catch((e) => !stale && toast.error(e instanceof Error ? e.message : "Couldn't load the report"))
      .finally(() => !stale && setIsLoading(false));
    return () => { stale = true; };
  }, [days, projectId, memberId]);

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(`report-${days}d-${new Date().toLocaleDateString("en-CA")}.csv`, [
      ["Project", "Status", "Reason", "Tasks", "Done", "Progress %", "Overdue", "Hours logged", "Hours estimated", "Deadline"],
      ...data.projectProgress.map((p) => [p.name, HEALTH[p.health].label, p.healthReason, p.total, p.completed, p.total ? Math.round((p.completed / p.total) * 100) : 0, p.overdue, p.loggedHours, p.estimatedHours, p.dueDate ? safeFormat(p.dueDate, "yyyy-MM-dd", "") : ""]),
      [],
      ["Overdue task", "Project", "Days late", "Assignees"],
      ...data.overdueTasks.map((t) => [t.title, t.project?.name ?? "", t.daysLate, t.assignees.map((a) => a.fullName).join("; ")])
    ]);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500" id="report">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Reports</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">How the work is going, compared with the period before.</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button onClick={exportCsv} disabled={!data} className="btn-secondary px-3 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-50">
              <Download className="w-4 h-4" /> CSV
            </button>
            <button onClick={() => window.print()} disabled={!data} className="btn-secondary px-3 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-50">
              <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Print / PDF</span><span className="sm:hidden">Print</span>
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div role="radiogroup" aria-label="Period" className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {PERIODS.map((d) => (
              <button
                key={d}
                role="radio"
                aria-checked={days === d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${days === d ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"}`}
              >
                {d} days
              </button>
            ))}
          </div>
          <div className="w-full sm:w-auto sm:min-w-[190px]">
            <SingleSelectDropdown ariaLabel="Project" options={[{ id: "", name: "All projects" }, ...projects.map((p) => ({ id: p.id, name: p.name }))]} selectedId={projectId} onChange={setProjectId} Icon={FolderKanban} variant="default" />
          </div>
          {manager && (
            <div className="w-full sm:w-auto sm:min-w-[190px]">
              <SingleSelectDropdown ariaLabel="Person" options={[{ id: "", name: "Everyone" }, ...people.map((u) => ({ id: u.id, name: u.name }))]} selectedId={memberId} onChange={setMemberId} Icon={UserIcon} variant="default" />
            </div>
          )}
        </div>
      </div>

      {isLoading && !data ? (
        <PageLoader />
      ) : !data ? (
        <div className="card p-10 text-center text-slate-500">The report couldn't load. Try again in a moment.</div>
      ) : (
        <div className={`space-y-6 transition-opacity ${isLoading ? "opacity-60" : ""}`} aria-busy={isLoading}>
          <Headline data={data} />
          <TrendCard data={data} />
          <ProjectHealth data={data} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StatusMix data={data} dark={dark} />
            <Workload data={data} onPick={(id) => navigate(`/tasks?person=${id}&status=Pending`)} />
          </div>
          <NeedsAttention data={data} />
        </div>
      )}

      {/* Print / save as PDF: only the report, on white */}
      <style>{`
        @media print {
          aside, header, nav[aria-label="Breadcrumb"] { display: none !important; }
          body, main { background: white !important; overflow: visible !important; }
          .card { box-shadow: none !important; border: 1px solid #e2e8f0 !important; break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

// ---------- headline numbers ----------
function Delta({ now, before, unit = "", goodWhenUp = true, neutral = false, days }: { now: number | null; before: number | null; unit?: string; goodWhenUp?: boolean; neutral?: boolean; days: number }) {
  if (now == null || before == null) return <p className="text-xs text-slate-400 mt-1">No earlier data to compare</p>;
  const diff = now - before;
  if (diff === 0) return <p className="text-xs text-slate-500 mt-1">Same as the previous {days} days</p>;
  const up = diff > 0;
  const tone = neutral ? "text-slate-500 dark:text-slate-400" : up === goodWhenUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  return <p className={`text-xs font-semibold mt-1 ${tone}`}>{up ? "▲" : "▼"} {Math.abs(diff)}{unit} vs previous {days} days</p>;
}

function Headline({ data }: { data: ReportData }) {
  const { current, previous, overdueNow, overdueProjects, days } = data.summary;
  const tile = "card p-4 sm:p-5";
  const label = "text-sm text-slate-500 dark:text-slate-400";
  const value = "text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1";
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" aria-label="Headline numbers">
      <div className={tile} data-kpi="completed">
        <p className={label}>Completed</p>
        <p className={value}>{current.completed}</p>
        <Delta now={current.completed} before={previous.completed} days={days} />
      </div>
      <div className={tile} data-kpi="created">
        <p className={label}>New tasks</p>
        <p className={value}>{current.created}</p>
        <Delta now={current.created} before={previous.created} days={days} neutral />
      </div>
      <div className={tile} data-kpi="ontime">
        <p className={label}>Finished on time</p>
        <p className={value}>{current.onTimeRate == null ? "—" : `${current.onTimeRate}%`}</p>
        <Delta now={current.onTimeRate} before={previous.onTimeRate} unit=" pts" days={days} />
      </div>
      <div className={tile} data-kpi="overdue">
        <p className={label}>Overdue now</p>
        <p className={`${value} ${overdueNow ? "!text-red-600 dark:!text-red-400" : ""}`}>{overdueNow}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{overdueNow ? `across ${overdueProjects} project${overdueProjects === 1 ? "" : "s"}` : "Nothing is late"}</p>
      </div>
    </div>
  );
}

// ---------- new vs completed ----------
function TrendCard({ data }: { data: ReportData }) {
  const totals = data.trends.reduce((a, d) => ({ c: a.c + d.completed, n: a.n + d.new }), { c: 0, n: 0 });
  const reading = totals.c > totals.n
    ? `The team finished ${totals.c - totals.n} more than came in: the backlog is shrinking.`
    : totals.c < totals.n
      ? `${totals.n - totals.c} more came in than were finished: the backlog is growing.`
      : "As much was finished as came in.";
  return (
    <section className="card p-5" aria-label="New and completed per day">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">New vs completed, per day</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400" data-trend-reading>{reading}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300" aria-label="Legend">
          <span className="flex items-center gap-1.5"><svg width="22" height="6" aria-hidden="true"><line x1="0" y1="3" x2="22" y2="3" stroke={LINE.completed} strokeWidth="2.5" /></svg>Completed ({totals.c})</span>
          <span className="flex items-center gap-1.5"><svg width="22" height="6" aria-hidden="true"><line x1="0" y1="3" x2="22" y2="3" stroke={LINE.new} strokeWidth="2" strokeDasharray="5 4" /></svg>New ({totals.n})</span>
        </div>
      </div>
      <div className="h-56 sm:h-64 -ml-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.trends} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <Tooltip
              cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }}
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
              formatter={(v: number, k: string) => [v, k === "completed" ? "Completed" : "New"]}
            />
            <Line type="linear" dataKey="completed" stroke={LINE.completed} strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2 }} />
            <Line type="linear" dataKey="new" stroke={LINE.new} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 5, strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ---------- project health ----------
function HealthBadge({ health, reason }: { health: keyof typeof HEALTH; reason: string }) {
  const h = HEALTH[health];
  return (
    <span title={reason || h.label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold whitespace-nowrap ${h.cls}`}>
      <h.icon className="w-3.5 h-3.5" aria-hidden="true" />
      {h.label}
    </span>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: LINE.completed }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 w-9 text-right">{pct}%</span>
    </div>
  );
}

function ProjectHealth({ data }: { data: ReportData }) {
  // Problems first: overdue, then at risk, then on track
  const order = { overdue: 0, at_risk: 1, on_track: 2 } as const;
  const rows = [...data.projectProgress].sort((a, b) => order[a.health] - order[b.health] || b.overdue - a.overdue);
  const hours = (p: ReportData["projectProgress"][number]) => (p.estimatedHours ? `${p.loggedHours} / ${p.estimatedHours}h` : p.loggedHours ? `${p.loggedHours}h` : "—");
  const over = (p: ReportData["projectProgress"][number]) => p.estimatedHours > 0 && p.loggedHours > p.estimatedHours;
  const wide = useMediaQuery("(min-width: 768px)");
  return (
    <section className="card overflow-hidden" aria-label="Project health">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Project health</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Active projects, problems first.</p>
      </div>
      {!rows.length ? (
        <p className="px-5 pb-6 text-sm text-slate-500">No active projects in this view.</p>
      ) : (
        <>
          {/* Wide screens: a table; phones: one card per project (only one is rendered) */}
          {wide ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-slate-400 border-y border-slate-100 dark:border-slate-800">
                  <th className="px-5 py-2 font-semibold">Project</th>
                  <th className="px-5 py-2 font-semibold">Progress</th>
                  <th className="px-5 py-2 font-semibold">Overdue</th>
                  <th className="px-5 py-2 font-semibold">Hours</th>
                  <th className="px-5 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((p) => (
                  <tr key={p.id} data-project-health={p.name}>
                    <td className="px-5 py-3">
                      <Link to={`/projects/${p.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-indigo-600">{p.name}</Link>
                      <p className="text-xs text-slate-400">{p.dueDate ? `due ${safeFormat(p.dueDate, "MMM d, yyyy")}` : "no deadline"} · {p.completed}/{p.total} tasks</p>
                    </td>
                    <td className="px-5 py-3"><Progress done={p.completed} total={p.total} /></td>
                    <td className={`px-5 py-3 font-semibold ${p.overdue ? "text-red-600 dark:text-red-400" : "text-slate-400"}`}>{p.overdue}</td>
                    <td className={`px-5 py-3 whitespace-nowrap ${over(p) ? "text-red-600 dark:text-red-400 font-semibold" : "text-slate-600 dark:text-slate-300"}`}>{hours(p)}</td>
                    <td className="px-5 py-3">
                      <HealthBadge health={p.health} reason={p.healthReason} />
                      {p.healthReason && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{p.healthReason}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
            {rows.map((p) => (
              <li key={p.id} className="px-5 py-4 space-y-2" data-project-health-card={p.name}>
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/projects/${p.id}`} className="font-semibold text-slate-900 dark:text-white min-w-0 break-words">{p.name}</Link>
                  <HealthBadge health={p.health} reason={p.healthReason} />
                </div>
                <Progress done={p.completed} total={p.total} />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {p.completed}/{p.total} tasks · <span className={p.overdue ? "text-red-600 font-semibold" : ""}>{p.overdue} overdue</span> · <span className={over(p) ? "text-red-600 font-semibold" : ""}>{hours(p)}</span>
                  {p.dueDate ? ` · due ${safeFormat(p.dueDate, "MMM d")}` : ""}
                </p>
                {p.healthReason && <p className="text-xs text-slate-500 dark:text-slate-400">{p.healthReason}</p>}
              </li>
            ))}
          </ul>
          )}
        </>
      )}
    </section>
  );
}

// ---------- status mix ----------
function StatusMix({ data, dark }: { data: ReportData; dark: boolean }) {
  const counts = STATUS.map((s) => ({ ...s, value: data.statusData.find((d) => d.name === s.key)?.value ?? 0, color: dark ? s.dark : s.light }));
  const total = counts.reduce((a, c) => a + c.value, 0);
  return (
    <section className="card p-5" aria-label="Where the work stands">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Where the work stands</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{total} task{total === 1 ? "" : "s"} in this view</p>
      {total === 0 ? (
        <p className="text-sm text-slate-500">No tasks yet.</p>
      ) : (
        <>
          <div className="flex h-4 rounded-full overflow-hidden gap-0.5" role="img" aria-label={counts.map((c) => `${c.label} ${c.value}`).join(", ")}>
            {counts.filter((c) => c.value).map((c) => (
              <div key={c.key} title={`${c.label}: ${c.value}`} style={{ width: `${(c.value / total) * 100}%`, background: c.color }} />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
            {counts.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-2" data-status-count={c.label}>
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.color }} aria-hidden="true" />{c.label}</span>
                <span className="font-bold text-slate-900 dark:text-white">{c.value} <span className="text-xs font-normal text-slate-400">({Math.round((c.value / total) * 100)}%)</span></span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ---------- open work per person ----------
function Workload({ data, onPick }: { data: ReportData; onPick: (id: string) => void }) {
  const rows = data.workloadDistribution.filter((w) => w.taskCount > 0).slice(0, 8);
  const max = Math.max(1, ...rows.map((r) => r.taskCount));
  return (
    <section className="card p-5" aria-label="Open work per person">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Open work per person</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Red part = overdue. Click a person to see their tasks.</p>
      {!rows.length ? (
        <p className="text-sm text-slate-500">Nobody has open tasks.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <button onClick={() => onPick(r.id)} className="w-full text-left group" data-workload-row={r.name}>
                <div className="flex justify-between gap-2 text-sm mb-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 truncate">{r.name}</span>
                  <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{r.taskCount} open{r.overdue ? <span className="text-red-600 dark:text-red-400 font-semibold"> · {r.overdue} overdue</span> : ""}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex" style={{ width: `${(r.taskCount / max) * 100}%` }}>
                  <div className="h-full bg-red-500" style={{ width: `${(r.overdue / r.taskCount) * 100}%` }} />
                  <div className="h-full bg-indigo-500 flex-1" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- needs attention ----------
function NeedsAttention({ data }: { data: ReportData }) {
  return (
    <section className="card overflow-hidden" aria-label="Needs attention">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Needs attention</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Overdue tasks, oldest first{data.summary.overdueNow > data.overdueTasks.length ? ` (showing ${data.overdueTasks.length} of ${data.summary.overdueNow})` : ""}.</p>
      </div>
      {!data.overdueTasks.length ? (
        <p className="px-5 pb-6 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Nothing is overdue.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
          {data.overdueTasks.map((t) => (
            <li key={t.id}>
              <Link to={`/tasks/${t.id}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50" data-attention={t.title}>
                <span className="min-w-0">
                  <span className="font-semibold text-slate-900 dark:text-white">{t.title}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400"> · {t.project?.name ?? "—"}{t.assignees.length ? ` · ${t.assignees.map((a) => a.fullName).join(", ")}` : ""}</span>
                </span>
                <span className="text-sm font-bold text-red-600 dark:text-red-400 whitespace-nowrap">{t.daysLate} day{t.daysLate === 1 ? "" : "s"} late</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
