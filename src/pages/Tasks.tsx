import React, { useEffect, useMemo, useState } from "react";
import { Clock, MoreHorizontal, Filter, ArrowUpDown, Search, ClipboardList, Plus, X, Download, FolderKanban, User as UserIcon, Tag, CheckSquare } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AddTaskModal } from "@/components/AddTaskModal";
import { api } from "@/lib/api";
import type { Project, Task, TaskPriority, TaskStatus, User } from "@/lib/api-types";
import { safeFormat, isOverdue, deadlineError } from "@/utils/dateUtils";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LabelChip } from "@/components/ui/LabelChip";
import { emptyPlanning, planningError, planningFromTask, planningToPayload, type PlanningState } from "@/lib/planning";
import { downloadCsv } from "@/lib/csv";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { PageLoader } from "@/components/ui/PageLoader";

const STATUSES: TaskStatus[] = ["To Do", "In Progress", "Review", "Completed"];

export function Tasks() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") || "All";
  const { currentUser } = useAuth();
  const { socket } = useSocket();
  const isManager = ["Manager", "Project Manager", "Admin"].includes(currentUser?.role ?? "");
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>("Medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>("To Do");
  const [newTaskAssigneeIds, setNewTaskAssigneeIds] = useState<string[]>([]);
  const [newTaskProjectId, setNewTaskProjectId] = useState("");
  const [formError, setFormError] = useState("");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [planning, setPlanning] = useState<PlanningState>(emptyPlanning);
  const [projectFilter, setProjectFilter] = useState(searchParams.get("project") || "All");
  const [personFilter, setPersonFilter] = useState(searchParams.get("person") || (searchParams.get("mine") ? currentUser?.id ?? "All" : "All"));
  const [labelFilter, setLabelFilter] = useState("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const wide = useMediaQuery("(min-width: 768px)");

  // Close the row menu on any outside click (its own buttons stop propagation)
  useEffect(() => {
    if (!activeMenu) return;
    const close = () => setActiveMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [activeMenu]);

  useEffect(() => {
    async function load() {
      try {
        const [tasksData, projectsData, teamData] = await Promise.all([api.getTasks(), api.getProjects(), api.getTeam()]);
        setAllTasks(tasksData);
        setProjects(projectsData);
        setUsers(teamData);
        setNewTaskProjectId("");
        setNewTaskAssigneeIds([]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load tasks");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    if (socket) {
      const handleTaskCreated = (data: any) => {
        api.getTask(data.taskId).then(fullTask => {
          setAllTasks(prev => {
            if (prev.some(t => t.id === fullTask.id)) return prev;
            return [fullTask, ...prev];
          });
        });
      };

      const handleTaskUpdated = (data: any) => {
        api.getTask(data.taskId).then(fullTask => {
          setAllTasks(prev => prev.map(t => t.id === fullTask.id ? fullTask : t));
        });
      };

      const handleTaskDeleted = (data: any) => {
        setAllTasks(prev => prev.filter(t => t.id !== data.taskId));
      };

      socket.on("task_created", handleTaskCreated);
      socket.on("task_updated", handleTaskUpdated);
      socket.on("task_deleted", handleTaskDeleted);

      return () => {
        socket.off("task_created", handleTaskCreated);
        socket.off("task_updated", handleTaskUpdated);
        socket.off("task_deleted", handleTaskDeleted);
      };
    }
  }, [socket]);

  const openModal = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setNewTaskTitle(task.title);
      setNewTaskDescription(task.description);
      setNewTaskPriority(task.priority);
      setNewTaskDueDate(safeFormat(task.dueDate, "yyyy-MM-dd"));
      setNewTaskStatus(task.status);
      setNewTaskAssigneeIds(task.assigneeIds || []);
      setNewTaskProjectId(task.projectId);
      setPlanning(planningFromTask(task));
    } else {
      setEditingTask(null);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("Medium");
      setNewTaskDueDate(safeFormat(new Date().toISOString(), "yyyy-MM-dd"));
      setNewTaskStatus("To Do");
      setNewTaskAssigneeIds([]);
      setNewTaskProjectId("");
      setPlanning(emptyPlanning);
    }
    setFormError("");
    setIsModalOpen(true);
  };

  const taskFormError = () => {
    if (!editingTask && !newTaskProjectId) return "Please select a project.";
    if (!newTaskTitle.trim() || !newTaskDescription.trim()) return "All task fields are required.";
    if (!newTaskAssigneeIds.length) return "Please assign at least one team member.";
    return deadlineError(newTaskDueDate, editingTask?.dueDate) ?? planningError(planning, newTaskDueDate);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    // A status-only update has nothing else to validate
    const managesEdited = editingTask?.myRole === "manager";
    const validationError = editingTask && !managesEdited ? null : taskFormError();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      if (editingTask) {
        const payload = managesEdited
          ? {
              ...planningToPayload(planning),
              title: newTaskTitle,
              description: newTaskDescription,
              priority: newTaskPriority,
              status: newTaskStatus,
              dueDate: new Date(newTaskDueDate).toISOString(),
              projectId: newTaskProjectId,
              assigneeIds: newTaskAssigneeIds
            }
          : { status: newTaskStatus };
        const updated = await api.updateTask(editingTask.id, payload);
        setAllTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
        toast.success(managesEdited ? "Task updated successfully!" : "Task status updated!");
      } else {
        const created = await api.createTask({
          ...planningToPayload(planning),
          title: newTaskTitle,
          description: newTaskDescription,
          priority: newTaskPriority,
          status: newTaskStatus,
          dueDate: new Date(newTaskDueDate).toISOString(),
          assigneeIds: newTaskAssigneeIds,
          projectId: newTaskProjectId
        });
        setAllTasks((prev) => [created, ...prev]);
        toast.success("Task created successfully!");
      }

      setIsModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save task");
    }
  };

  const filteredTasks = useMemo(() => {
    return allTasks
      .filter((task) => {
        const matchesSearch =
          task.title.toLowerCase().includes(activeSearchQuery.toLowerCase()) ||
          task.description.toLowerCase().includes(activeSearchQuery.toLowerCase());
        
        let matchesStatus = statusFilter === "All" || task.status === statusFilter;
        
        // Handle special Dashboard navigation filters
        if (statusFilter === "Pending") {
          matchesStatus = task.status !== "Completed";
        } else if (statusFilter === "Overdue") {
          matchesStatus = task.status !== "Completed" && isOverdue(task.dueDate);
        }

        const matchesPriority = priorityFilter === "All" || task.priority === priorityFilter;
        const matchesProject = projectFilter === "All" || task.projectId === projectFilter;
        const matchesPerson = personFilter === "All" || task.assigneeIds.includes(personFilter);
        const matchesLabel = labelFilter === "All" || task.labels.includes(labelFilter);
        return matchesSearch && matchesStatus && matchesPriority && matchesProject && matchesPerson && matchesLabel;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [activeSearchQuery, statusFilter, priorityFilter, projectFilter, personFilter, labelFilter, allTasks]);

  const allLabels = useMemo(() => [...new Set(allTasks.flatMap((t) => t.labels))].sort(), [allTasks]);
  const mine = !!currentUser && personFilter === currentUser.id;
  // New tasks need the manager role in some project; the server checks the chosen one
  const canCreate = isManager || allTasks.some((t) => t.myRole === "manager");

  // Selection only keeps rows that are still on screen
  const visibleSelected = filteredTasks.filter((t) => selected.has(t.id));
  const allVisibleSelected = filteredTasks.length > 0 && visibleSelected.length === filteredTasks.length;
  const toggleRow = (taskId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });

  // Runs one change per selected task; tasks you lack the role for are skipped and counted
  const runBulk = async (label: string, allowed: (t: Task) => boolean, action: (t: Task) => Promise<unknown>) => {
    const targets = visibleSelected.filter(allowed);
    const skipped = visibleSelected.length - targets.length;
    if (!targets.length) {
      toast.error("You don't have permission to do that on the selected tasks.");
      return;
    }
    setBulkBusy(true);
    const results = await Promise.allSettled(targets.map(action));
    setBulkBusy(false);
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    const ok = targets.length - failed.length;
    if (ok) toast.success(`${label}: ${ok} task${ok === 1 ? "" : "s"}`);
    if (failed.length) toast.error(`${failed.length} failed: ${failed[0].reason instanceof Error ? failed[0].reason.message : "unknown error"}`);
    if (skipped) toast.info(`${skipped} skipped: you can't change ${skipped === 1 ? "that task" : "those tasks"}`);
    setSelected(new Set());
  };

  const bulkStatus = (status: TaskStatus) =>
    runBulk(`Moved to ${status}`, (t) => !!t.myRole && t.myRole !== "viewer", async (t) => {
      const updated = await api.updateTask(t.id, { status });
      setAllTasks((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    });

  const bulkAssign = (userId: string) => {
    const name = users.find((u) => u.id === userId)?.name ?? "person";
    return runBulk(`Assigned ${name}`, (t) => t.myRole === "manager", async (t) => {
      if (t.assigneeIds.includes(userId)) return;
      const updated = await api.updateTask(t.id, { assigneeIds: [...t.assigneeIds, userId] });
      setAllTasks((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    });
  };

  const bulkDelete = () => {
    setConfirmBulkDelete(false);
    return runBulk("Deleted", (t) => t.myRole === "manager", async (t) => {
      await api.deleteTask(t.id);
      setAllTasks((prev) => prev.filter((x) => x.id !== t.id));
    });
  };

  const exportCsv = () => {
    const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "";
    downloadCsv(`tasks-${safeFormat(new Date().toISOString(), "yyyy-MM-dd")}.csv`, [
      ["Title", "Project", "Status", "Priority", "Due date", "Assignees", "Labels", "Estimate (h)", "Checklist", "Description"],
      ...filteredTasks.map((t) => [
        t.title,
        t.project?.name ?? projects.find((p) => p.id === t.projectId)?.name,
        t.status,
        t.priority,
        safeFormat(t.dueDate, "yyyy-MM-dd", ""),
        t.assigneeIds.map(nameOf).join("; "),
        t.labels.join("; "),
        t.estimateHours,
        t.subtaskTotal ? `${t.subtaskDone}/${t.subtaskTotal}` : "",
        t.description
      ])
    ]);
  };

  const handleSearch = () => {
    setActiveSearchQuery(searchQuery);
  };

  const deleteTask = async () => {
    if (!taskToDelete) return;

    try {
      await api.deleteTask(taskToDelete);
      setAllTasks((prev) => prev.filter((task) => task.id !== taskToDelete));
      toast.success("Task moved to Recently deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete task");
    } finally {
      setTaskToDelete(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4 card p-4 sm:p-6">
        <div className="flex items-center justify-between xl:justify-start gap-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight whitespace-nowrap">Tasks</h1>
          {canCreate && (
            <button onClick={() => openModal()} className="xl:hidden flex items-center gap-2 btn-primary px-3 py-1.5 text-xs whitespace-nowrap shrink-0">
              <Plus className="w-3.5 h-3.5" />
              New Task
            </button>
          )}
        </div>

        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input type="text" placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="w-full pl-10 pr-4 py-2 input text-sm focus:outline-none transition-all dark:text-zinc-100" />
          </div>
          <button onClick={handleSearch} className="btn-primary px-4 py-2">
            Search
          </button>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <div className="relative min-w-0 sm:min-w-[160px]">
              <SingleSelectDropdown ariaLabel="Status" 
                options={[
                  { id: "All", name: "All Statuses" },
                  { id: "Pending", name: "Pending" },
                  { id: "Overdue", name: "Overdue" },
                  { id: "To Do", name: "To Do" },
                  { id: "In Progress", name: "In Progress" },
                  { id: "Review", name: "Review" },
                  { id: "Completed", name: "Completed" },
                ]}
                selectedId={statusFilter} 
                onChange={(id) => {
                  setStatusFilter(id);
                  setSearchParams({ status: id });
                }}
                Icon={Filter}
                variant="default"
              />
            </div>

            <div className="relative min-w-0 sm:min-w-[160px]">
              <SingleSelectDropdown ariaLabel="Priority" 
                options={[
                  { id: "All", name: "All Priorities" },
                  { id: "Urgent", name: "Urgent" },
                  { id: "High", name: "High" },
                  { id: "Medium", name: "Medium" },
                  { id: "Low", name: "Low" },
                ]}
                selectedId={priorityFilter} 
                onChange={(id) => setPriorityFilter(id)}
                Icon={ArrowUpDown}
                variant="default"
              />
            </div>
          </div>
        </div>

        {canCreate && (
          <button onClick={() => openModal()} className="hidden xl:flex items-center gap-2 btn-primary px-4 py-2 whitespace-nowrap shrink-0">
            <Plus className="w-4 h-4" />
            New Task
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 -mt-4">
        <button
          onClick={() => setPersonFilter(mine ? "All" : currentUser?.id ?? "All")}
          aria-pressed={mine}
          className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${mine ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}
        >
          My tasks
        </button>
        <div className="min-w-[180px]">
          <SingleSelectDropdown ariaLabel="Project"
            options={[{ id: "All", name: "All projects" }, ...projects.map((p) => ({ id: p.id, name: p.name }))]}
            selectedId={projectFilter}
            onChange={setProjectFilter}
            Icon={FolderKanban}
            variant="default"
          />
        </div>
        <div className="min-w-[180px]">
          <SingleSelectDropdown ariaLabel="Person"
            options={[{ id: "All", name: "Everyone" }, ...users.map((u) => ({ id: u.id, name: u.name }))]}
            selectedId={personFilter}
            onChange={setPersonFilter}
            Icon={UserIcon}
            variant="default"
          />
        </div>
        {allLabels.length > 0 && (
          <div className="min-w-[160px]">
            <SingleSelectDropdown ariaLabel="Label"
              options={[{ id: "All", name: "All labels" }, ...allLabels.map((l) => ({ id: l, name: l }))]}
              selectedId={labelFilter}
              onChange={setLabelFilter}
              Icon={Tag}
              variant="default"
            />
          </div>
        )}
        <button onClick={exportCsv} disabled={!filteredTasks.length} className="ml-auto btn-secondary px-4 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-50">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {visibleSelected.length > 0 && (
        <div role="toolbar" aria-label="Bulk actions" className="sticky top-2 z-20 flex flex-wrap items-center gap-3 card px-5 py-3 border-indigo-200 dark:border-indigo-900">
          <span className="text-sm font-bold text-slate-900 dark:text-white">{visibleSelected.length} selected</span>
          {/* Act-on-pick menus: the choice runs at once and the menu goes back to its prompt */}
          <div className="w-40">
            <SingleSelectDropdown
              ariaLabel="Set status of selected tasks"
              placeholder="Set status…"
              options={STATUSES.map((s) => ({ id: s, name: s }))}
              selectedId=""
              disabled={bulkBusy}
              onChange={(s) => s && void bulkStatus(s as TaskStatus)}
            />
          </div>
          <div className="w-48">
            <SingleSelectDropdown
              ariaLabel="Assign selected tasks to"
              placeholder="Assign to…"
              options={users.filter((u) => u.status !== "Suspended").map((u) => ({ id: u.id, name: u.name }))}
              selectedId=""
              disabled={bulkBusy}
              onChange={(id) => id && void bulkAssign(id)}
            />
          </div>
          <button
            onClick={() => setConfirmBulkDelete(true)}
            disabled={bulkBusy}
            className="px-4 py-2 rounded-xl text-sm font-bold border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            Delete
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto p-2 text-slate-400 hover:text-slate-600" aria-label="Clear selection">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        {isLoading ? (
          <PageLoader compact />
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
              <ClipboardList className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No tasks found</h3>
          </div>
        ) : !wide ? (
          // Phones: one card per task (the table needs ~900px); actions live on the task page
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredTasks.map((task) => {
              const late = task.status !== "Completed" && isOverdue(task.dueDate);
              return (
                <li key={task.id} className={`flex items-start gap-3 px-4 py-4 ${selected.has(task.id) ? "bg-indigo-50/60 dark:bg-indigo-900/20" : ""}`} data-task-card={task.title}>
                  <input
                    type="checkbox"
                    checked={selected.has(task.id)}
                    onChange={() => toggleRow(task.id)}
                    aria-label={`Select ${task.title}`}
                    className="w-5 h-5 mt-0.5 accent-indigo-600 shrink-0"
                  />
                  <button onClick={() => navigate(`/tasks/${task.id}`)} className="flex-1 min-w-0 text-left">
                    <span className={`block font-semibold break-words ${task.status === "Completed" ? "text-emerald-600 dark:text-emerald-400" : late ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"}`}>{task.title}</span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {task.project?.name || projects.find((p) => p.id === task.projectId)?.name} · {task.status} · {task.priority}
                    </span>
                    <span className={`flex items-center gap-1 text-xs mt-1 ${late ? "text-red-600 dark:text-red-400 font-semibold" : "text-zinc-500 dark:text-zinc-400"}`}>
                      <Clock className="w-3.5 h-3.5" /> {safeFormat(task.dueDate, "MMM d, yyyy")}
                    </span>
                    {(task.labels.length > 0 || !!task.subtaskTotal) && (
                      <span className="flex flex-wrap items-center gap-1.5 mt-2">
                        {task.labels.map((l) => <LabelChip key={l} label={l} />)}
                        {!!task.subtaskTotal && <span className="text-[10px] font-bold text-slate-500">☑ {task.subtaskDone}/{task.subtaskTotal}</span>}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="pl-6 py-4 w-8">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(filteredTasks.map((t) => t.id)))}
                      aria-label="Select all tasks"
                      className="w-4 h-4 accent-indigo-600"
                    />
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Task Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Due Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredTasks.map((task) => {
                  const project = projects.find((item) => item.id === task.projectId);

                  return (
                    <tr key={task.id} onClick={() => navigate(`/tasks/${task.id}`)} className={`hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors group cursor-pointer ${selected.has(task.id) ? "bg-indigo-50/60 dark:bg-indigo-900/20" : ""}`}>
                      <td className="pl-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(task.id)}
                          onChange={() => toggleRow(task.id)}
                          aria-label={`Select ${task.title}`}
                          className="w-4 h-4 accent-indigo-600"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className={`text-sm font-medium transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400 ${
                            task.status === "Completed" 
                              ? "text-emerald-600 dark:text-emerald-400" 
                              : isOverdue(task.dueDate)
                                ? "text-red-600 dark:text-red-400"
                                : "text-zinc-900 dark:text-zinc-100"
                          }`}>
                            {task.title}
                          </div>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">{task.description}</span>
                          {(task.labels.length > 0 || !!task.subtaskTotal) && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {task.labels.map((l) => <LabelChip key={l} label={l} />)}
                              {!!task.subtaskTotal && (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${task.subtaskDone === task.subtaskTotal ? "text-emerald-600" : "text-slate-500"}`}>
                                  <CheckSquare className="w-3 h-3" />
                                  {task.subtaskDone}/{task.subtaskTotal}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' }}>{task.project?.name || project?.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap" style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' }}>{task.status}</td>
                      <td className="px-6 py-4 whitespace-nowrap" style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' }}>{task.priority}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                          <Clock className="w-4 h-4" />
                          {safeFormat(task.dueDate, "MMM d, yyyy")}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="relative inline-block">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenu(activeMenu === task.id ? null : task.id);
                              }}
                              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              aria-label={`Actions for ${task.title}`}
                            >
                              <MoreHorizontal className="w-5 h-5" />
                            </button>

                            {activeMenu === task.id && (
                              <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-30 py-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/tasks/${task.id}`);
                                    setActiveMenu(null);
                                  }}
                                  className="block w-full text-left px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                >
                                  View Details
                                </button>
                                {!!task.myRole && task.myRole !== "viewer" && <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openModal(task);
                                      setActiveMenu(null);
                                    }}
                                    className="block w-full text-left px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                  >
                                    {task.myRole === "manager" ? "Edit Task" : "Update Status"}
                                  </button>}
                                {task.myRole === "manager" && (
                                  <>
                                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTaskToDelete(task.id);
                                        setActiveMenu(null);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                    >
                                      Delete Task
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!taskToDelete}
        title="Delete Task?"
        message="It moves to Recently deleted, where a manager can restore it within 30 days."
        onConfirm={deleteTask}
        onCancel={() => setTaskToDelete(null)}
      />
      <ConfirmDialog
        open={confirmBulkDelete}
        title={`Delete ${visibleSelected.length} task${visibleSelected.length === 1 ? "" : "s"}?`}
        message="They move to Recently deleted, where a manager can restore them within 30 days. Tasks you don't manage are skipped."
        onConfirm={() => void bulkDelete()}
        onCancel={() => setConfirmBulkDelete(false)}
      />

      <AddTaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        taskToEdit={editingTask}
        setTaskToEdit={setEditingTask}
        handleAddTask={handleAddTask}
        formError={formError}
        newTaskTitle={newTaskTitle}
        setNewTaskTitle={setNewTaskTitle}
        newTaskDescription={newTaskDescription}
        setNewTaskDescription={setNewTaskDescription}
        newTaskPriority={newTaskPriority}
        setNewTaskPriority={setNewTaskPriority}
        newTaskStatus={newTaskStatus}
        setNewTaskStatus={setNewTaskStatus}
        newTaskAssigneeIds={newTaskAssigneeIds}
        setNewTaskAssigneeIds={setNewTaskAssigneeIds}
        newTaskProjectId={newTaskProjectId}
        setNewTaskProjectId={setNewTaskProjectId}
        newTaskDueDate={newTaskDueDate}
        setNewTaskDueDate={setNewTaskDueDate}
        users={users}
        projects={projects}
        statusOnly={!!editingTask && editingTask.myRole !== "manager"}
        planning={planning}
        setPlanning={setPlanning}
      />
    </div>
  );
}
