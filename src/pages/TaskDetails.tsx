import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Calendar, Edit2, Trash2, Eye, EyeOff, Repeat, Lock, MoreHorizontal, FolderKanban, CheckSquare, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Activity, Project, Task, TaskLink, User, TaskPriority, TaskStatus } from "@/lib/api-types";
import { differenceInCalendarDays } from "date-fns";

const STATUSES: TaskStatus[] = ["To Do", "In Progress", "Review", "Completed"];
const PRIORITY_PILL: Record<string, string> = {
  Urgent: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  High: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Medium: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  Low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
};

// "in 5 days", "today", "2 days overdue" (deadlines are whole days)
function dueWords(due: string, done: boolean) {
  const d = differenceInCalendarDays(new Date(due), new Date());
  if (done) return "";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d > 1) return `in ${d} days`;
  return d === -1 ? "1 day overdue" : `${-d} days overdue`;
}
import { emptyPlanning, openBlockers, planningError, planningFromTask, planningToPayload, type PlanningState } from "@/lib/planning";
import { LabelChip } from "@/components/ui/LabelChip";
import { TaskChecklist } from "@/components/task/TaskChecklist";
import { TimeLog } from "@/components/task/TimeLog";
import { AttachmentSection } from "@/components/AttachmentSection";
import { AddTaskModal } from "@/components/AddTaskModal";
import { safeFormat, isOverdue, deadlineError } from "@/utils/dateUtils";
import { useNavigation } from "@/context/NavigationContext";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageLoader } from "@/components/ui/PageLoader";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";

