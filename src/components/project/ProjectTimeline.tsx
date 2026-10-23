import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Task } from "@/lib/api-types";
import { safeFormat } from "@/utils/dateUtils";

const ROW = 36;
const DAY = 864e5;
const STATUS_COLOR: Record<string, string> = {
  "To Do": "bg-slate-400",
  "In Progress": "bg-amber-400",
  Review: "bg-sky-500",
  Completed: "bg-emerald-500"
};

// Read-only Gantt: bars from start (or creation) to due date, dependency lines
export function ProjectTimeline({ tasks }: { tasks: Task[] }) {
  const navigate = useNavigate();
  const rows = useMemo(() => {
    return tasks
      .filter((t) => t.dueDate)
      .map((t) => {
        const end = new Date(t.dueDate).getTime();
        const startRaw = new Date(t.startDate || t.createdAt || t.dueDate).getTime();
        return { task: t, start: Math.min(startRaw, end), end };
      })
      .sort((a, b) => a.start - b.start || a.end - b.end);
  }, [tasks]);

  if (!rows.length) {
    return <div className="card p-10 text-center text-slate-500 dark:text-slate-400">Add due dates to tasks to see them on the timeline.</div>;
  }

  const times = [...rows.flatMap((r) => [r.start, r.end]), Date.now()];
  const min = Math.min(...times) - DAY;
  const max = Math.max(...times) + DAY;
  const pct = (t: number) => ((t - min) / (max - min)) * 100;
  const rowOf = new Map<string, number>(rows.map((r, i) => [r.task.id, i]));
  const height = Math.max(rows.length, 1) * ROW;

  // Week ticks along the top
  const ticks: number[] = [];
  for (let t = min; t <= max; t += 7 * DAY) ticks.push(t);

  return (
    <div className="card p-6 overflow-x-auto" aria-label="Project timeline">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[200px_1fr] gap-4">
          <div />
          <div className="relative h-8 border-b border-slate-200 dark:border-slate-800">
            {ticks.map((t) => (
              <span key={t} className="absolute text-[10px] text-slate-400 -translate-x-1/2" style={{ left: `${pct(t)}%` }}>{safeFormat(new Date(t), "MMM d")}</span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[200px_1fr] gap-4 mt-2">
          <div>
            {rows.map(({ task }) => (
              <Link key={task.id} to={`/tasks/${task.id}`} className="block w-full text-left text-sm truncate text-slate-700 dark:text-slate-300 hover:text-indigo-600" style={{ height: ROW, lineHeight: `${ROW}px` }}>
                {task.title}
              </Link>
            ))}
          </div>
          <div className="relative" style={{ height }}>
            <div className="absolute top-0 bottom-0 w-px bg-red-400" style={{ left: `${pct(Date.now())}%` }} title="Today" />
            {/* Dependency lines: blocker's end to the blocked task's start */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
              {rows.flatMap(({ task, start }) =>
                (task.blockedBy ?? []).filter((b) => rowOf.has(b.id)).map((b) => {
                  const from = rows[rowOf.get(b.id)!];
                  const y1 = rowOf.get(b.id)! * ROW + ROW / 2;
                  const y2 = rowOf.get(task.id)! * ROW + ROW / 2;
                  return (
                    <path
                      key={`${b.id}-${task.id}`}
                      d={`M ${pct(from.end)} ${y1} C ${pct(from.end) + 2} ${y1}, ${pct(start) - 2} ${y2}, ${pct(start)} ${y2}`}
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                      data-dependency={`${b.title} -> ${task.title}`}
                    />
                  );
                })
              )}
            </svg>
            {rows.map(({ task, start, end }, i) => (
              <button
                key={task.id}
                onClick={() => navigate(`/tasks/${task.id}`)}
                title={`${task.title}: ${safeFormat(new Date(start), "MMM d")} → ${safeFormat(new Date(end), "MMM d")} (${task.status})`}
                aria-label={`${task.title}, ${task.status}, due ${safeFormat(task.dueDate, "MMM d")}`}
                data-bar={task.title}
                className={`absolute h-4 rounded-md ${STATUS_COLOR[task.status] ?? "bg-slate-400"} hover:ring-2 hover:ring-indigo-300`}
                style={{ top: i * ROW + (ROW - 16) / 2, left: `${pct(start)}%`, width: `max(${pct(end) - pct(start)}%, 8px)` }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-slate-500 dark:text-slate-400">
          {Object.entries(STATUS_COLOR).map(([s, c]) => <span key={s} className="flex items-center gap-1.5"><span className={`w-3 h-2 rounded ${c}`} />{s}</span>)}
          <span className="flex items-center gap-1.5"><span className="w-3 h-px bg-red-400" />Today</span>
        </div>
      </div>
    </div>
  );
}
