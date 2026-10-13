import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ChevronRight, ArrowLeft, AlignLeft, MessageSquare, Clock, Tag, Calendar, User as UserIcon, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Activity, Project, Task, User, Attachment, TaskPriority, TaskStatus } from "@/lib/api-types";
import { AttachmentSection } from "@/components/AttachmentSection";
import { AddTaskModal } from "@/components/AddTaskModal";
import { safeFormat, isOverdue, deadlineError } from "@/utils/dateUtils";
import { useNavigation } from "@/context/NavigationContext";
import { useSocket } from "@/context/SocketContext";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/ui/Avatar";

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
  const isManager = ["Manager", "Project Manager", "Admin"].includes(currentUser?.role ?? "");
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

      socket.on("task_updated", handleTaskUpdated);
      socket.on("comment_added", handleCommentAdded);

      return () => {
        socket.off("task_updated", handleTaskUpdated);
        socket.off("comment_added", handleCommentAdded);
      };
    }
  }, [socket, id]);

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

  const handleDeleteComment = async (commentId: string) => {
    if (!id || !window.confirm("Delete this comment?")) return;
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
    setFormError("");
    setIsModalOpen(true);
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !task) return;

    if (isManager) {
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
    }

    try {
      // Non-managers may only move the status; the server ignores anything else they send
      const updated = await api.updateTask(id, isManager ? {
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
      toast.success(isManager ? "Task updated successfully!" : "Task status updated!");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save task");
    }
  };

  const project = task?.project;
  const assignees = task?.assignees || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
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

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 btn-secondary rounded-lg transition-colors text-zinc-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`text-3xl font-bold tracking-tight ${
              task.status === "Completed"
                ? "text-emerald-600 dark:text-emerald-400"
                : isOverdue(task.dueDate)
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-900 dark:text-zinc-100"
            }`}>
              {task.title}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              {project && (
                <Link to={`/projects/${project.id}`} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                  {project.name}
                </Link>
              )}
              <span className="text-sm text-zinc-500 dark:text-zinc-400">ID: {task.id}</span>
            </div>
          </div>
        </div>
        {/* Everyone who can see the task may move its status; only managers edit the rest */}
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
        >
          <Edit2 className="w-4 h-4" />
          {isManager ? "Edit Task" : "Update Status"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="card p-6 transition-all">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold mb-4">
              <AlignLeft className="w-5 h-5 text-zinc-400" />
              <h3>Description</h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{task.description || "No description provided."}</p>
          </div>

          <div className="card p-6">
            <AttachmentSection taskId={task.id} initialAttachments={task.attachments} />
          </div>

            <div className="space-y-6">
              <h3 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-3 font-display tracking-tight">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                Discussion & Activity
              </h3>
            <div className="card p-6 space-y-6">
              <form onSubmit={handlePostComment} className="flex gap-4 mb-8">
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
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all h-fit self-end"
                >
                  Post
                </button>
              </form>

              {/* Unified Timeline: Merge system activities and comments */}
              {[
                ...activity.filter(a => a.type !== "comment_added").map(a => ({ ...a, isSystem: true })),
                ...(task.comments?.map(c => ({
                  id: c.id,
                  userId: c.userId,
                  type: "comment",
                  details: c.text,
                  createdAt: c.createdAt,
                  isSystem: false,
                  user: c.user
                })) || [])
              ]
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
                            {!entry.isSystem && (entry.userId === currentUser?.id || isManager) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(entry.id)}
                                className="p-1 text-zinc-400 hover:text-red-600 rounded transition-colors"
                                title="Delete comment"
                                aria-label="Delete comment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
                          entry.isSystem
                            ? "text-zinc-500 font-medium"
                            : "text-zinc-700 dark:text-zinc-300"
                        }`}>
                          {entry.isSystem ? entry.details : renderCommentWithMentions(entry.details)}
                        </p>
                      </div>
                    </div>
                  );
                })
              }
              {activity.length === 0 && (!task.comments || task.comments.length === 0) && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">No activity or comments yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 space-y-6">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Properties</h3>
            <div className="space-y-4">
              <PropertyRow icon={<Clock className="w-4 h-4" />} label="Status" value={task.status} />
              <PropertyRow icon={<Tag className="w-4 h-4" />} label="Priority" value={task.priority} />
              <PropertyRow icon={<Calendar className="w-4 h-4" />} label="Due Date" value={safeFormat(task.dueDate, "MMM d, yyyy")} />
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-zinc-500 text-sm">
                  <UserIcon className="w-4 h-4" />
                  <span>Assignees</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {assignees.length === 0 ? (
                    <span className="text-sm font-semibold text-zinc-400">Unassigned</span>
                  ) : (
                    assignees.map(user => (
                      <div key={user.id} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                        <Avatar name={user.name} src={user.avatar} className="w-5 h-5 rounded-full" />
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{user.name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
        statusOnly={!isManager}
      />
    </div>
  );
}

function PropertyRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-zinc-500 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}