export function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setEntityName } = useNavigation();
  const [task, setTask] = useState<Task | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const { currentUser } = useAuth();
  const { socket, joinProject, leaveProject } = useSocket();

  // Task Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>("Medium");
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>("To Do");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState("");
  const [newTaskAssigneeIds, setNewTaskAssigneeIds] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [formError, setFormError] = useState("");
  const [planning, setPlanning] = useState<PlanningState>(emptyPlanning);
  const [watchBusy, setWatchBusy] = useState(false);
  const [tab, setTab] = useState<"comments" | "activity" | "time" | "files">("comments");
  const [menuOpen, setMenuOpen] = useState(false);
  const [fileCount, setFileCount] = useState<number | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);

  const filteredSuggestions = useMemo(() => {
    // De-duplicate users by name for the suggestions list
    const uniqueUsersByName: User[] = users.filter((user, index, self) =>
      index === self.findIndex((u) => u.name.toLowerCase() === user.name.toLowerCase())
    );

    if (!mentionSearch) return uniqueUsersByName;
    return uniqueUsersByName.filter(u => 
      u.name.toLowerCase().includes(mentionSearch.toLowerCase())
    );
  }, [users, mentionSearch]);

  const handleSelectMention = (user: User) => {
    const beforeMention = newComment.substring(0, mentionStartIndex);
    const afterMention = newComment.substring(mentionStartIndex + mentionSearch.length + 1);
    const updatedComment = `${beforeMention}@${user.name} ${afterMention}`;
    
    setNewComment(updatedComment);
    setShowSuggestions(false);
    setMentionSearch("");
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart;
    setNewComment(value);

    // Detect @ mention trigger
    const textBeforeCursor = value.substring(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    
    // Check if @ is at the start of a word
    if (atIndex !== -1 && (atIndex === 0 || /\s/.test(textBeforeCursor[atIndex - 1]))) {
      const searchString = textBeforeCursor.substring(atIndex + 1);
      // Don't show if there's a space after @
      if (!/\s/.test(searchString)) {
        setMentionSearch(searchString);
        setMentionStartIndex(atIndex);
        setShowSuggestions(true);
        setSuggestionIndex(0);
        return;
      }
    }
    
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionIndex(prev => (prev + 1) % filteredSuggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelectMention(filteredSuggestions[suggestionIndex]);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    }
  };

  useEffect(() => {
    async function load() {
      if (!id) return;
      setIsLoading(true);
      setTask(null);

      try {
        const [taskData, activityData] = await Promise.all([
          api.getTask(id),
          api.getActivity(`?taskId=${id}`)
        ]);
        setTask(taskData);

        if (taskData.projectId) {
          const projectBundle = await api.getProjectBundle(taskData.projectId);
          setUsers(projectBundle.users);
          const allProjects = await api.getProjects();
          setProjects(allProjects);
        }
        if (id) setEntityName(id, taskData.title);
        if (taskData.project?.id) setEntityName(taskData.project.id, taskData.project.name);
        setActivity(activityData);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load task");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [id]);

  // Separate from loading: joining the room used to re-run the whole load once the task arrived
  const taskProjectId = task?.projectId;
  useEffect(() => {
    if (!taskProjectId) return;
    joinProject(taskProjectId);
    return () => leaveProject(taskProjectId);
  }, [taskProjectId]);

  const renderCommentWithMentions = (text: string) => {
    if (!text) return text;
    let parts: (string | React.ReactNode)[] = [text];
    
    // Sort users by name length to match longer names first
    const sortedUsers = [...users].sort((a, b) => b.name.length - a.name.length);
    
    sortedUsers.forEach(user => {
      const mention = `@${user.name}`;
      const escapedMention = mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const newParts: (string | React.ReactNode)[] = [];
      const regex = new RegExp(`(${escapedMention}(?!\\w))`, 'gi');
      
      parts.forEach(part => {
        if (typeof part === 'string') {
          const split = part.split(regex);
          split.forEach((s) => {
            if (s.toLowerCase() === mention.toLowerCase()) {
              newParts.push(
                <span key={`${user.id}-${Math.random()}`} className="text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-500/10 px-1 rounded">
                  {s}
                </span>
              );
            } else if (s) {
              newParts.push(s);
            }
          });
        } else {
          newParts.push(part);
        }
      });
      parts = newParts;
    });

    return parts;
  };

  useEffect(() => {
    if (socket && id) {
      const handleTaskUpdated = (data: any) => {
        if (data.taskId === id) {
          api.getTask(id).then(setTask);
          api.getActivity(`?taskId=${id}`).then(setActivity);
        }
      };

      const handleCommentAdded = (data: any) => {
        if (data.taskId === id) {
          api.getTask(id).then(setTask);
          api.getActivity(`?taskId=${id}`).then(setActivity);
          toast.success("New comment added");
        }
      };

      const handleCommentUpdated = (data: any) => {
        if (data.taskId === id) api.getTask(id).then(setTask).catch(() => undefined);
      };

      socket.on("task_updated", handleTaskUpdated);
      socket.on("comment_added", handleCommentAdded);
      socket.on("comment_updated", handleCommentUpdated);

      return () => {
        socket.off("task_updated", handleTaskUpdated);
        socket.off("comment_added", handleCommentAdded);
        socket.off("comment_updated", handleCommentUpdated);
      };
    }
  }, [socket, id]);

  // Per-project role from the server: managers edit everything, contributors move status and log work, viewers read
  const canManage = task?.myRole === "manager";
  const canContribute = !!task?.myRole && task.myRole !== "viewer";
  const watching = !!task?.watchers?.some((w) => w.id === currentUser?.id);

  const toggleWatch = async () => {
    if (!id || !task || watchBusy) return;
    setWatchBusy(true);
    try {
      await api.setWatching(id, !watching);
      setTask(await api.getTask(id));
      toast.success(watching ? "You'll stop getting updates on this task" : "You'll get updates on this task");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't change following");
    } finally {
      setWatchBusy(false);
    }
  };

  const saveStatus = async (status: TaskStatus) => {
    if (!id || !task || statusBusy || status === task.status) return;
    setStatusBusy(true);
    try {
      const updated = await api.updateTask(id, { status });
      setTask(updated);
      void api.getActivity(`?taskId=${id}`).then(setActivity).catch(() => undefined);
      toast.success(`Moved to ${status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't change the status");
    } finally {
      setStatusBusy(false);
    }
  };

  const changeStatus = (status: TaskStatus) => {
    if (!task) return;
    if (status !== "To Do" && status !== task.status && openBlockers(task).length) setPendingStatus(status);
    else void saveStatus(status);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Assuming api.postComment exists or we use fetch
      // Let's check if we need to add postComment to api.ts
      await api.postComment(id, newComment);
      setNewComment("");
      const updatedActivity = await api.getActivity(`?taskId=${id}`);
      setActivity(updatedActivity);
      const updatedTask = await api.getTask(id);
      setTask(updatedTask);
      toast.success("Comment posted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isSavingComment, setIsSavingComment] = useState(false);

  const handleSaveComment = async () => {
    if (!editingCommentId || !editingText.trim() || isSavingComment) return;
    setIsSavingComment(true);
    try {
      const saved = await api.updateComment(editingCommentId, editingText);
      setTask((prev) => prev && {
        ...prev,
        comments: prev.comments?.map((c) => (c.id === saved.id ? { ...c, text: saved.body, updatedAt: saved.updatedAt } : c))
      });
      setEditingCommentId(null);
      toast.success("Comment updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update comment");
    } finally {
      setIsSavingComment(false);
    }
  };
  const [confirmTaskDelete, setConfirmTaskDelete] = useState(false);

  const handleDeleteTask = async () => {
    setConfirmTaskDelete(false);
    if (!id || !task) return;
    try {
      await api.deleteTask(id);
      toast.success("Task moved to Recently deleted");
      navigate(`/projects/${task.projectId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete task");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setCommentToDelete(null);
    if (!id) return;
    try {
      await api.deleteComment(commentId);
      setTask((prev) => prev && { ...prev, comments: prev.comments?.filter((c) => c.id !== commentId) });
      toast.success("Comment deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete comment");
    }
  };

  const openModal = () => {
    if (!task) return;
    setNewTaskTitle(task.title);
    setNewTaskDescription(task.description);
    setNewTaskPriority(task.priority);
    setNewTaskStatus(task.status);
    setNewTaskDueDate(safeFormat(task.dueDate, "yyyy-MM-dd"));
    setNewTaskProjectId(task.projectId);
    setNewTaskAssigneeIds(task.assigneeIds || []);
    setPlanning(planningFromTask(task));
    setFormError("");
    setIsModalOpen(true);
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !task) return;

    if (canManage) {
      if (!newTaskTitle.trim() || !newTaskDescription.trim()) {
        setFormError("All task fields are required.");
        return;
      }

      if (!newTaskAssigneeIds.length) {
        setFormError("Please assign at least one team member.");
        return;
      }

      const dateError = deadlineError(newTaskDueDate, task.dueDate);
      if (dateError) {
        setFormError(dateError);
        return;
      }

      const planError = planningError(planning, newTaskDueDate);
      if (planError) {
        setFormError(planError);
        return;
      }
    }

    try {
      // Non-managers may only move the status; the server ignores anything else they send
      const updated = await api.updateTask(id, canManage ? {
        ...planningToPayload(planning),
        title: newTaskTitle,
        description: newTaskDescription,
        priority: newTaskPriority,
        status: newTaskStatus,
        dueDate: new Date(newTaskDueDate).toISOString(),
        projectId: newTaskProjectId,
        assigneeIds: newTaskAssigneeIds
      } : { status: newTaskStatus });

      setTask(updated);
      setIsModalOpen(false);
      void api.getActivity(`?taskId=${id}`).then(setActivity).catch(() => undefined);
      toast.success(canManage ? "Task updated successfully!" : "Task status updated!");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save task");
    }
  };

  const project = task?.project;
  const assignees = task?.assignees || [];

  if (isLoading) {
    return (
      <PageLoader />
    );
  }

  if (!task) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Task not found</h2>
        <button onClick={() => navigate("/tasks")} className="mt-4 text-indigo-600 font-medium">
          Back to tasks
        </button>
      </div>
    );
  }

  const loggedHours = Math.round(((task.timeEntries ?? []).reduce((s, e) => s + e.minutes, 0) / 60) * 10) / 10;
  const done = task.status === "Completed";
  const late = !done && isOverdue(task.dueDate);

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {project && (
            <Link to={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600">
              <FolderKanban className="w-4 h-4" />
              {project.name}
            </Link>
          )}
          <h1 className={`text-3xl font-bold tracking-tight mt-1 break-words ${done ? "text-emerald-600 dark:text-emerald-400" : late ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"}`}>
            {task.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {canContribute ? (
              <SingleSelectDropdown
                variant="pill"
                ariaLabel="Status"
                options={STATUSES.map((st) => ({ id: st, name: st }))}
                selectedId={task.status}
                disabled={statusBusy}
                onChange={(st) => changeStatus(st as TaskStatus)}
              />
            ) : (
              <span className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200" aria-label="Status">{task.status}</span>
            )}
            <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${PRIORITY_PILL[task.priority] ?? PRIORITY_PILL.Low}`}>{task.priority}</span>
            {task.dueDate && (
              <span data-due className={`inline-flex items-center gap-1.5 text-sm font-semibold ${late ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300"}`}>
                <Calendar className="w-4 h-4" />
                Due {safeFormat(task.dueDate, "MMM d")}{dueWords(task.dueDate, done) && ` · ${dueWords(task.dueDate, done)}`}
              </span>
            )}
            {task.recurrence && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                <Repeat className="w-4 h-4" />
                Repeats {task.recurrence.toLowerCase()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleWatch}
            disabled={watchBusy}
            aria-pressed={watching}
            title={watching ? "Stop getting updates on this task" : "Get notified about changes and comments"}
            className="btn-secondary px-4 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-50"
          >
            {watching ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {watching ? "Following" : "Follow"}
          </button>
          {canManage && (
            <button onClick={openModal} className="btn-secondary px-4 py-2 text-sm font-bold flex items-center gap-2">
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} aria-label="More actions" aria-expanded={menuOpen} className="btn-secondary px-3 py-2">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-1 w-44 card py-1 z-30" onMouseLeave={() => setMenuOpen(false)}>
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    void navigator.clipboard?.writeText(window.location.href).then(() => toast.success("Link copied"), () => toast.error("Couldn't copy the link"));
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <LinkIcon className="w-4 h-4" />
                  Copy link
                </button>
                {canManage && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmTaskDelete(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete task
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {task.myRole === "viewer" && (
        <div role="note" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <Eye className="w-4 h-4" />
          You can view this task but not change it or comment. Ask a project manager for a bigger role.
        </div>
      )}
      {openBlockers(task).length > 0 && task.status !== "Completed" && (
        <div role="status" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <Lock className="w-4 h-4 shrink-0" />
          Waiting on {openBlockers(task).map((b) => `"${b.title}"`).join(", ")}. You can still start it, but the work may not be ready.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          <div className="card p-5" aria-label="Description">
            <p className={`leading-relaxed whitespace-pre-wrap break-words ${task.description ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}`}>
              {task.description || "No description."}
            </p>
          </div>

          <TaskChecklist
            taskId={task.id}
            items={task.subtasks ?? []}
            canEdit={canContribute}
            onChange={(subtasks) => setTask((prev) => prev && { ...prev, subtasks })}
          />

          <div role="tablist" className="flex gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto whitespace-nowrap">
            {([
              ["comments", `Comments ${task.comments?.length ?? 0}`],
              ["activity", "Activity"],
              ["time", `Time ${loggedHours}h`],
              ["files", `Files ${fileCount ?? task.attachmentCount ?? task.attachments?.length ?? 0}`]
            ] as const).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`px-3 py-2 -mb-px text-sm font-semibold border-b-2 transition-colors ${tab === key ? "border-indigo-500 text-slate-900 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {(tab === "comments" || tab === "activity") && (
            <div className="card p-5 space-y-6">
              {canContribute && tab === "comments" && <form onSubmit={handlePostComment} className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8">
                <div className="flex-1 relative">
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200">
                      <div className="p-2 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Mention Team Member</span>
                        <span className="text-[10px] text-slate-400 px-2 italic">Use Arrow keys & Enter</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {filteredSuggestions.map((user, index) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleSelectMention(user)}
                            onMouseEnter={() => setSuggestionIndex(index)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              index === suggestionIndex 
                                ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" 
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                            }`}
                          >
                            <Avatar name={user.name} src={user.avatar} className="w-6 h-6 rounded-full" />
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold">{user.name}</span>
                              <span className="text-[10px] opacity-70">{user.role}</span>
                            </div>
                            {index === suggestionIndex && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <textarea
                    value={newComment}
                    onChange={handleCommentChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type @ to mention team members..."
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none min-h-[100px]"
                    rows={3}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !newComment.trim()}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all h-fit self-end w-full sm:w-auto"
                >
                  Post
                </button>
              </form>}

              {/* Unified Timeline: Merge system activities and comments */}
              {[
                ...activity.filter(a => a.type !== "comment_added").map(a => ({ ...a, isSystem: true })),
                ...(task.comments?.map(c => ({
                  id: c.id,
                  userId: c.userId,
                  type: "comment",
                  details: c.text,
                  createdAt: c.createdAt,
                  // >1s apart = changed after posting (createdAt and updatedAt are both set on insert)
                  edited: !!c.updatedAt && new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 1000,
                  isSystem: false,
                  user: c.user
                })) || [])
              ]
                .filter((e) => (tab === "activity") === e.isSystem)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((entry) => {
                  const actor = entry.user || users.find(u => u.id === entry.userId);
                  return (
                    <div key={entry.id} className="flex gap-4 group/item relative">
                      {/* Timeline Line */}
                      <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-zinc-100 dark:bg-zinc-800 group-last/item:hidden" />
                      
                      <div className="relative z-10 shrink-0">
                        <Avatar name={actor?.name} src={actor?.avatar} className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 shadow-sm" />
                      </div>

                      <div className={`flex-1 rounded-2xl border p-5 transition-all duration-300 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 ${
                        entry.isSystem 
                          ? "bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/50" 
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm"
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors">
                            {actor?.name ?? "System"}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 dark:bg-zinc-900/50 px-2 py-0.5 rounded-full border border-zinc-100 dark:border-zinc-800">
                              {safeFormat(entry.createdAt, "MMM d, h:mm a")}
                            </span>
                            {"edited" in entry && entry.edited && (
                              <span className="text-[10px] font-semibold text-zinc-400 italic">(edited)</span>
                            )}
                            {!entry.isSystem && entry.userId === currentUser?.id && editingCommentId !== entry.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCommentId(entry.id);
                                  setEditingText(entry.details);
                                }}
                                className="p-1 text-zinc-400 hover:text-indigo-600 rounded transition-colors"
                                title="Edit comment"
                                aria-label="Edit comment"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!entry.isSystem && (entry.userId === currentUser?.id || canManage) && (
                              <button
                                type="button"
                                onClick={() => setCommentToDelete(entry.id)}
                                className="p-1 text-zinc-400 hover:text-red-600 rounded transition-colors"
                                title="Delete comment"
                                aria-label="Delete comment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        {editingCommentId === entry.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditingCommentId(null);
                                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void handleSaveComment();
                              }}
                              aria-label="Edit comment text"
                              autoFocus
                              rows={3}
                              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setEditingCommentId(null)} className="px-4 py-1.5 btn-secondary text-xs font-bold">
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveComment}
                                disabled={isSavingComment || !editingText.trim()}
                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
                            entry.isSystem
                              ? "text-zinc-500 font-medium"
                              : "text-zinc-700 dark:text-zinc-300"
                          }`}>
                            {entry.isSystem ? entry.details : renderCommentWithMentions(entry.details)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              }
              {tab === "comments" && !task.comments?.length && (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No comments yet.</p>
              )}
              {tab === "activity" && !activity.some((a) => a.type !== "comment_added") && (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No activity yet.</p>
              )}
            </div>
          )}

          {tab === "time" && (
            <TimeLog
              taskId={task.id}
              entries={task.timeEntries ?? []}
              estimateHours={task.estimateHours}
              canLog={canContribute}
              canManage={canManage}
              currentUserId={currentUser?.id}
              onChange={(timeEntries) => setTask((prev) => prev && { ...prev, timeEntries })}
            />
          )}

          {tab === "files" && (
            <div className="card p-6">
              <AttachmentSection taskId={task.id} initialAttachments={task.attachments} canContribute={canContribute} canManage={canManage} onCountChange={setFileCount} />
            </div>
          )}
        </div>

        <aside className="card p-5 space-y-4 text-sm lg:sticky lg:top-4" aria-label="Details">
          <SideRow label="Assignees">
            {assignees.length === 0 ? (
              <span className="text-slate-400">Unassigned</span>
            ) : (
              <div className="flex flex-col items-end gap-1.5">
                {assignees.map((u) => (
                  <span key={u.id} className="inline-flex items-center gap-2">
                    {u.name}
                    <Avatar name={u.name} src={u.avatar} className="w-5 h-5 rounded-full" />
                  </span>
                ))}
              </div>
            )}
          </SideRow>
          <SideRow label="Start">{task.startDate ? safeFormat(task.startDate, "MMM d, yyyy") : "—"}</SideRow>
          <SideRow label="Estimate">
            {task.estimateHours != null ? `${task.estimateHours}h (${loggedHours}h logged)` : loggedHours ? `${loggedHours}h logged` : "—"}
          </SideRow>
          <SideRow label="Milestone">{task.milestone?.name ?? "—"}</SideRow>
          <SideRow label="Labels">
            {task.labels.length ? <div className="flex flex-wrap justify-end gap-1">{task.labels.map((l) => <LabelChip key={l} label={l} />)}</div> : "—"}
          </SideRow>
          {(!!task.blockedBy?.length || !!task.blocks?.length) && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3" aria-label="Dependencies">
              <DependencyList label="Waiting on" links={task.blockedBy ?? []} />
              <DependencyList label="Holding up" links={task.blocks ?? []} />
            </div>
          )}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4" aria-label="Followers">
            <p className="text-slate-500 dark:text-slate-400 mb-1.5">Followers</p>
            {task.watchers?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {task.watchers.map((w) => (
                  <span key={w.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <Avatar name={w.name} src={w.avatar} className="w-4 h-4 rounded-full" />
                    {w.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-400">Nobody yet</p>
            )}
          </div>
          {task.createdAt && (
            <p className="text-xs text-slate-400 pt-1">
              Created {safeFormat(task.createdAt, "MMM d")}{task.createdByName ? ` · by ${task.createdByName}` : ""}
            </p>
          )}
        </aside>
      </div>
      <ConfirmDialog
        open={!!pendingStatus}
        title="This task is blocked"
        message={pendingStatus ? `It's waiting on ${openBlockers(task).map((b) => `"${b.title}"`).join(", ")}. Move it to ${pendingStatus} anyway?` : undefined}
        confirmLabel="Move anyway"
        onConfirm={() => {
          const st = pendingStatus;
          setPendingStatus(null);
          if (st) void saveStatus(st);
        }}
        onCancel={() => setPendingStatus(null)}
      />
      <ConfirmDialog
        open={confirmTaskDelete}
        title="Delete task?"
        message={`"${task.title}" moves to Recently deleted, where a manager can restore it within 30 days.`}
        onConfirm={handleDeleteTask}
        onCancel={() => setConfirmTaskDelete(false)}
      />
      <ConfirmDialog
        open={!!commentToDelete}
        title="Delete comment?"
        message="This comment will be removed for everyone."
        onConfirm={() => commentToDelete && handleDeleteComment(commentToDelete)}
        onCancel={() => setCommentToDelete(null)}
      />
      <AddTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        taskToEdit={task}
        setTaskToEdit={() => {}}
        handleAddTask={handleUpdateTask}
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
        statusOnly={!canManage}
        planning={planning}
        setPlanning={setPlanning}
      />
    </div>
  );
}

function DependencyList({ label, links }: { label: string; links: TaskLink[] }) {
  if (!links.length) return null;
  return (
    <div>
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{label}</p>
      <ul className="space-y-1">
        {links.map((l) => {
          const finished = l.status === "DONE" || l.status === "Completed";
          return (
            <li key={l.id}>
              <Link to={`/tasks/${l.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-indigo-600">
                <span className={`truncate ${finished ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"}`}>{l.title}</span>
                <span className={`text-[10px] font-bold shrink-0 ${finished ? "text-emerald-600" : "text-amber-600"}`}>{finished ? "Done" : "Open"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SideRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
      <div className="text-right font-semibold text-slate-800 dark:text-slate-100 min-w-0">{children}</div>
    </div>
  );
}
