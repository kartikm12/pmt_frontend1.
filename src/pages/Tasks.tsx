import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, MoreHorizontal, Filter, ArrowUpDown, Search, ClipboardList, Plus, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AddTaskModal } from "@/components/AddTaskModal";
import { api } from "@/lib/api";
import type { Project, Task, TaskPriority, TaskStatus, User } from "@/lib/api-types";
import { safeFormat, isOverdue, deadlineError } from "@/utils/dateUtils";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";

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
    } else {
      setEditingTask(null);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("Medium");
      setNewTaskDueDate(safeFormat(new Date().toISOString(), "yyyy-MM-dd"));
      setNewTaskStatus("To Do");
      setNewTaskAssigneeIds([]);
      setNewTaskProjectId("");
    }
    setFormError("");
    setIsModalOpen(true);
  };

  const taskFormError = () => {
    if (!editingTask && !newTaskProjectId) return "Please select a project.";
    if (!newTaskTitle.trim() || !newTaskDescription.trim()) return "All task fields are required.";
    if (!newTaskAssigneeIds.length) return "Please assign at least one team member.";
    return deadlineError(newTaskDueDate, editingTask?.dueDate);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    // A status-only update has nothing else to validate
    const validationError = editingTask && !isManager ? null : taskFormError();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      if (editingTask) {
        const payload = isManager
          ? {
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
        toast.success(isManager ? "Task updated successfully!" : "Task status updated!");
      } else {
        const created = await api.createTask({
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
        return matchesSearch && matchesStatus && matchesPriority;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [activeSearchQuery, statusFilter, priorityFilter, allTasks]);

  const handleSearch = () => {
    setActiveSearchQuery(searchQuery);
  };

  const deleteTask = async () => {
    if (!taskToDelete) return;

    try {
      await api.deleteTask(taskToDelete);
      setAllTasks((prev) => prev.filter((task) => task.id !== taskToDelete));
      toast.success("Task deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete task");
    } finally {
      setTaskToDelete(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 card p-6">
        <div className="flex items-center justify-between lg:justify-start gap-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight whitespace-nowrap">Tasks</h1>
          {isManager && (
            <button onClick={() => openModal()} className="lg:hidden flex items-center gap-2 btn-primary px-3 py-1.5 text-xs whitespace-nowrap shrink-0">
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

          <div className="flex items-center gap-2">
            <div className="relative min-w-[160px]">
              <SingleSelectDropdown 
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

            <div className="relative min-w-[160px]">
              <SingleSelectDropdown 
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

        {isManager && (
          <button onClick={() => openModal()} className="hidden lg:flex items-center gap-2 btn-primary px-4 py-2 whitespace-nowrap shrink-0">
            <Plus className="w-4 h-4" />
            New Task
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-zinc-500 dark:text-zinc-400">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
              <ClipboardList className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No tasks found</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
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
                    <tr key={task.id} onClick={() => navigate(`/tasks/${task.id}`)} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors group cursor-pointer">
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
                                <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openModal(task);
                                      setActiveMenu(null);
                                    }}
                                    className="block w-full text-left px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                  >
                                    {isManager ? "Edit Task" : "Update Status"}
                                  </button>
                                {isManager && (
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

      {taskToDelete &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-300">
            <div className="card w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
              <div className="p-8 text-center space-y-5">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto">
                  <X className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Delete Task?</h2>
                </div>
                <div className="pt-4 flex gap-4">
                  <button onClick={() => setTaskToDelete(null)} className="flex-1 px-6 py-3 btn-secondary">
                    Cancel
                  </button>
                  <button onClick={deleteTask} className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

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
        statusOnly={!isManager}
      />
    </div>
  );
}
