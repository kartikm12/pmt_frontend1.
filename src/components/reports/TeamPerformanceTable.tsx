import { Trophy } from "lucide-react";
import { createAvatar } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";

interface TeamPerformanceTableProps {
  data: {
    user: any; // RawUser from backend
    completed: number;
    inProgress: number;
    total: number;
  }[];
}

export function TeamPerformanceTable({ data }: TeamPerformanceTableProps) {
  return (
    <div className="card p-8 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
          <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Team Performance</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Top performers by completed tasks</p>
        </div>
      </div>
      
      <div className="flex-grow overflow-auto">
        {data.length > 0 ? (
          <div className="space-y-4">
            {data.map((item, index) => (
              <div key={item.user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-400 dark:bg-slate-800">
                    #{index + 1}
                  </div>
                  <Avatar name={item.user.fullName} src={createAvatar(item.user.fullName, item.user.avatarUrl)} className="w-10 h-10 rounded-xl border-2 border-white dark:border-slate-800 shadow-md object-cover bg-white" />
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">{item.user.fullName}</h4>
                    <p className="text-xs text-slate-500">{item.completed} completed • {item.inProgress} in progress</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    {item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0}% done
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500">No performance data available</div>
        )}
      </div>
    </div>
  );
}
