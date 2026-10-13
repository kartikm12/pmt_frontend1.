import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";

type Row = Awaited<ReturnType<typeof api.getWorkload>>[number];
// Above this many open tasks a person is flagged as stretched
const BUSY = 8;

// Who carries how much: open and overdue tasks, estimated hours left, hours logged this week
export function WorkloadPanel() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getWorkload()
      .then((r) => setRows([...r].sort((a, b) => b.openTasks - a.openTasks)))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the workload"));
  }, []);

  if (error) return <div role="alert" className="card p-8 text-red-600">{error}</div>;
  if (!rows) return <div className="card p-8 text-slate-500">Loading workload…</div>;

  const max = Math.max(1, ...rows.map((r) => r.openTasks));
  return (
    <div className="card overflow-hidden" aria-label="Workload">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              {["Person", "Open tasks", "Overdue", "Hours estimated", "Logged this week"].map((h) => (
                <th key={h} className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.userId} data-workload={r.fullName} onClick={() => navigate(`/tasks?person=${r.userId}&status=Pending`)} className="cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.fullName} src={r.avatarUrl ?? undefined} className="w-9 h-9 rounded-full" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{r.fullName}</p>
                      {r.title && <p className="text-xs text-slate-500 dark:text-slate-400">{r.title}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 min-w-[200px]">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className={`h-full ${r.openTasks > BUSY ? "bg-red-500" : "bg-indigo-500"}`} style={{ width: `${(r.openTasks / max) * 100}%` }} />
                    </div>
                    <span className={`w-6 text-right font-bold ${r.openTasks > BUSY ? "text-red-600" : "text-slate-900 dark:text-white"}`}>{r.openTasks}</span>
                  </div>
                </td>
                <td className={`px-6 py-4 font-bold ${r.overdueTasks ? "text-red-600 dark:text-red-400" : "text-slate-400"}`}>{r.overdueTasks}</td>
                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{Math.round(r.estimatedHours * 10) / 10}h</td>
                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{Math.round(r.loggedHoursThisWeek * 10) / 10}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="p-10 text-center text-slate-500">No active team members yet.</p>}
      <p className="px-6 py-3 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
        Open tasks are everything not completed. More than {BUSY} shows in red. Click a person to see their tasks.
      </p>
    </div>
  );
}
