import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Calendar, Paperclip, Edit2, Trash2, Lock, Repeat, CheckSquare } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EditProjectModal } from "@/pages/Projects";
import { toast } from "sonner";
import { AddTaskModal } from "@/components/AddTaskModal";
import { api } from "@/lib/api";
import type { MembershipRole, Project, Task, TaskPriority, TaskStatus, User } from "@/lib/api-types";
import { emptyPlanning, openBlockers, planningError, planningFromTask, planningToPayload, type PlanningState } from "@/lib/planning";
import { safeFormat, isOverdue, deadlineError } from "@/utils/dateUtils";
import { useNavigation } from "@/context/NavigationContext";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { AttachmentSection } from "@/components/AttachmentSection";
import { Avatar } from "@/components/ui/Avatar";
import { LabelChip } from "@/components/ui/LabelChip";
import { ProjectTimeline } from "@/components/project/ProjectTimeline";
import { ProjectActivity } from "@/components/project/ProjectActivity";
import { PageLoader } from "@/components/ui/PageLoader";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";
import { RepeatChip } from "@/components/RepeatPicker";

const COLUMNS: TaskStatus[] = ["To Do", "In Progress", "Review", "Completed"];
const TABS = [
  { id: "board", label: "Board" },
  { id: "timeline", label: "Timeline" },
  { id: "team", label: "Team" },
  { id: "files", label: "Files" },
  { id: "activity", label: "Activity" }
] as const;
type Tab = (typeof TABS)[number]["id"];
const ROLE_LABEL: Record<MembershipRole, string> = { OWNER: "Owner", MANAGER: "Manager", CONTRIBUTOR: "Contributor", VIEWER: "Viewer" };

// Put the given cards in this order (they go last in the list; columns are filtered by status anyway)
function applyOrder(tasks: Task[], orderedIds: string[]) {
  const pos = new Map(orderedIds.map((x, i) => [x, i]));
  const moved = tasks.filter((t) => pos.has(t.id)).sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
  return [...tasks.filter((t) => !pos.has(t.id)), ...moved];
}

