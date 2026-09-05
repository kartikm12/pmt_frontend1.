import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Task, TaskPriority, TaskStatus } from '@/lib/api-types';
import { MultiSelectDropdown } from '@/components/ui/MultiSelectDropdown';
import { SingleSelectDropdown } from '@/components/ui/SingleSelectDropdown';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit: Task | null;
  setTaskToEdit: (task: Task | null) => void;
  handleAddTask: (e: React.FormEvent) => void;
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
  statusOnly = false
}: AddTaskModalProps) {
  if (!isOpen) return null;

  const availableUsers = React.useMemo(() => {
    if (!users) return [];
    if (projects && newTaskProjectId) {
      const parentProject = projects.find(p => p.id === newTaskProjectId);
      if (parentProject) {
        return users.filter(u => parentProject.teamMemberIds?.includes(u.id));
      }
    }
    return users;
  }, [users, projects, newTaskProjectId]);

  // Clear assignees that don't belong to the newly selected project
  React.useEffect(() => {
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
  }, [newTaskProjectId, projects, users]); // Only watch project change, don't watch assignee change to avoid loops

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 animate-in fade-in duration-300"
      onClick={handleBackdropClick || onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        ref={modalRef}
        className="card w-full max-w-md max-h-screen flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
          <h2 id="modal-title" className="text-xl font-bold text-slate-900 dark:text-white">
            {statusOnly ? "Update Task Status" : taskToEdit ? "Edit Task" : "Create New Task"}
          </h2>
          <button 
            onClick={() => {
              onClose();
              setTaskToEdit(null);
            }}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleAddTask} className="px-6 py-3 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
          {formError && (
            <div className="p-4 text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
              {formError}
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="task-title" className="text-sm font-normal text-slate-700 dark:text-slate-300">Title</label>
            {statusOnly ? (
              <div className="w-full input px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed">{newTaskTitle}</div>
            ) : (
              <input 
                id="task-title"
                type="text" 
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g., Update landing page copy"
                className="w-full input px-4 py-3 text-sm focus:outline-none transition-all dark:text-slate-100"
                required
                autoFocus
              />
            )}
          </div>
          
          <div className="space-y-1">
            <label htmlFor="task-desc" className="text-sm font-normal text-slate-700 dark:text-slate-300">Description</label>
            {statusOnly ? (
              <div className="w-full input px-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed h-16 overflow-hidden">{newTaskDescription}</div>
            ) : (
              <textarea 
                id="task-desc"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="What needs to be done?"
                rows={2}
                className="w-full input px-4 py-2 text-sm focus:outline-none transition-all resize-none h-16 dark:text-slate-100"
                required
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="task-priority" className="text-sm font-normal text-slate-700 dark:text-slate-300">Priority</label>
              {statusOnly ? (
                <div className="w-full input px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed">{newTaskPriority}</div>
              ) : (
                <SingleSelectDropdown
                  options={[
                    { id: "Low", name: "Low" },
                    { id: "Medium", name: "Medium" },
                    { id: "High", name: "High" },
                    { id: "Urgent", name: "Urgent" },
                  ]}
                  selectedId={newTaskPriority}
                  onChange={(id) => setNewTaskPriority(id as TaskPriority)}
                />
              )}
            </div>
            
            <div className="space-y-1">
              <label htmlFor="task-status" className="text-sm font-normal text-slate-700 dark:text-slate-300">Status</label>
                <SingleSelectDropdown
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
          </div>
          
          {newTaskProjectId !== undefined && setNewTaskProjectId && projects && (
            <div className="space-y-1">
              <label htmlFor="task-project" className="text-sm font-normal text-slate-700 dark:text-slate-300">Project</label>
              {statusOnly ? (
                <div className="w-full input px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed">
                  {projects.find(p => p.id === newTaskProjectId)?.name || "Not Selected"}
                </div>
              ) : (
                <SingleSelectDropdown
                  options={projects.map(p => ({ id: p.id, name: p.name }))}
                  selectedId={newTaskProjectId || ""}
                  onChange={setNewTaskProjectId}
                  placeholder="Search and select a project..."
                />
              )}
            </div>
          )}

          {newTaskAssigneeIds !== undefined && setNewTaskAssigneeIds && users && (
            <div className="space-y-2">
              <label className="text-sm font-normal text-slate-700 dark:text-slate-300">Assign To</label>
              {statusOnly ? (
                <div className="flex flex-wrap gap-2">
                  {newTaskAssigneeIds.length === 0 ? (
                    <span className="text-sm text-slate-500">Unassigned</span>
                  ) : (
                    newTaskAssigneeIds.map(id => {
                      const user = users.find(u => u.id === id);
                      return user ? (
                        <span key={id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                          {user.name}
                        </span>
                      ) : null;
                    })
                  )}
                </div>
              ) : (
                <>
                  <MultiSelectDropdown
                    options={availableUsers}
                    selectedIds={newTaskAssigneeIds}
                    onChange={setNewTaskAssigneeIds}
                    placeholder="Search and select team members..."
                    disabled={!!projects && !newTaskProjectId}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">At least one assignee is required.</p>
                </>
              )}
            </div>
          )}
          
          {newTaskDueDate !== undefined && setNewTaskDueDate && (
            <div className="space-y-1">
              <label htmlFor="task-deadline" className="text-sm font-normal text-slate-700 dark:text-slate-300">Deadline</label>
              {statusOnly ? (
                <div className="w-full input px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed">
                  {newTaskDueDate ? new Date(newTaskDueDate).toLocaleDateString('en-GB') : "No Deadline"}
                </div>
              ) : (
                <input 
                  id="task-deadline"
                  type="date" 
                  value={newTaskDueDate}
                  min={new Date().toLocaleDateString('en-CA')}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="w-full input px-4 py-3 text-sm focus:outline-none transition-all dark:text-slate-100"
                />
              )}
            </div>
          )}
          
          <div className="pt-2 flex gap-4">
            <button 
              type="button"
              onClick={() => {
                onClose();
                setTaskToEdit(null);
              }}
              className="flex-1 px-6 py-3 btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 btn-primary py-3"
            >
              {taskToEdit ? (statusOnly ? "Update Status" : "Save Changes") : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
