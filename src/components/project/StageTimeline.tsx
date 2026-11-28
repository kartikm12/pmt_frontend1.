import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// The Timeline's "Stages" view: how long each task spent in To Do, In progress, Review and Completed, in
// order, including going back. Built by the server from the task's history (stage-history).

type Segment = { stage: string; from: string; to: string | null };
type TaskStages = { id: string; title: string; status: string; createdAt: string; segments: Segment[] };

const STAGE: Record<string, { label: string; bar: string; dot: string }> = {
  TODO: { label: "To Do", bar: "bg-slate-400", dot: "bg-slate-400" },
  IN_PROGRESS: { label: "In progress", bar: "bg-indigo-500", dot: "bg-indigo-500" },
  REVIEW: { label: "Review", bar: "bg-amber-500", dot: "bg-amber-500" },
  DONE: { label: "Completed", bar: "bg-emerald-500", dot: "bg-emerald-500" }
};
const ORDER = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];
const DAY = 864e5;

const end = (s: Segment, now: number) => (s.to ? new Date(s.to).getTime() : now);
// Whole days, by calendar day ("Nov 10 to Nov 12" = 2 days); under a day says so
export function daysText(from: number, to: number) {
  const days = Math.round((new Date(format(to, "yyyy-MM-dd")).getTime() - new Date(format(from, "yyyy-MM-dd")).getTime()) / DAY);
  return days <= 0 ? "under a day" : `${days} day${days === 1 ? "" : "s"}`;
}
const range = (s: Segment, now: number) => {
  const a = new Date(s.from), b = new Date(end(s, now));
  if (s.stage === "DONE") return format(a, "MMM d");
  const same = format(a, "yyyy-MM-dd") === format(b, "yyyy-MM-dd");
  const tail = s.to ? (same ? "" : ` – ${format(b, format(a, "MMM") === format(b, "MMM") ? "d" : "MMM d")}`) : " – now";
  return `${format(a, "MMM d")}${tail}`;
};

export function StageTimeline({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<TaskStages[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const now = Date.now();

  useEffect(() => {
    api.getStageHistory(projectId).then((r) => setRows(r as TaskStages[])).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the stages"));
  }, [projectId]);

  const [start, finish] = useMemo(() => {
    if (!rows?.length) return [now - 7 * DAY, now];
    const a = Math.min(...rows.map((r) => new Date(r.segments[0]?.from ?? r.createdAt).getTime()));
    return [a, Math.max(now, a + DAY)];
  }, [rows]);
  const span = Math.max(DAY, finish - start);
  const ticks = useMemo(() => [0, 1, 2, 3].map((i) => start + (span * i) / 3), [start, span]);

  if (error) return <p className="text-sm text-red-600 dark:text-red-400 py-6 text-center">{error}</p>;
  if (!rows) return <p className="text-sm text-slate-500 py-6 text-center">Loading the stages...</p>;
  if (!rows.length) return <p className="text-sm text-slate-500 dark:text-slate-400 py-10 text-center" data-stages-empty>No tasks yet. Each task's stages show here once it has some history.</p>;

  return (
    <div data-stage-timeline>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
        {ORDER.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className={cn("w-2.5 h-2.5 rounded-full", STAGE[k].dot)} />{STAGE[k].label}</span>
        ))}
        <span className="ml-auto">Click a task to see its stages in order</span>
      </div>
      <div className="hidden sm:grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] gap-3 text-xs text-slate-400 mb-1">
        <span />
        <span className="flex justify-between">{ticks.map((t) => <span key={t}>{format(t, "MMM d")}</span>)}</span>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((r) => {
          const isOpen = open === r.id;
          const totals = ORDER.filter((k) => k !== "DONE").map((k) => [k, r.segments.filter((s) => s.stage === k).reduce((n, s) => n + (end(s, now) - new Date(s.from).getTime()), 0)] as const).filter(([, ms]) => ms > 0);
          const wentBack = r.segments.some((s, i) => i > 0 && ORDER.indexOf(s.stage) < ORDER.indexOf(r.segments[i - 1].stage));
          return (
            <li key={r.id} data-stage-row={r.title}>
              <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen} className={cn("w-full grid grid-cols-1 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] gap-1.5 sm:gap-3 items-center py-2.5 px-1 text-left rounded-lg", isOpen ? "bg-slate-50 dark:bg-slate-800/50" : "hover:bg-slate-50 dark:hover:bg-slate-800/30")}>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{r.title}</span>
                <span className="relative h-5 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  {r.segments.map((s, i) => {
                    const a = new Date(s.from).getTime(), b = Math.max(end(s, now), a + (s.stage === "DONE" ? DAY / 6 : 0));
                    return (
                      <span
                        key={i}
                        data-segment={s.stage}
                        title={`${STAGE[s.stage]?.label ?? s.stage}: ${range(s, now)}`}
                        className={cn("absolute top-0 bottom-0 border-r-2 border-white dark:border-slate-900", STAGE[s.stage]?.bar ?? "bg-slate-300")}
                        style={(() => {
                          // At least a sliver, and never past the right edge (a task made minutes ago still shows)
                          const width = Math.max(1, ((b - a) / span) * 100);
                          const left = Math.min(((a - start) / span) * 100, 100 - width);
                          return { left: `${left}%`, width: `${width}%` };
                        })()}
                      />
                    );
                  })}
                </span>
              </button>
              {isOpen && (
                <div className="ml-1 sm:ml-[192px] mb-3 mt-1 rounded-xl border border-slate-200 dark:border-slate-700 p-3" data-stage-detail>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    {r.title}
                    <span className="font-normal text-slate-500 dark:text-slate-400"> · {daysText(new Date(r.segments[0].from).getTime(), end(r.segments[r.segments.length - 1], now))}{wentBack ? ", went back a stage" : ""}</span>
                  </p>
                  <ol className="space-y-1 text-sm">
                    {r.segments.map((s, i) => (
                      <li key={i} data-stage-line className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", STAGE[s.stage]?.dot)} />
                        <span className="w-32 shrink-0 text-slate-500 dark:text-slate-400">{range(s, now)}</span>
                        <span>{STAGE[s.stage]?.label ?? s.stage}</span>
                        {s.stage !== "DONE" && <span className="text-slate-400">· {daysText(new Date(s.from).getTime(), end(s, now))}</span>}
                      </li>
                    ))}
                  </ol>
                  {totals.length > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      In total: {totals.map(([k, ms]) => `${STAGE[k].label} ${ms < DAY ? "under a day" : `${Math.round(ms / DAY)} day${Math.round(ms / DAY) === 1 ? "" : "s"}`}`).join(" · ")}
                    </p>
                  )}
                  <Link to={`/tasks/${r.id}`} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block">Open the task</Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
