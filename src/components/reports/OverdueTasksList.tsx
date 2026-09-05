import { AlertCircle, Clock, CheckCircle } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { createAvatar } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";

interface OverdueTasksListProps {
  data: {
    id: string;
    title: string;
    dueDate: string;
    priority: string;
    assignees: any[];
  }[];
}

export function OverdueTasksList({ data }: OverdueTasksListProps) {
  const getDelayText = (dueDateStr: string) => {
    try {
      const date = parseISO(dueDateStr);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "Past due";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT": return "text-rose-600 bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400";
      case "HIGH": return "text-amber-600 bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400";
      default: return "text-slate-600 bg-slate-100 dark:bg-slate-500/10 dark:text-slate-400";
    }
  };

  return (
    <div className="card p-8 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Overdue Tasks</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Tasks requiring immediate attention</p>
        </div>
      </div>

      <div className="flex-grow overflow-auto">
        {data.length > 0 ? (
          <div className="space-y-3">
            {data.map((task) => (
              <div key={task.id} className="p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/10">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white line-clamp-1">{task.title}</h4>
                    <div className="flex items-center gap-2 mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                      <Clock className="w-3.5 h-3.5" />
                      {getDelayText(task.dueDate)}
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-bold ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </div>
                </div>
                {task.assignees && task.assignees.length > 0 && (
                  <div className="mt-3 flex -space-x-2">
                    {task.assignees.map((assignee: any, i: number) => (
                      <Avatar key={i} name={assignee.fullName} src={createAvatar(assignee.fullName, assignee.avatarUrl)} className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 shadow-sm object-cover bg-white" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-emerald-500 space-y-2 py-8">
            <CheckCircle className="w-8 h-8 opacity-50" />
            <p className="font-medium">No overdue tasks!</p>
          </div>
        )}
      </div>
    </div>
  );
}

