import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  MoreHorizontal,
  Layers,
  ClipboardList
} from "lucide-react";
import { isValid } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Project, Task, User } from "@/lib/api-types";
import { safeFormat, isOverdue } from "@/utils/dateUtils";
import { useSocket } from "@/context/SocketContext";
import { Avatar } from "@/components/ui/Avatar";
import { PageLoader } from "@/components/ui/PageLoader";

export function Dashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    activeProjects: number;
    totalProjects: number;
    pendingProjects: number;
    completedProjects: number;
    totalTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    completedTasks: number;
  } | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<Task[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [statsData, teamData, allProjects] = await Promise.all([
          api.getDashboardStats(),
          api.getTeam(),
          api.getProjects()
        ]);

        setStats(statsData.stats);
        setRecentTasks(statsData.recentTasks.map(api.mapTask));
        setUpcomingDeadlines(statsData.upcomingDeadlines.map(api.mapTask));
        setUsers(teamData);
        setProjects(allProjects);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load dashboard");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const { socket } = useSocket();

  useEffect(() => {
    if (socket) {
      const handleProjectUpdated = (data: any) => {
        const updatedProject = data.members ? api.mapProject(data) : (data as Project);
        setProjects((prev) => 
          prev.map((p) => 
            p.id === updatedProject.id 
              ? { ...p, ...updatedProject } 
              : p
          )
        );
      };

      socket.on("project_updated", handleProjectUpdated);

      return () => {
        socket.off("project_updated", handleProjectUpdated);
      };
    }
  }, [socket]);

  const [projects, setProjects] = useState<Project[]>([]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Here's what's happening with your projects today.</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <StatCard 
            title="Total Projects" 
            value={stats?.totalProjects.toString() ?? "0"} 
            icon={Layers} 
            onIconClick={() => navigate("/projects")}
          />
          <StatCard 
            title="Active Projects" 
            value={stats?.activeProjects.toString() ?? "0"} 
            icon={ArrowUpRight} 
            onIconClick={() => navigate("/projects?status=Active")}
          />
          <StatCard 
            title="Pending Projects" 
            value={stats?.pendingProjects.toString() ?? "0"} 
            icon={Clock} 
            onIconClick={() => navigate("/projects?status=Pending")}
          />
          <StatCard 
            title="Completed Projects" 
            value={stats?.completedProjects.toString() ?? "0"} 
            icon={CheckCircle2} 
            onIconClick={() => navigate("/projects?status=Completed")}
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <StatCard 
            title="Total Tasks" 
            value={stats?.totalTasks.toString() ?? "0"} 
            icon={ClipboardList} 
            onIconClick={() => navigate("/tasks")}
          />
          <StatCard 
            title="Pending Tasks" 
            value={stats?.pendingTasks.toString() ?? "0"} 
            icon={Clock} 
            onIconClick={() => navigate("/tasks?status=Pending")}
          />
          <StatCard
            title="Overdue Tasks"
            value={stats?.overdueTasks.toString() ?? "0"}
            icon={AlertCircle}
            trend="Needs attention"
            alert
            onIconClick={() => navigate("/tasks?status=Overdue")}
          />
          <StatCard 
            title="Completed Tasks" 
            value={stats?.completedTasks.toString() ?? "0"} 
            icon={CheckCircle2} 
            onIconClick={() => navigate("/tasks?status=Completed")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Projects Hub</h2>
              <Link to="/projects" className="text-sm text-indigo-600 dark:text-indigo-400 font-bold hover:underline underline-offset-4 py-1">
                View all
              </Link>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoading ? (
                <PageLoader compact />
              ) : (
                projects.slice(0, 5).map((project) => (
                  <div
                    key={project.id}
                    className="p-6 flex items-center justify-between hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <div>
                      <div className={`text-sm font-medium transition-colors ${
                        !["Completed", "Cancelled", "On Hold"].includes(project.status) && isOverdue(project.dueDate)
                          ? "text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300"
                          : "text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                      }`}>
                        {project.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-2">
                        {project.teamMemberIds.slice(0, 4).map((id) => {
                          const user = users.find((member) => member.id === id);
                          return user ? (
                            <Avatar key={id} name={user.name} src={user.avatar} className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-900" />
                          ) : null;
                        })}
                      </div>
                      <span
                        className={`inline-flex items-center justify-center w-24 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                          project.status === "Active"
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                            : project.status === "Completed"
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {project.status}
                      </span>

                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Upcoming Deadlines</h2>
              <Link to="/tasks" className="text-sm text-indigo-600 dark:text-indigo-400 font-bold hover:underline underline-offset-4 py-1">
                View all
              </Link>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {upcomingDeadlines.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/tasks/${task.id}`)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium transition-colors truncate ${
                          task.status === "Completed"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : isOverdue(task.dueDate)
                              ? "text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300"
                              : "text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                        }`}>
                          {task.title}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Due {safeFormat(task.dueDate, "MMM d, yyyy")}</p>
                      </div>
                      <span
                        className={`inline-flex items-center justify-center w-16 py-0.5 rounded text-xs font-medium shrink-0 ${
                          task.priority === "Urgent"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                            : task.priority === "High"
                              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400"
                              : "bg-slate-100 dark:bg-slate-800 text-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  alert, 
  onIconClick 
}: { 
  title: string; 
  value: string; 
  icon: any; 
  trend?: string; 
  alert?: boolean;
  onIconClick?: () => void;
}) {
  return (
    <div className="card p-4 sm:p-6 group">
      <div className="flex items-center justify-between relative z-10">
        <p className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider uppercase leading-snug">{title}</p>
        <button 
          onClick={onIconClick}
          className={`p-2 rounded-lg transition-all hover:scale-110 active:scale-95 ${
            alert 
              ? "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20" 
              : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
          }`}
          title={`View ${title}`}
        >
          <Icon className="w-5 h-5" />
        </button>
      </div>
      <div className="mt-4 relative z-10">
        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{value}</h3>
        {trend && <p className={`text-xs mt-1 font-medium ${alert ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}>{trend}</p>}
      </div>
    </div>
  );
}
