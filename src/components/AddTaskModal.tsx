import React from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, Loader2, FolderKanban } from 'lucide-react';
import type { Milestone, Task, TaskPriority, TaskStatus } from '@/lib/api-types';
import { MultiSelectDropdown } from '@/components/ui/MultiSelectDropdown';
import { SingleSelectDropdown } from '@/components/ui/SingleSelectDropdown';
import { LabelInput } from '@/components/ui/LabelChip';
import { api } from '@/lib/api';
import type { PlanningState } from '@/lib/planning';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit: Task | null;
  setTaskToEdit: (task: Task | null) => void;
  handleAddTask: (e: React.FormEvent) => void | Promise<void>;
  formError: string;
  newTaskTitle: string;
  setNewTaskTitle: (title: string) => void;
  newTaskDescription: string;
  setNewTaskDescription: (desc: string) => void;
  newTaskPriority: TaskPriority;
  setNewTaskPriority: (priority: TaskPriority) => void;
  newTaskStatus: TaskStatus;
  setNewTaskStatus: (status: TaskStatus) => void;
  newTaskAssigneeIds?: string[];
  setNewTaskAssigneeIds?: (assigneeIds: string[]) => void;
  newTaskProjectId?: string;
  setNewTaskProjectId?: (projectId: string) => void;
  newTaskDueDate?: string;
  setNewTaskDueDate?: (dueDate: string) => void;
  users?: any[];
  projects?: any[];
  modalRef?: React.RefObject<HTMLDivElement>;
  handleBackdropClick?: (e: React.MouseEvent) => void;
  statusOnly?: boolean;
  // Labels, estimate, start date, repeat, milestone, blocked-by (managers only)
  planning?: PlanningState;
  setPlanning?: (planning: PlanningState) => void;
}

