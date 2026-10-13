import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, FolderKanban, User as UserIcon } from "lucide-react";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Milestone, Project, Task, User } from "@/lib/api-types";
import { deadlineError, safeFormat } from "@/utils/dateUtils";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";
import { PageLoader } from "@/components/ui/PageLoader";

const STATUS_DOT: Record<string, string> = {
  "To Do": "bg-slate-400",
  "In Progress": "bg-amber-400",
  Review: "bg-sky-500",
  Completed: "bg-emerald-500"
};
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_PER_DAY = 3;

// Month view of task deadlines and milestones; project managers drag a task to another day to move its deadline
export function Calendar() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { socket } = useSocket();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Array<Milestone & { projectId: string; projectName: string }>>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projectFilter, setProjectFilter] = useState("All");
  const [personFilter, setPersonFilter] = useState("All");
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Milestones are extra: the calendar still works if they fail to load
    Promise.all([api.getTasks(), api.getProjects(), api.getTeam(), api.getMilestones().catch(() => [])])
      .then(([t, p, u, m]) => {
        setTasks(t);
        setProjects(p);
        setUsers(u);
        setMilestones(m);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't load the calendar"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!socket) return;
    const refresh = (data: { taskId: string }) => {
      api.getTask(data.taskId).then((full) => setTasks((prev) => (prev.some((t) => t.id === full.id) ? prev.map((t) => (t.id === full.id ? full : t)) : [...prev, full]))).catch(() => undefined);
    };
    const remove = (data: { taskId: string }) => setTasks((prev) => prev.filter((t) => t.id !== data.taskId));
    socket.on("task_created", refresh);
    socket.on("task_updated", refresh);
    socket.on("task_deleted", remove);
    return () => {
      socket.off("task_created", refresh);
      socket.off("task_updated", refresh);
      socket.off("task_deleted", remove);
    };
  }, [socket]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const list: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) list.push(d);
    return list;
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      if (projectFilter !== "All" && t.projectId !== projectFilter) continue;
      if (personFilter !== "All" && !t.assigneeIds.includes(personFilter)) continue;
      const key = safeFormat(t.dueDate, "yyyy-MM-dd", "");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tasks, projectFilter, personFilter]);

  const milestonesByDay = useMemo(() => {
    const map = new Map<string, Array<Milestone & { projectId: string; projectName: string }>>();
    for (const m of milestones) {
      if (!m.dueDate || (projectFilter !== "All" && m.projectId !== projectFilter)) continue;
      const key = safeFormat(m.dueDate, "yyyy-MM-dd", "");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [milestones, projectFilter]);

  const moveTask = async (taskId: string, dayKey: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || safeFormat(task.dueDate, "yyyy-MM-dd", "") === dayKey) return;
    if (task.myRole !== "manager") {
      toast.error("Only a project manager can change this deadline.");
      return;
    }
    const error = deadlineError(dayKey, task.dueDate);
    if (error) {
      toast.error(error);
      return;
    }
    const before = tasks;
    const dueDate = new Date(dayKey).toISOString();
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, dueDate } : t)));
    try {
      const updated = await api.updateTask(taskId, { dueDate });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      toast.success(`"${task.title}" now due ${format(new Date(dayKey), "MMM d")}`);
    } catch (e) {
      setTasks(before);
      toast.error(e instanceof Error ? e.message : "Couldn't move the deadline");
    }
  };

  const todayKey = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center gap-3 card p-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mr-2">Calendar</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="min-w-[140px] text-center font-bold text-slate-900 dark:text-white" aria-live="polite">{format(month, "MMMM yyyy")}</span>
          <button onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={() => setMonth(startOfMonth(new Date()))} className="btn-secondary px-3 py-1.5 text-xs font-bold ml-1">Today</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <button
            onClick={() => setPersonFilter(personFilter === currentUser?.id ? "All" : currentUser?.id ?? "All")}
            aria-pressed={personFilter === currentUser?.id}
            className={`px-4 py-2 rounded-xl text-sm font-bold border ${personFilter === currentUser?.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}
          >
            My tasks
          </button>
          <div className="min-w-[180px]">
            <SingleSelectDropdown options={[{ id: "All", name: "All projects" }, ...projects.map((p) => ({ id: p.id, name: p.name }))]} selectedId={projectFilter} onChange={setProjectFilter} Icon={FolderKanban} variant="default" />
          </div>
          <div className="min-w-[180px]">
            <SingleSelectDropdown options={[{ id: "All", name: "Everyone" }, ...users.map((u) => ({ id: u.id, name: u.name }))]} selectedId={personFilter} onChange={setPersonFilter} Icon={UserIcon} variant="default" />
          </div>
        </div>
      </div>

      {isLoading ? <div className="card"><PageLoader /></div> : (
      <div className="card p-2 sm:p-4 overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => <div key={d} className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 rounded-xl overflow-hidden" aria-busy={isLoading}>
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayTasks = byDay.get(key) ?? [];
              const dayMilestones = milestonesByDay.get(key) ?? [];
              const expanded = expandedDay === key;
              const shown = expanded ? dayTasks : dayTasks.slice(0, MAX_PER_DAY);
              return (
                <div
                  key={key}
                  data-day={key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverDay(key);
                  }}
                  onDragLeave={() => setDragOverDay((d) => (d === key ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverDay(null);
                    const id = e.dataTransfer.getData("text/task-id");
                    if (id) void moveTask(id, key);
                  }}
                  className={`min-h-[112px] p-1.5 flex flex-col gap-1 ${isSameMonth(day, month) ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-900/60"} ${dragOverDay === key ? "ring-2 ring-inset ring-indigo-400" : ""}`}
                >
                  <span className={`text-xs font-bold self-end w-6 h-6 flex items-center justify-center rounded-full ${key === todayKey ? "bg-indigo-600 text-white" : isSameMonth(day, month) ? "text-slate-700 dark:text-slate-300" : "text-slate-400"}`}>
                    {format(day, "d")}
                  </span>
                  {dayMilestones.map((m) => (
                    <button key={m.id} onClick={() => navigate(`/projects/${m.projectId}`)} title={`${m.projectName}: ${m.name}`} className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 truncate text-left">
                      <span className="w-2 h-2 rotate-45 bg-amber-500 shrink-0" />
                      <span className="truncate">{m.name}</span>
                    </button>
                  ))}
                  {shown.map((t) => (
                    <button
                      key={t.id}
                      draggable={t.myRole === "manager"}
                      onDragStart={(e) => e.dataTransfer.setData("text/task-id", t.id)}
                      onClick={() => navigate(`/tasks/${t.id}`)}
                      title={`${t.title} · ${t.project?.name ?? ""} · ${t.status}`}
                      data-task={t.title}
                      className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[11px] font-semibold text-left bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 ${t.status === "Completed" ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"} ${t.myRole === "manager" ? "cursor-grab" : ""}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[t.status] ?? "bg-slate-400"}`} />
                      <span className="truncate">{t.title}</span>
                    </button>
                  ))}
                  {dayTasks.length > MAX_PER_DAY && (
                    <button onClick={() => setExpandedDay(expanded ? null : key)} className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 text-left px-1.5">
                      {expanded ? "Show less" : `+${dayTasks.length - MAX_PER_DAY} more`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 px-1">Drag a task to another day to move its deadline (project managers only).</p>
        </div>
      </div>
      )}
    </div>
  );
}