export function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);
  const { setEntityName } = useNavigation();
  const [project, setProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("board");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [newTaskColumn, setNewTaskColumn] = useState<TaskStatus>("To Do");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>("Medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState("");
  const [newTaskAssigneeIds, setNewTaskAssigneeIds] = useState<string[]>([]);
  const [planning, setPlanning] = useState<PlanningState>(emptyPlanning);
  const [formError, setFormError] = useState("");
  const [taskToDeleteId, setTaskToDeleteId] = useState<string | null>(null);
  const [blockedDrop, setBlockedDrop] = useState<{ result: DropResult; names: string } | null>(null);
  const { currentUser } = useAuth();
  const { socket, joinProject, leaveProject } = useSocket();

  const [loadError, setLoadError] = useState("");
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [confirmProjectDelete, setConfirmProjectDelete] = useState(false);
  const deletingProjectRef = useRef(false); // our own delete shouldn't also trigger the "was deleted" notice

  // Re-read the project (my role, member roles) after changes made here or elsewhere
  const reloadProject = async () => {
    if (!id) return;
    try {
      const bundle = await api.getProjectBundle(id);
      setProject((prev) => (prev ? { ...bundle.project, attachments: prev.attachments } : bundle.project));
      setEntityName(id, bundle.project.name);
    } catch {
      // removal is handled by project_deleted; other failures keep the current view
    }
  };

  useEffect(() => {
    async function load() {
      if (!id) return;
      setProject(null);
      setLoadError("");

      try {
        const [bundle, projectsData, teamData] = await Promise.all([
          api.getProjectBundle(id),
          api.getProjects(),
          api.getTeam()
        ]);
        setProject(bundle.project);
        setAllProjects(projectsData);
        setEntityName(id, bundle.project.name);
        setTasks(bundle.tasks);
        setUsers(() => {
          const merged: User[] = [...teamData];
          const existingIds = new Set(teamData.map(u => u.id));
          bundle.users.forEach(u => {
            if (!existingIds.has(u.id)) merged.push(u);
          });
          return merged;
        });
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Failed to load project");
      }
    }

    void load();

    if (id) {
      joinProject(id);
    }

    return () => {
      if (id) {
        leaveProject(id);
      }
    };
  }, [id]);

  useEffect(() => {
    if (socket) {
      const handleTaskCreated = (data: any) => {
        // This socket may also be in other project rooms (e.g. Leaderboard filter)
        if (data.projectId !== id) return;
        api.getTask(data.taskId).then(fullTask => {
          setTasks((current) => {
            if (current.some((t) => t.id === fullTask.id)) return current;
            return [...current, fullTask];
          });
        }).catch(err => console.error("Failed to fetch new task:", err));
      };

      const handleTaskUpdated = (data: any) => {
        api.getTask(data.taskId).then(fullTask => {
          if (fullTask.projectId !== id) {
            // Task moved to another project, remove from board
            setTasks(prev => prev.filter(t => t.id !== fullTask.id));
            return;
          }
          setTasks((prev) => prev.map((task) => (task.id === fullTask.id ? fullTask : task)));
        }).catch(err => console.error("Failed to fetch updated task:", err));
      };

      const handleTaskDeleted = (data: any) => {
        setTasks(prev => prev.filter(t => t.id !== data.taskId));
      };

      const handleReordered = (data: { projectId: string; orderedIds: string[] }) => {
        if (data.projectId === id) setTasks((prev) => applyOrder(prev, data.orderedIds));
      };

      const handleProjectUpdated = (data: any) => {
        if (data.id !== id) return;
        // The event carries no "my role", so read the project again
        void reloadProject();

        if (data.members) {
          const newUsers = data.members.map((m: any) => m.user).filter(Boolean).map(api.mapUser);
          setUsers(current => {
            const currentIds = new Set(current.map(u => u.id));
            const toAdd = newUsers.filter((u: any) => !currentIds.has(u.id));
            if (toAdd.length > 0) return [...current, ...toAdd];
            return current;
          });
        }
      };

      const handleProjectDeleted = (data: { projectId: string }) => {
        if (data.projectId !== id || deletingProjectRef.current) return;
        toast.info("This project was deleted");
        navigate("/projects");
      };

      socket.on("task_created", handleTaskCreated);
      socket.on("task_updated", handleTaskUpdated);
      socket.on("task_deleted", handleTaskDeleted);
      socket.on("tasks_reordered", handleReordered);
      socket.on("project_updated", handleProjectUpdated);
      socket.on("project_deleted", handleProjectDeleted);

      return () => {
        socket.off("task_created", handleTaskCreated);
        socket.off("task_updated", handleTaskUpdated);
        socket.off("task_deleted", handleTaskDeleted);
        socket.off("tasks_reordered", handleReordered);
        socket.off("project_updated", handleProjectUpdated);
        socket.off("project_deleted", handleProjectDeleted);
      };
    }
  }, [socket, id]);

  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  if (loadError) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Project not available</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">{loadError}</p>
        <button onClick={() => navigate("/projects")} className="mt-4 text-indigo-600 font-medium">
          Back to projects
        </button>
      </div>
    );
  }

  if (!project) {
    return <PageLoader />;
  }

  // Per-project role from the server: managers plan, contributors move cards, viewers only look
  // A completed or cancelled project is read-only until reopened (the server enforces it too);
  // canManage still covers project-level actions such as Edit Project, which is how it's reopened
  const closed = project.status === "Completed" || project.status === "Cancelled";
  const canManage = project.myRole === "manager";
  const canManageWork = canManage && !closed;
  const canContribute = !!project.myRole && project.myRole !== "viewer" && !closed;

  const openModal = (column: TaskStatus = "To Do", task?: Task) => {
    if (task) {
      setTaskToEdit(task);
      setNewTaskColumn(task.status);
      setNewTaskTitle(task.title);
      setNewTaskDescription(task.description);
      setNewTaskPriority(task.priority);
      setNewTaskDueDate(safeFormat(task.dueDate, "yyyy-MM-dd"));
      setNewTaskProjectId(task.projectId);
      setNewTaskAssigneeIds(task.assigneeIds || []);
      setPlanning(planningFromTask(task));
    } else {
      setTaskToEdit(null);
      setNewTaskColumn(column);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("Medium");
      setNewTaskDueDate(safeFormat(new Date().toISOString(), "yyyy-MM-dd"));
      setNewTaskProjectId(id || "");
      setNewTaskAssigneeIds([]);
      setPlanning(emptyPlanning);
    }

    setFormError("");
    setIsModalOpen(true);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTaskTitle.trim() || !newTaskDescription.trim()) {
      setFormError("All task fields are required.");
      return;
    }

    if (!newTaskAssigneeIds.length) {
      setFormError("Please assign at least one team member.");
      return;
    }

    const dateError = deadlineError(newTaskDueDate, taskToEdit?.dueDate);
    if (dateError) {
      setFormError(dateError);
      return;
    }

    const planError = planningError(planning, newTaskDueDate);
    if (planError) {
      setFormError(planError);
      return;
    }

    try {
      if (taskToEdit) {
        const updated = await api.updateTask(taskToEdit.id, {
          ...planningToPayload(planning),
          title: newTaskTitle,
          description: newTaskDescription,
          priority: newTaskPriority,
          status: newTaskColumn,
          dueDate: new Date(newTaskDueDate).toISOString(),
          projectId: newTaskProjectId,
          assigneeIds: newTaskAssigneeIds
        });

        if (updated.projectId !== id) {
          setTasks((prev) => prev.filter((task) => task.id !== updated.id));
          toast.success("Task moved to another project!");
        } else {
          setTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
          toast.success("Task updated successfully!");
        }
      } else if (id) {
        const created = await api.createTask({
          ...planningToPayload(planning),
          title: newTaskTitle,
          description: newTaskDescription,
          priority: newTaskPriority,
          status: newTaskColumn,
          dueDate: new Date(newTaskDueDate).toISOString(),
          projectId: id,
          assigneeIds: newTaskAssigneeIds
        });

        setTasks((prev) => [...prev, created]);
        toast.success("Task created successfully!");
      }

      setIsModalOpen(false);
      setTaskToEdit(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save task");
    }
  };

  // Same column: save the new card order. Another column: change status, then save the order there.
  const moveCard = async ({ draggableId, source, destination }: DropResult) => {
    if (!destination || !id) return;
    const newStatus = destination.droppableId as TaskStatus;
    const card = tasks.find((t) => t.id === draggableId);
    if (!card) return;
    const before = tasks;
    const column = tasks.filter((t) => t.status === newStatus && t.id !== draggableId);
    column.splice(destination.index, 0, { ...card, status: newStatus });
    const orderedIds = column.map((t) => t.id);
    setTasks(applyOrder(tasks.map((t) => (t.id === draggableId ? { ...t, status: newStatus } : t)), orderedIds));
    try {
      if (destination.droppableId !== source.droppableId) {
        const updated = await api.updateTask(draggableId, { status: newStatus });
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        toast.success(`Moved to ${newStatus}`);
      }
      await api.reorderTasks(id, newStatus, orderedIds);
    } catch (error) {
      setTasks(before);
      toast.error(error instanceof Error ? error.message : "Couldn't move the task");
    }
  };

  // Starting work on a blocked task is allowed, but asked first
  const handleDragEnd = (result: DropResult) => {
    const { draggableId, source, destination } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const card = tasks.find((t) => t.id === draggableId);
    const blockers = card ? openBlockers(card) : [];
    if (destination.droppableId !== source.droppableId && destination.droppableId !== "To Do" && blockers.length) {
      setBlockedDrop({ result, names: blockers.map((b) => `"${b.title}"`).join(", ") });
      return;
    }
    void moveCard(result);
  };

  const changeMemberRole = async (userId: string, role: MembershipRole) => {
    if (!id) return;
    try {
      await api.setMemberRole(id, userId, role);
      toast.success(`Role changed to ${ROLE_LABEL[role]}`);
      await reloadProject();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't change the role");
    }
  };

  const handleDeleteProject = async () => {
    setConfirmProjectDelete(false);
    if (!id) return;
    try {
      deletingProjectRef.current = true;
      await api.deleteProject(id);
      toast.success("Project moved to Recently deleted");
      navigate("/projects");
    } catch (error) {
      deletingProjectRef.current = false;
      toast.error(error instanceof Error ? error.message : "Failed to delete project");
    }
  };

  const deleteTask = async () => {
    if (!taskToDeleteId) return;

    try {
      await api.deleteTask(taskToDeleteId);
      setTasks((prev) => prev.filter((task) => task.id !== taskToDeleteId));
      toast.success("Task moved to Recently deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete task");
    } finally {
      setTaskToDeleteId(null);
    }
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      {closed && (
        <div role="note" data-closed-banner className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <Lock className="w-4 h-4 shrink-0" />
          This project is {project.status === "Completed" ? "completed" : "cancelled"}. Its tasks can be viewed but not changed{canManage ? ". To make changes, use Edit Project and set it back to Active." : "."}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-6 mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className={`text-4xl font-black tracking-tight ${
              !["Completed", "Cancelled", "On Hold"].includes(project.status) && isOverdue(project.dueDate)
                ? "text-red-600 dark:text-red-400"
                : "text-slate-900 dark:text-white"
            }`}>
              {project.name}
            </h1>
            <span className={`inline-flex items-center px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border ${
              project.status === "Active"
                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                : project.status === "Completed"
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                  : project.status === "Cancelled"
                    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40"
                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40"
            }`}>
              {project.status}
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium text-lg max-w-2xl leading-relaxed">{project.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-6">
          <div className="flex -space-x-4">
            {project.teamMemberIds.map((memberId) => {
              const user = userMap.get(memberId);
              return user ? (
                <Avatar key={user.id} name={user.name} src={user.avatar} className="w-12 h-12 rounded-full border-4 border-white dark:border-slate-900 shadow-xl" />
              ) : null;
            })}
          </div>
          {canManage && (
            <>
              <button onClick={() => setIsEditingProject(true)} className="btn-secondary px-4 py-2.5 flex items-center gap-2 text-sm font-bold whitespace-nowrap">
                <Edit2 className="w-4 h-4" />
                Edit<span className="hidden sm:inline"> Project</span>
              </button>
              <button
                onClick={() => setConfirmProjectDelete(true)}
                className="px-4 py-2.5 flex items-center gap-2 text-sm font-bold whitespace-nowrap rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              {!closed && (
                <button onClick={() => openModal("To Do")} className="btn-primary flex items-center gap-2 whitespace-nowrap">
                  <Plus className="w-5 h-5" />
                  New Task
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isEditingProject && (
        <EditProjectModal
          project={project}
          users={users}
          onClose={() => setIsEditingProject(false)}
          onSaved={(updated) => {
            setProject((prev) => (prev ? { ...prev, ...updated, myRole: prev.myRole } : prev));
            setEntityName(updated.id, updated.name); // keep the breadcrumb in step with a rename
            setIsEditingProject(false);
            void reloadProject(); // member changes alter roles
          }}
        />
      )}
      <ConfirmDialog
        open={confirmProjectDelete}
        title="Delete project?"
        message={`"${project.name}" and its tasks will move to Recently deleted. A manager can restore it within 30 days.`}
        onConfirm={handleDeleteProject}
        onCancel={() => setConfirmProjectDelete(false)}
      />


      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div role="tablist" className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab.id ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {project.myRole === "viewer" && (
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">View only</span>
        )}
      </div>

      {activeTab === "board" ? (
        <div className="flex-1 overflow-x-auto pb-8 custom-scrollbar">
          <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-6 h-full min-w-max p-1">
            {COLUMNS.map((column) => (
              <div key={column} className="w-[320px] flex flex-col group/column h-full">
                <div className="flex items-center justify-between mb-5 px-1 bg-white/50 dark:bg-slate-900/50 p-2.5 rounded-2xl backdrop-blur-sm border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider" style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' }}>{column}</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {tasks.filter((t) => t.status === column).length}
                    </span>
                  </div>
                </div>

                <Droppable droppableId={column}>
                  {(dropProvided, dropSnapshot) => (
                <div
                  ref={dropProvided.innerRef}
                  {...dropProvided.droppableProps}
                  data-column={column}
                  className={`flex-1 min-h-[200px] transition-colors rounded-2xl p-1 ${
                    dropSnapshot.isDraggingOver ? "bg-indigo-50/70 dark:bg-indigo-900/20 ring-2 ring-indigo-300/60 dark:ring-indigo-700/50" : ""
                  }`}
                >
                  {tasks
                    .filter((task) => task.status === column)
                    .map((task, index) => {
                      const blockers = openBlockers(task);
                      return (
                      <React.Fragment key={task.id}>
                      <Draggable draggableId={task.id} index={index} isDragDisabled={!canContribute}>
                        {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        data-task-id={task.id}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        // mb-4 instead of the list's space-y: the drag library measures each card's own margin
                        // no transition-all: it would animate the library's drag transforms and make cards lag
                        className={`card p-5 mb-4 min-h-[180px] flex flex-col justify-between hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-[box-shadow,border-color] group cursor-pointer border border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900 ${
                          dragSnapshot.isDragging ? "shadow-2xl ring-2 ring-indigo-400 rotate-1" : ""
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-4 mb-4">
                            <h4 className={`font-bold text-sm line-clamp-2 transition-colors leading-relaxed ${
                              task.status === "Completed"
                                ? "text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-500"
                                : isOverdue(task.dueDate)
                                  ? "text-red-600 dark:text-red-400 group-hover:text-red-500"
                                  : "text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                            }`}>
                              {task.title}
                            </h4>
                            {canManageWork && (
                              <div className="flex items-center shrink-0 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-all">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openModal(task.status, task);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                                  title="Edit Task"
                                  aria-label={`Edit ${task.title}`}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTaskToDeleteId(task.id);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                  title="Delete Task"
                                  aria-label={`Delete ${task.title}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 mb-5">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                                task.priority === "Urgent"
                                  ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                                  : task.priority === "High"
                                    ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
                                    : task.priority === "Medium"
                                      ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
                                      : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              <span style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' }}>{task.priority}</span>
                            </span>
                            <RepeatChip rule={task.recurrence} />
                            {(task.labels ?? []).map((l) => <LabelChip key={l} label={l} />)}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100/50 dark:border-slate-800/50">
                          <div className="flex -space-x-1.5">
                            {task.assigneeIds.map((id) => (
                              <Avatar key={id} name={userMap.get(id)?.name} src={userMap.get(id)?.avatar} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 shadow-sm" />
                            ))}
                          </div>
                          <div className="flex items-center gap-3 text-slate-400">
                            {blockers.length > 0 && (
                              <span title={`Blocked by ${blockers.map((b) => b.title).join(", ")}`} aria-label="Blocked" className="text-amber-500">
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            )}
                            {task.recurrence && (
                              <span title={`Repeats ${task.recurrence.toLowerCase()}`} aria-label={`Repeats ${task.recurrence.toLowerCase()}`}>
                                <Repeat className="w-3.5 h-3.5" />
                              </span>
                            )}
                            {!!task.subtaskTotal && (
                              <div className={`flex items-center gap-1 ${task.subtaskDone === task.subtaskTotal ? "text-emerald-500" : ""}`} title="Checklist" aria-label={`Checklist ${task.subtaskDone} of ${task.subtaskTotal} done`}>
                                <CheckSquare className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold">{task.subtaskDone}/{task.subtaskTotal}</span>
                              </div>
                            )}
                            {task.attachments && task.attachments.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Paperclip className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold">{task.attachments.length}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold">{safeFormat(task.dueDate, "MMM d")}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                        )}
                      </Draggable>
                      </React.Fragment>
                      );
                    })}
                  {dropProvided.placeholder}
                </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
          </DragDropContext>
        </div>
      ) : activeTab === "team" ? (
        <div className="flex-1 card overflow-hidden transition-all">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/5">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Member</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Job title</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Project role</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Member Status</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Tasks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {project.teamMemberIds.map((memberId) => {
                  const user = userMap.get(memberId);
                  if (!user) return null;
                  const memberRole: MembershipRole = user.id === project.managerId ? "OWNER" : project.memberRoles?.[user.id] ?? "CONTRIBUTOR";
                  // The owner's role and your own stay fixed, so nobody locks themselves out
                  const roleEditable = canManage && memberRole !== "OWNER" && user.id !== currentUser?.id;
                  return (
                    <tr key={user.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-all group">
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className="flex items-center gap-4">
                          <Avatar name={user.name} src={user.avatar} className="w-12 h-12 rounded-2xl border-2 border-white dark:border-slate-800 shadow-lg" />
                          <div>
                            <p className="text-base font-black text-slate-900 dark:text-white">{user.name}</p>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <span className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest" style={{ fontFamily: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' }}>{user.title ?? user.role}</span>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        {roleEditable ? (
                          <div className="w-44">
                            <SingleSelectDropdown
                              ariaLabel={`Project role for ${user.name}`}
                              options={(["MANAGER", "CONTRIBUTOR", "VIEWER"] as MembershipRole[]).map((r) => ({ id: r, name: ROLE_LABEL[r] }))}
                              selectedId={memberRole}
                              onChange={(r) => void changeMemberRole(user.id, r as MembershipRole)}
                            />
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300" data-role={user.name}>{ROLE_LABEL[memberRole]}</span>
                        )}
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border shadow-sm bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
                          {user.status ?? "Active"}
                        </span>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap text-slate-900 dark:text-white font-bold">
                        {tasks.filter(t => t.assigneeIds.includes(user.id)).length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "files" ? (
        <div className="card p-8">
          <AttachmentSection projectId={project.id} initialAttachments={project.attachments} canContribute={canContribute} canManage={canManageWork} />
        </div>
      ) : activeTab === "timeline" ? (
        <ProjectTimeline tasks={tasks} />
      ) : (
        <ProjectActivity projectId={project.id} />
      )}

      <ConfirmDialog
        open={!!taskToDeleteId}
        title="Delete Task?"
        message="It moves to Recently deleted, where a manager can restore it within 30 days."
        onConfirm={deleteTask}
        onCancel={() => setTaskToDeleteId(null)}
      />

      <ConfirmDialog
        open={!!blockedDrop}
        title="This task is blocked"
        message={blockedDrop ? `It's waiting on ${blockedDrop.names}. Move it anyway?` : undefined}
        confirmLabel="Move anyway"
        onConfirm={() => {
          const pending = blockedDrop;
          setBlockedDrop(null);
          if (pending) void moveCard(pending.result);
        }}
        onCancel={() => setBlockedDrop(null)}
      />

      <AddTaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setTaskToEdit(null);
        }}
        taskToEdit={taskToEdit}
        setTaskToEdit={setTaskToEdit}
        handleAddTask={handleAddTask}
        formError={formError}
        newTaskTitle={newTaskTitle}
        setNewTaskTitle={setNewTaskTitle}
        newTaskDescription={newTaskDescription}
        setNewTaskDescription={setNewTaskDescription}
        newTaskPriority={newTaskPriority}
        setNewTaskPriority={setNewTaskPriority}
        newTaskStatus={newTaskColumn}
        setNewTaskStatus={setNewTaskColumn}
        newTaskAssigneeIds={newTaskAssigneeIds}
        setNewTaskAssigneeIds={setNewTaskAssigneeIds}
        newTaskProjectId={newTaskProjectId}
        setNewTaskProjectId={setNewTaskProjectId}
        newTaskDueDate={newTaskDueDate}
        setNewTaskDueDate={setNewTaskDueDate}
        projects={allProjects}
        users={users}
        statusOnly={!canManage}
        planning={planning}
        setPlanning={setPlanning}
        modalRef={modalRef}
      />
    </div>
  );
}