export function AddTaskModal({
  isOpen,
  onClose,
  taskToEdit,
  setTaskToEdit,
  handleAddTask,
  formError,
  newTaskTitle,
  setNewTaskTitle,
  newTaskDescription,
  setNewTaskDescription,
  newTaskPriority,
  setNewTaskPriority,
  newTaskStatus,
  setNewTaskStatus,
  newTaskAssigneeIds,
  setNewTaskAssigneeIds,
  newTaskProjectId,
  setNewTaskProjectId,
  newTaskDueDate,
  setNewTaskDueDate,
  users,
  projects,
  modalRef,
  handleBackdropClick,
  statusOnly = false,
  planning,
  setPlanning
}: AddTaskModalProps) {
  const [submitting, setSubmitting] = React.useState(false);
  // Milestones and other tasks of the chosen project, for the planning pickers
  const [milestones, setMilestones] = React.useState<Milestone[]>([]);
  const [projectTasks, setProjectTasks] = React.useState<Task[]>([]);
  React.useEffect(() => {
    if (!isOpen || statusOnly || !planning || !newTaskProjectId) {
      setMilestones([]);
      setProjectTasks([]);
      return;
    }
    let cancelled = false;
    api.getProjectBundle(newTaskProjectId)
      .then((b) => {
        if (cancelled) return;
        setMilestones(b.project.milestones ?? []);
        setProjectTasks(b.tasks);
        // Moving the task to another project: milestone and blockers must belong to that project
        if (planning && setPlanning) {
          const taskIds = new Set(b.tasks.map((t) => t.id));
          const milestoneOk = !planning.milestoneId || (b.project.milestones ?? []).some((m) => m.id === planning.milestoneId);
          const blockers = planning.blockedByIds.filter((x) => taskIds.has(x));
          if (!milestoneOk || blockers.length !== planning.blockedByIds.length) {
            setPlanning({ ...planning, milestoneId: milestoneOk ? planning.milestoneId : "", blockedByIds: blockers });
          }
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isOpen, statusOnly, newTaskProjectId, !!planning]);

  const availableUsers = React.useMemo(() => {
    if (!users) return [];
    // Suspended people can't be newly assigned; current assignees stay listed
    const assignable = users.filter(u => u.status !== "Suspended" || newTaskAssigneeIds?.includes(u.id));
    if (projects && newTaskProjectId) {
      const parentProject = projects.find(p => p.id === newTaskProjectId);
      if (parentProject) {
        return assignable.filter(u => parentProject.teamMemberIds?.includes(u.id));
      }
    }
    return assignable;
  }, [users, projects, newTaskProjectId, newTaskAssigneeIds]);

  // Clear assignees that don't belong to the newly selected project (status-only users can't change them)
  React.useEffect(() => {
    if (!isOpen || statusOnly) return;
    if (newTaskProjectId && newTaskAssigneeIds && setNewTaskAssigneeIds && projects && users) {
      const parentProject = projects.find(p => p.id === newTaskProjectId);
      if (parentProject) {
        const validAssigneeIds = newTaskAssigneeIds.filter(id => 
          parentProject.teamMemberIds?.includes(id)
        );
        if (validAssigneeIds.length !== newTaskAssigneeIds.length) {
          setNewTaskAssigneeIds(validAssigneeIds);
        }
      }
    }
  }, [isOpen, newTaskProjectId, projects, users]); // Only watch project change, don't watch assignee change to avoid loops

  // Hooks above must run on every render; returning before them crashed the page when the modal opened
  if (!isOpen) return null;

  const close = () => {
    if (submitting) return;
    onClose();
    setTaskToEdit(null);
  };

  // One save at a time: repeat clicks while the first save is running are ignored, and the button says so
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await handleAddTask(e);
    } finally {
      setSubmitting(false);
    }
  };

  const projectName = projects?.find((p) => p.id === newTaskProjectId)?.name;
  const heading = statusOnly ? "Update status" : taskToEdit ? "Edit task" : "New task";
  const submitLabel = taskToEdit ? (statusOnly ? "Update Status" : "Save Changes") : "Create Task";
  const planningSummary = planning
    ? [
        planning.labels.length ? `${planning.labels.length} label${planning.labels.length === 1 ? "" : "s"}` : "",
        planning.estimateHours ? `${planning.estimateHours}h` : "",
        milestones.find((m) => m.id === planning.milestoneId)?.name ?? "",
        planning.recurrence ? "repeats" : "",
        planning.blockedByIds.length ? `${planning.blockedByIds.length} blocker${planning.blockedByIds.length === 1 ? "" : "s"}` : ""
      ].filter(Boolean).join(" · ")
    : "";
  const label = "text-xs font-semibold text-slate-500 dark:text-slate-400";

  const statusField = (
    <div className="space-y-1">
      <label htmlFor="task-status" className={label}>Status</label>
      <SingleSelectDropdown ariaLabel="Status"
        options={[
          { id: "To Do", name: "To Do" },
          { id: "In Progress", name: "In Progress" },
          { id: "Review", name: "Review" },
          { id: "Completed", name: "Completed" },
        ]}
        selectedId={newTaskStatus}
        onChange={(id) => setNewTaskStatus(id as TaskStatus)}
      />
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={handleBackdropClick || close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className={`card w-full ${statusOnly ? "max-w-md" : "max-w-3xl"} max-h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
            {projectName && <><FolderKanban className="inline w-4 h-4 mr-1 -mt-0.5" />{projectName} <span className="mx-1">/</span></>}
            <span id="modal-title" className="font-bold text-slate-900 dark:text-white">{heading}</span>
          </p>
          <button type="button" onClick={close} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={submit}
          noValidate
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              (e.currentTarget as HTMLFormElement).requestSubmit();
            }
          }}
          className="flex flex-col flex-1 min-h-0"
        >
          {formError && (
            <div role="alert" className="mx-5 mt-4 p-3 text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
              {formError}
            </div>
          )}

          {statusOnly ? (
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <p className={label}>Task</p>
                <p className="font-bold text-slate-900 dark:text-white mt-1">{newTaskTitle}</p>
              </div>
              {statusField}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_240px] md:grid-rows-[auto_1fr] flex-1 min-h-0 overflow-y-auto">
              <div className="p-5 space-y-4 md:border-r border-slate-100 dark:border-slate-800 md:col-start-1 md:row-start-1">
                <div className="space-y-1">
                  <label htmlFor="task-title" className="sr-only">Title</label>
                  <input
                    id="task-title"
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Task title"
                    className="w-full bg-transparent text-xl font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none border-b border-transparent focus:border-indigo-300 pb-1"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="task-desc" className={label}>Description</label>
                  <textarea
                    id="task-desc"
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    placeholder="What needs to be done?"
                    rows={4}
                    className="w-full input px-3 py-2 text-sm resize-y min-h-[96px] dark:text-slate-100"
                    required
                  />
                </div>

              </div>

              <div className="p-5 space-y-4 bg-slate-50/70 dark:bg-slate-900/40 md:col-start-2 md:row-start-1 md:row-span-2">
                {statusField}
                <div className="space-y-1">
                  <span id="task-priority-label" className={label}>Priority</span>
                  <div role="radiogroup" aria-labelledby="task-priority-label" className="grid grid-cols-4 gap-1">
                    {(["Low", "Medium", "High", "Urgent"] as TaskPriority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-label={p}
                        aria-checked={newTaskPriority === p}
                        onClick={() => setNewTaskPriority(p)}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          newTaskPriority === p
                            ? p === "Urgent" ? "bg-red-600 border-red-600 text-white" : p === "High" ? "bg-orange-500 border-orange-500 text-white" : "bg-indigo-600 border-indigo-600 text-white"
                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                        }`}
                      >
                        {p === "Medium" ? "Med" : p}
                      </button>
                    ))}
                  </div>
                </div>
                {newTaskAssigneeIds !== undefined && setNewTaskAssigneeIds && users && (
                  <div className="space-y-1">
                    <label className={label}>Assign To</label>
                    <MultiSelectDropdown
                      options={availableUsers}
                      selectedIds={newTaskAssigneeIds}
                      onChange={setNewTaskAssigneeIds}
                      placeholder="Pick people..."
                      disabled={!!projects && !newTaskProjectId}
                    />
                  </div>
                )}
                {planning && setPlanning && (
                  <div className="space-y-1">
                    <label htmlFor="task-start" className={label}>Start date</label>
                    <input
                      id="task-start"
                      type="date"
                      value={planning.startDate}
                      onChange={(e) => setPlanning({ ...planning, startDate: e.target.value })}
                      className="w-full input px-3 py-2.5 text-sm dark:text-slate-100"
                    />
                  </div>
                )}
                {newTaskDueDate !== undefined && setNewTaskDueDate && (
                  <div className="space-y-1">
                    <label htmlFor="task-deadline" className={label}>Deadline</label>
                    <input
                      id="task-deadline"
                      type="date"
                      value={newTaskDueDate}
                      // Only new tasks need a future date; a min on edit blocks saving an overdue task at all
                      min={taskToEdit ? undefined : new Date().toLocaleDateString('en-CA')}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="w-full input px-3 py-2.5 text-sm dark:text-slate-100"
                    />
                  </div>
                )}
                {newTaskProjectId !== undefined && setNewTaskProjectId && projects && (
                  <div className="space-y-1">
                    <label htmlFor="task-project" className={label}>Project</label>
                    <SingleSelectDropdown ariaLabel="Project"
                      options={projects.map(p => ({ id: p.id, name: p.name }))}
                      selectedId={newTaskProjectId || ""}
                      onChange={setNewTaskProjectId}
                      placeholder="Pick a project..."
                    />
                  </div>
                )}
              </div>
              {planning && setPlanning && (
              <div className="px-5 pb-5 pt-5 md:pt-0 md:border-r border-slate-100 dark:border-slate-800 md:col-start-1 md:row-start-2">
                <details open className="group rounded-xl border border-slate-200 dark:border-slate-800">
                    <summary className="flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer select-none list-none">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
                        <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-0 -rotate-90" />
                        Planning
                      </span>
                      <span className="text-xs text-slate-400 truncate">{planningSummary || "Optional"}</span>
                    </summary>
                    <div className="px-3 pb-3 space-y-3">
                      <div className="space-y-1">
                        <label className={label}>Labels</label>
                        <LabelInput labels={planning.labels} onChange={(labels) => setPlanning({ ...planning, labels })} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label htmlFor="task-estimate" className={label}>Estimate (hours)</label>
                          <input
                            id="task-estimate"
                            type="number"
                            min={0}
                            max={1000}
                            step={0.5}
                            value={planning.estimateHours}
                            onChange={(e) => setPlanning({ ...planning, estimateHours: e.target.value })}
                            placeholder="4"
                            className="w-full input px-3 py-2.5 text-sm dark:text-slate-100"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={label}>Milestone</label>
                          <SingleSelectDropdown ariaLabel="Milestone"
                            options={[{ id: "", name: "No milestone" }, ...milestones.map((m) => ({ id: m.id, name: m.name }))]}
                            selectedId={planning.milestoneId}
                            onChange={(id) => setPlanning({ ...planning, milestoneId: id })}
                            disabled={!newTaskProjectId}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={label}>Repeat</label>
                          <SingleSelectDropdown ariaLabel="Repeat"
                            options={[
                              { id: "", name: "Doesn't repeat" },
                              { id: "DAILY", name: "Every day" },
                              { id: "WEEKLY", name: "Every week" },
                              { id: "MONTHLY", name: "Every month" }
                            ]}
                            selectedId={planning.recurrence}
                            onChange={(id) => setPlanning({ ...planning, recurrence: id as PlanningState["recurrence"] })}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className={label}>Blocked by</label>
                        <MultiSelectDropdown
                          options={projectTasks.filter((t) => t.id !== taskToEdit?.id).map((t) => ({ id: t.id, name: t.title }))}
                          selectedIds={planning.blockedByIds}
                          onChange={(ids) => setPlanning({ ...planning, blockedByIds: ids })}
                          placeholder="Tasks that must finish first..."
                          disabled={!newTaskProjectId}
                        />
                      </div>
                    </div>
                  </details>
              </div>
              )}
            </div>
          )}

          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
            <span className="hidden sm:inline text-xs text-slate-400">Ctrl+Enter to save</span>
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={close} disabled={submitting} className="btn-secondary px-4 py-2 text-sm font-bold disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={submitting} aria-busy={submitting} className="btn-primary px-5 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-70">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? "Saving…" : submitLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
