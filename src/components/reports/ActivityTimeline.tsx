import { Activity, MessageSquare, CheckSquare, Upload, PlusSquare, Edit, AlertCircle } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

interface ActivityTimelineProps {
  data: any[];
}

export function ActivityTimeline({ data }: ActivityTimelineProps) {
  const getIconAndColor = (type: string) => {
    const t = type.toUpperCase();
    if (t.includes("COMMENT")) return { icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30", dot: "bg-blue-500" };
    if (t.includes("DONE") || t.includes("COMPLETED")) return { icon: CheckSquare, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30", dot: "bg-emerald-500" };
    if (t.includes("ATTACHMENT") || t.includes("FILE")) return { icon: Upload, color: "text-indigo-500", bg: "bg-indigo-100 dark:bg-indigo-900/30", dot: "bg-indigo-500" };
    if (t.includes("CREATE")) return { icon: PlusSquare, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/30", dot: "bg-purple-500" };
    if (t.includes("UPDATE")) return { icon: Edit, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30", dot: "bg-amber-500" };
    return { icon: Activity, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800", dot: "bg-slate-400" };
  };

  return (
    <div className="card p-8 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
          <Activity className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Recent Activity</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Latest actions across all projects</p>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto pl-4">
        {data.length > 0 ? (
          <div className="relative border-l-2 border-slate-100 dark:border-slate-800 space-y-6 pb-4">
            {data.map((item) => {
              const { icon: Icon, color, dot } = getIconAndColor(item.action);
              return (
                <div key={item.id} className="relative pl-6">
                  <span className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ring-4 ring-white dark:ring-[#0f172a] ${dot}`} />
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {item.user?.fullName || "System"}
                    </p>
                    <time className="text-xs font-medium text-slate-400 whitespace-nowrap">
                      {item.createdAt ? formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true }) : ''}
                    </time>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 border border-slate-100 dark:bg-slate-800/30 dark:border-slate-800 rounded-lg p-3 inline-block">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500">No recent activity</div>
        )}
      </div>
    </div>
  );
}
