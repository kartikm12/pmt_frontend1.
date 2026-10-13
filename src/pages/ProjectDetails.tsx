import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Calendar, Paperclip, Edit2, Trash2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EditProjectModal } from "@/pages/Projects";
import { toast } from "sonner";
import { AddTaskModal } from "@/components/AddTaskModal";
import { api, API_BASE_URL } from "@/lib/api";
import type { Project, Task, TaskPriority, TaskStatus, User, Attachment } from "@/lib/api-types";
import { safeFormat, isOverdue, deadlineError } from "@/utils/dateUtils";
import { useNavigation } from "@/context/NavigationContext";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { AttachmentSection } from "@/components/AttachmentSection";
import { Avatar } from "@/components/ui/Avatar";

const COLUMNS: TaskStatus[] = ["To Do", "In Progress", "Review", "Completed"];

export function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);
  const { setEntityName } = useNavigation();
  const [project, setProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<"board" | "team" | "files">("board");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [newTaskColumn, setNewTaskColumn] = useState<TaskStatus>("To Do");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>("Medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState("");
  const [newTaskAssigneeIds, setNewTaskAssigneeIds] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [taskToDeleteId, setTaskToDeleteId] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const isManager = ["Manager", "Project Manager", "Admin"].includes(currentUser?.role ?? "");
  const { socket, joinProject, leaveProject } = useSocket();

  const [loadError, setLoadError] = useState("");
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [confirmProjectDelete, setConfirmProjectDelete] = useState(false);
  const deletingProjectRef = useRef(false); // our own delete shouldn't also trigger the "was deleted" notice

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
        setUsers((prev) => {
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

      const handleProjectUpdated = (data: any) => {
        const updatedProject = data.members ? api.mapProject(data) : (data as Project);
        
        setProject((prev) => {
          if (prev && prev.id === updatedProject.id) {
            return { ...prev, ...updatedProject };
          }
          return prev;
        });

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
      socket.on("project_updated", handleProjectUpdated);
      socket.on("project_deleted", handleProjectDeleted);

      return () => {
        socket.off("task_created", handleTaskCreated);
        socket.off("task_updated", handleTaskUpdated);
        socket.off("task_deleted", handleTaskDeleted);
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
    return <div className="text-slate-500 dark:text-slate-400">Loading project...</div>;
  }

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
    } else {
      setTaskToEdit(null);
      setNewTaskColumn(column);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("Medium");
      setNewTaskDueDate(safeFormat(new Date().toISOString(), "yyyy-MM-dd"));
      setNewTaskProjectId(id || "");
      setNewTaskAssigneeIds([]);
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

    try {
      if (taskToEdit) {
        const updated = await api.updateTask(taskToEdit.id, {
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



  // Dropping a card on another column changes its status (anyone who can see the task may do that).
  // shortcut: order inside a column isn't saved (it follows the server's sort); add sortOrder writes if people ask for it
  const handleDragEnd = async ({ draggableId, source, destination }: DropResult) => {
    if (!destination || destination.droppableId === source.droppableId) return;
    const newStatus = destination.droppableId as TaskStatus;
    const before = tasks;
    setTasks((prev) => prev.map((t) => (t.id === draggableId ? { ...t, status: newStatus } : t)));
    try {
      const updated = await api.updateTask(draggableId, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      toast.success(`Moved to ${newStatus}`);
    } catch (error) {
      setTasks(before);
      toast.error(error instanceof Error ? error.message : "Couldn't move the task");
    }
  };

  const handleDeleteProject = async () => {
    setConfirmProjectDelete(false);
    if (!id) return;
    try {
      deletingProjectRef.current = true;
      await api.deleteProject(id);
      toast.success("Project deleted");
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
      toast.success("Task deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete task");
    } finally {
      setTaskToDeleteId(null);
    }
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-6 mb-10">
        <div>
          <div className="flex flex-wrap items-center gap-4">
            <h1 className={`text-4xl font-black tracking-tight ${
              project.status !== "Completed" && isOverdue(project.dueDate)
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
        <div className="flex items-center gap-6">
          <div className="flex -space-x-4">
            {project.teamMemberIds.map((memberId) => {
              const user = userMap.get(memberId);
              return user ? (
                <Avatar key={user.id} name={user.name} src={user.avatar} className="w-12 h-12 rounded-full border-4 border-white dark:border-slate-900 shadow-xl" />
              ) : null;
            })}
          </div>
          {isManager && (
            <>
              <button onClick={() => setIsEditingProject(true)} className="btn-secondary px-4 py-2.5 flex items-center gap-2 text-sm font-bold">
                <Edit2 className="w-4 h-4" />
                Edit Project
              </button>
              <button
                onClick={() => setConfirmProjectDelete(true)}
                className="px-4 py-2.5 flex items-center gap-2 text-sm font-bold rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button onClick={() => openModal("To Do")} className="btn-primary flex items-center gap-2">
                <Plus className="w-5 h-5" />
                New Task
              </button>
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
            setProject((prev) => (prev ? { ...prev, ...updated } : prev));
            setEntityName(updated.id, updated.name); // keep the breadcrumb in step with a rename
            setIsEditingProject(false);
          }}
        />
      )}
      <ConfirmDialog
        open={confirmProjectDelete}
        title="Delete project?"
        message={`"${project.name}" and all its tasks will be removed for everyone.`}
        onConfirm={handleDeleteProject}
        onCancel={() => setConfirmProjectDelete(false)}
      />

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("board")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === "board" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Board
          </button>
          <button
            onClick={() => setActiveTab("team")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === "team" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Team
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === "files" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Files
          </button>
        </div>
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
                    .map((task, index) => (
                      <React.Fragment key={task.id}>
                      <Draggable draggableId={task.id} index={index}>
                        {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        data-task-id={task.id}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        // mb-4 instead of the list's space-y: the drag library measures each card's own margin
                        // no transition-all: it would animate the library's drag transforms and make cards lag
                        className={`card p-5 mb-4 h-[180px] flex flex-col justify-between hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-[box-shadow,border-color] group cursor-pointer border border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900 ${
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
                            {isManager && (
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
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100/50 dark:border-slate-800/50">
                          <div className="flex -space-x-1.5">
                            {task.assigneeIds.map((id) => (
                              <Avatar key={id} name={userMap.get(id)?.name} src={userMap.get(id)?.avatar} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 shadow-sm" />
                            ))}
                          </div>
                          <div className="flex items-center gap-3 text-slate-400">
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
                    ))}
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
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Role</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Member Status</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Tasks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {project.teamMemberIds.map((memberId) => {
                  const user = userMap.get(memberId);
                  if (!user) return null;
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
      ) : (
        <div className="card p-8">
          <AttachmentSection projectId={project.id} initialAttachments={project.attachments} />
        </div>
      )}

      <ConfirmDialog
        open={!!taskToDeleteId}
        title="Delete Task?"
        message="Are you sure you want to delete this task? This action cannot be undone."
        onConfirm={deleteTask}
        onCancel={() => setTaskToDeleteId(null)}
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
        statusOnly={!isManager}
        modalRef={modalRef}
      />
    </div>
  );
}
