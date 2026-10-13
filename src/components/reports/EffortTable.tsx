import { Timer } from "lucide-react";

type Row = { name: string; total: number; completed: number; estimatedHours?: number; loggedHours?: number };

// Estimated hours against hours actually logged, per project
export function EffortTable({ data }: { data: Row[] }) {
  const rows = data.filter((r) => (r.estimatedHours ?? 0) > 0 || (r.loggedHours ?? 0) > 0);
  return (
    <div className="card p-8" aria-label="Estimated vs logged hours">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
          <Timer className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Estimated vs logged hours</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Red means more time went in than planned</p>
        </div>
      </div>
      {!rows.length ? (
        <p className="text-sm text-slate-500 py-6 text-center">No estimates or logged time yet. Add an estimate to a task, then log hours on it.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const est = r.estimatedHours ?? 0;
            const logged = r.loggedHours ?? 0;
            const over = est > 0 && logged > est;
            const scale = Math.max(est, logged, 1);
            return (
              <div key={r.name} data-effort={r.name}>
                <div className="flex items-baseline justify-between text-sm mb-1.5">
                  <span className="font-bold text-slate-900 dark:text-white truncate">{r.name}</span>
                  <span className={`font-semibold ${over ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>
                    {logged}h of {est}h
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" title={`Estimated ${est}h`}>
                    <div className="h-full bg-slate-400" style={{ width: `${(est / scale) * 100}%` }} />
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" title={`Logged ${logged}h`}>
                    <div className={`h-full ${over ? "bg-red-500" : "bg-indigo-500"}`} style={{ width: `${(logged / scale) * 100}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
          <div className="flex gap-4 text-[11px] text-slate-500 pt-2">
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-slate-400" />Estimated</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-indigo-500" />Logged</span>
          </div>
        </div>
      )}
    </div>
  );
}
