import { CalendarDays } from "lucide-react";
import { parseISO, format, differenceInDays } from "date-fns";

interface GanttTimelineProps {
  data: {
    name: string;
    completed: number;
    pending: number;
    total: number;
  }[];
}

// A simple simulated Gantt Timeline using CSS grid, showing project magnitude and progress dynamically.
// Note: In MVP, it leverages the project progress dataset as mock dates/durations based on task sizes.
export function GanttTimeline({ data }: GanttTimelineProps) {
  return (
    <div className="card p-6 overflow-x-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
          <CalendarDays className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Project Timeline Overview</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Simplified progress scope</p>
        </div>
      </div>

      <div className="min-w-[600px]">
        {data.length > 0 ? (
          <div className="space-y-4">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="col-span-3">Project</div>
              <div className="col-span-9 flex justify-between">
                <span>Start</span>
                <span>Current Progress</span>
                <span>Target</span>
              </div>
            </div>

            {/* Timelines */}
            {data.map((p, i) => {
              const total = p.total || 1;
              const ratio = p.completed / total;
              const percent = Math.round(ratio * 100);
              
              // We'll deterministically style colors based on index
              const colors = ["bg-indigo-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500", "bg-rose-500", "bg-blue-500"];
              const bg = colors[i % colors.length];

              return (
                <div key={p.name} className="grid grid-cols-12 gap-4 items-center group">
                  <div className="col-span-3 truncate text-sm font-semibold text-slate-700 dark:text-slate-200" title={p.name}>
                    {p.name}
                  </div>
                  <div className="col-span-9">
                    <div className="relative h-6 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden w-full">
                      <div 
                        className={`absolute top-0 left-0 h-full ${bg} transition-all duration-1000 ease-in-out`}
                        style={{ width: `${percent}%` }}
                      >
                         <div className="absolute inset-0 bg-white/20" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
                      </div>
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] font-bold text-slate-400">
                      <span>{p.completed} Done</span>
                      <span className="text-slate-500 dark:text-slate-300">{percent}%</span>
                      <span>{p.total} Total</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-slate-500">No active projects to map</div>
        )}
      </div>
    </div>
  );
}
