import { Folder, CheckCircle, Clock, AlertTriangle } from "lucide-react";

interface KPIOverviewProps {
  data: {
    activeProjects: number;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
  };
}

export function KPIOverview({ data }: KPIOverviewProps) {
  const kpis = [
    { label: "Active Projects", value: data.activeProjects, icon: Folder, color: "text-indigo-600", bg: "bg-indigo-100" },
    { label: "Completed Tasks", value: data.completedTasks, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100" },
    { label: "Pending Tasks", value: data.pendingTasks, icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
    { label: "Overdue Tasks", value: data.overdueTasks, icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-100" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, i) => (
        <div key={i} className="card p-6 flex items-center gap-4 hover:shadow-lg transition-shadow">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${kpi.bg} dark:bg-opacity-20`}>
            <kpi.icon className={`w-7 h-7 ${kpi.color}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{kpi.label}</p>
            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{kpi.value}</h3>
          </div>
        </div>
      ))}
    </div>
  );
}
