import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, Filter, MoreVertical, FolderOpen, X, Clock } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { safeFormat, isOverdue, deadlineError } from "@/utils/dateUtils";
import { api } from "@/lib/api";
import type { Project, User } from "@/lib/api-types";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { MultiSelectDropdown } from "@/components/ui/MultiSelectDropdown";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";
import { useBusy } from "@/lib/useBusy";
import { isManager } from "@/utils/roleUtils";
import { Avatar } from "@/components/ui/Avatar";
import { PageLoader } from "@/components/ui/PageLoader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") || "All";
  const { currentUser } = useAuth();
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectStartDate, setNewProjectStartDate] = useState("");
  const [newProjectEndDate, setNewProjectEndDate] = useState("");
  const [newProjectMembers, setNewProjectMembers] = useState<string[]>([]);
  const [copyFromProjectId, setCopyFromProjectId] = useState("");
  const [creating, guard] = useBusy();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [projectsData, teamData] = await Promise.all([api.getProjects(), api.getTeam()]);
        setAllProjects(projectsData);
        setUsers(teamData);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load projects");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const { socket } = useSocket();

  const handleProjectUpdated = (data: any) => {
    // If the data is from a WebSocket (raw server object), map it first.
    // If it's already mapped (from api.updateProject), mapProject handles it or we can detect it.
    // Raw server objects usually have 'members' array instead of 'teamMemberIds' string array.
    const updatedProject = data.members ? api.mapProject(data as any) : (data as Project);

    // Dropped from the team: reload, since the server decides what is still visible (e.g. via task assignments)
    if (currentUser && !isManager(currentUser.role) && !updatedProject.teamMemberIds.includes(currentUser.id)) {
      void api.getProjects().then(setAllProjects).catch(() => undefined);
      return;
    }

    setAllProjects((prev) =>
      prev.map((p) => 
        p.id === updatedProject.id 
          ? { ...p, ...updatedProject } 
          : p
      )
    );
  };

  useEffect(() => {
    if (socket) {
      const handleSocketProjectUpdated = (data: any) => {
        handleProjectUpdated(data);
      };

      const handleProjectDeleted = (data: { projectId: string }) => {
        setAllProjects((prev) => prev.filter((p) => p.id !== data.projectId));
      };

      socket.on("project_updated", handleSocketProjectUpdated);
      socket.on("project_deleted", handleProjectDeleted);

      return () => {
        socket.off("project_updated", handleSocketProjectUpdated);
        socket.off("project_deleted", handleProjectDeleted);
      };
    }
  }, [socket]);

  const filteredProjects = useMemo(() => {
    return allProjects.filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(activeSearchQuery.toLowerCase()) ||
        project.description.toLowerCase().includes(activeSearchQuery.toLowerCase());
      
      const matchesStatus = 
        statusFilter === "All" || 
        (statusFilter === "Pending" ? (project.status === "Planning" || project.status === "On Hold") : project.status === statusFilter);
        
      return matchesSearch && matchesStatus;
    });
  }, [activeSearchQuery, statusFilter, allProjects]);

  const handleSearch = () => {
    setActiveSearchQuery(searchQuery);
  };

  // Close the card menu on any outside click
  useEffect(() => {
    if (!activeMenu) return;
    const close = () => setActiveMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [activeMenu]);

  const handleCreateProject = guard(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (
      !newProjectName.trim() ||
      !newProjectDesc.trim() ||
      !newProjectStartDate ||
      !newProjectEndDate ||
      newProjectMembers.length === 0
    ) {
      toast.error("All project fields are required.");
      return;
    }

    const createDateError = projectDatesError(newProjectStartDate, newProjectEndDate);
    if (createDateError) {
      toast.error(createDateError);
      return;
    }

    try {
      const project = await api.createProject({
        name: newProjectName,
        description: newProjectDesc,
        startDate: new Date(newProjectStartDate).toISOString(),
        dueDate: new Date(newProjectEndDate).toISOString(),
        managerId: currentUser.id,
        memberIds: newProjectMembers,
        copyFromProjectId: copyFromProjectId || undefined
      });

      setAllProjects((prev) => [project, ...prev]);
      setIsNewProjectModalOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
      setNewProjectStartDate("");
      setNewProjectEndDate("");
      setNewProjectMembers([]);
      setCopyFromProjectId("");
      toast.success(copyFromProjectId ? "Project created with the copied tasks" : "Project created successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    }
  });

  const deleteProject = async () => {
    if (!projectToDelete) return;

    try {
      await api.deleteProject(projectToDelete);
      setAllProjects((prev) => prev.filter((project) => project.id !== projectToDelete));
      toast.success("Project moved to Recently deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete project");
    } finally {
      setProjectToDelete(null);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Projects</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-lg">Manage and track all your team's projects.</p>
        </div>
        {isManager(currentUser?.role) && (
          <button onClick={() => setIsNewProjectModalOpen(true)} className="btn-primary px-6 py-2.5 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            New Project
          </button>
        )}
      </div>

      {isNewProjectModalOpen && (
        <ProjectModal
          title="Create New Project"
          onClose={() => setIsNewProjectModalOpen(false)}
          onSubmit={handleCreateProject}
          name={newProjectName}
          setName={setNewProjectName}
          description={newProjectDesc}
          setDescription={setNewProjectDesc}
          startDate={newProjectStartDate}
          setStartDate={setNewProjectStartDate}
          endDate={newProjectEndDate}
          setEndDate={setNewProjectEndDate}
          memberIds={newProjectMembers}
          setMemberIds={setNewProjectMembers}
          users={users}
          copyFromId={copyFromProjectId}
          setCopyFromId={setCopyFromProjectId}
          copyOptions={allProjects}
          submitLabel={creating ? "Creating…" : "Create Project"}
          busy={creating}
        />
      )}

      {editingProject && (
        <EditProjectModal
          project={editingProject}
          users={users}
          onClose={() => setEditingProject(null)}
          onSaved={(updated) => {
            handleProjectUpdated(updated);
            setEditingProject(null);
          }}
        />
      )}

      {projectToDelete &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-300">
            <div className="card w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
              <div className="p-8 text-center space-y-5">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto">
                  <X className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Delete Project?</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    It and its tasks move to Recently deleted, where a manager can restore them within 30 days.
                  </p>
                </div>
                <div className="pt-4 flex gap-4">
                  <button onClick={() => setProjectToDelete(null)} className="flex-1 px-6 py-3 btn-secondary text-sm font-bold">
                    Cancel
                  </button>
                  <button onClick={deleteProject} className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-all">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 card p-4">
        <div className="relative flex-1 flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none transition-all dark:text-slate-100"
            />
          </div>
          <button onClick={handleSearch} className="btn-primary px-6 py-2.5">
            Search
          </button>
        </div>
        <div className="relative min-w-[200px]">
          <SingleSelectDropdown ariaLabel="Status"
            options={[
              { id: "All", name: "All Statuses" },
              { id: "Pending", name: "Pending (Planning & On Hold)" },
              { id: "Planning", name: "Planning" },
              { id: "Active", name: "Active" },
              { id: "Completed", name: "Completed" },
              { id: "On Hold", name: "On Hold" },
              { id: "Cancelled", name: "Cancelled" },
            ]}
            selectedId={statusFilter}
            onChange={(id) => {
              setStatusFilter(id);
              setSearchParams({ status: id });
            }}
            Icon={Filter}
          />
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 card border-dashed transition-colors">
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6">
            <FolderOpen className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">No projects found</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm text-center text-lg">
            We couldn't find any projects matching your current search and filter criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`} className="card hover:shadow-md hover:translate-y-[-2px] transition-all group cursor-pointer block overflow-hidden">
              <div className="p-8">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xl">
                      {project.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className={`text-lg font-bold transition-colors ${
                        !["Completed", "Cancelled", "On Hold"].includes(project.status) && isOverdue(project.dueDate)
                          ? "text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300"
                          : "text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                      }`}>
                        {project.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <p className="text-xs text-slate-500 dark:text-slate-400">Due {safeFormat(project.dueDate, "MMM d, yyyy")}</p>
                      </div>
                    </div>
                  </div>
                  {isManager(currentUser?.role) && (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveMenu(activeMenu === project.id ? null : project.id);
                        }}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {activeMenu === project.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 py-2 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setEditingProject({ ...project });
                              setActiveMenu(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            Edit Project
                          </button>

                          <div className="h-px bg-slate-100 dark:bg-slate-800 my-2 mx-2" />
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setProjectToDelete(project.id);
                              setActiveMenu(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            Delete Project
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mt-5 line-clamp-2 min-h-[40px] leading-relaxed">{project.description}</p>

                <div className="mt-8 flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800/50">
                  <div className="flex -space-x-2">
                    {project.teamMemberIds.slice(0, 4).map((id) => {
                      const user = users.find((member) => member.id === id);
                      return user ? (
                        <Avatar key={id} name={user.name} src={user.avatar} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 shadow-sm" />
                      ) : null;
                    })}
                  </div>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
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
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function projectDatesError(start: string, end: string, originalDue?: string) {
  if (start && end && start > end) return "Start date must be on or before the end date.";
  const endError = deadlineError(end, originalDue);
  return endError && endError.startsWith("Deadline") ? "Deadline (End Date) must be today or a future date." : endError;
}

// Shared by the Projects list and the project's own page, so both edit with the same rules
export function EditProjectModal({ project, users, onClose, onSaved }: {
  project: Project;
  users: User[];
  onClose: () => void;
  onSaved: (updated: Project) => void;
}) {
  const [editing, setEditing] = useState<Project>({ ...project });
  const [isSaving, setIsSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!editing.name.trim() || !editing.description.trim() || !editing.startDate || !editing.dueDate || !editing.teamMemberIds?.length) {
      toast.error("All project fields are required.");
      return;
    }
    // Compare with the saved deadline so an overdue project can still be edited (e.g. marked Completed)
    const dateError = projectDatesError(
      safeFormat(editing.startDate, "yyyy-MM-dd", ""),
      safeFormat(editing.dueDate, "yyyy-MM-dd", ""),
      project.dueDate
    );
    if (dateError) {
      toast.error(dateError);
      return;
    }
    setIsSaving(true);
    try {
      const updated = await api.updateProject(editing.id, editing);
      onSaved(updated);
      toast.success("Project updated successfully!");
      if (updated.tasksAfterEnd) toast.info(`${updated.tasksAfterEnd} open task${updated.tasksAfterEnd === 1 ? " is" : "s are"} due after the project's end date.`);
    } catch (error: any) {
      if (error?.data?.code === "OPEN_TASKS") setOpenTasks(Number(error.data.openTasks) || 1);
      else toast.error(error instanceof Error ? error.message : "Failed to update project");
    } finally {
      setIsSaving(false);
    }
  };

  // "This project still has N open tasks": complete it and mark them Done in one go
  const [openTasks, setOpenTasks] = useState(0);
  const completeWithTasks = async () => {
    setOpenTasks(0);
    setIsSaving(true);
    try {
      const updated = await api.updateProject(editing.id, editing, { closeOpenTasks: true });
      onSaved(updated);
      toast.success("Project completed and its open tasks marked Done");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update project");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <ConfirmDialog
      open={openTasks > 0}
      title="Complete this project?"
      message={`${openTasks} task${openTasks === 1 ? " is" : "s are"} still open. ${openTasks === 1 ? "It" : "They"}'ll be marked Done, and the project becomes read-only until someone reopens it.`}
      confirmLabel={`Mark ${openTasks} done and complete`}
      onConfirm={completeWithTasks}
      onCancel={() => setOpenTasks(0)}
    />
    <ProjectModal
      title="Edit Project"
      onClose={onClose}
      onSubmit={save}
      name={editing.name}
      setName={(value) => setEditing({ ...editing, name: value })}
      description={editing.description}
      setDescription={(value) => setEditing({ ...editing, description: value })}
      startDate={safeFormat(editing.startDate, "yyyy-MM-dd", "")}
      // A cleared date input gives "", and new Date("").toISOString() throws and blanked the page
      setStartDate={(value) => setEditing({ ...editing, startDate: value ? new Date(value).toISOString() : "" })}
      endDate={safeFormat(editing.dueDate, "yyyy-MM-dd", "")}
      setEndDate={(value) => setEditing({ ...editing, dueDate: value ? new Date(value).toISOString() : "" })}
      isEdit
      status={editing.status}
      setStatus={(value) => setEditing({ ...editing, status: value as Project["status"] })}
      memberIds={editing.teamMemberIds || []}
      setMemberIds={(ids) => setEditing({ ...editing, teamMemberIds: ids })}
      users={users}
      submitLabel={isSaving ? "Saving…" : "Save Changes"}
      busy={isSaving}
    />
    </>
  );
}

function ProjectModal(props: {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  status?: Project["status"];
  setStatus?: (value: string) => void;
  memberIds?: string[];
  setMemberIds?: (ids: string[]) => void;
  users?: User[];
  // Template: copy another project's tasks and checklists (dates shift to the new start)
  copyFromId?: string;
  setCopyFromId?: (id: string) => void;
  copyOptions?: Project[];
  submitLabel: string;
  busy?: boolean;
  isEdit?: boolean;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-300">
      <div className="card w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{props.title}</h2>
          <button onClick={props.onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={props.onSubmit} noValidate className="p-8 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Project Name</label>
            <input required value={props.name} onChange={(e) => props.setName(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all dark:text-slate-100" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Description</label>
            <textarea required value={props.description} onChange={(e) => props.setDescription(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none h-28 dark:text-slate-100" />
          </div>
          {props.setStatus && props.status && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Status</label>
              <SingleSelectDropdown ariaLabel="Status"
                options={[
                  { id: "Planning", name: "Planning" },
                  { id: "Active", name: "Active" },
                  { id: "Completed", name: "Completed" },
                  { id: "On Hold", name: "On Hold" },
                  { id: "Cancelled", name: "Cancelled" },
                ]}
                selectedId={props.status}
                onChange={(id) => props.setStatus?.(id)}
              />
            </div>
          )}
          {props.memberIds && props.setMemberIds && props.users && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Project Team</label>
              <>
                <MultiSelectDropdown
                  // Suspended people can't be newly added; ones already on the team stay listed
                  options={props.users.filter((u) => u.status !== "Suspended" || props.memberIds?.includes(u.id))}
                  selectedIds={props.memberIds} 
                  onChange={(ids) => props.setMemberIds?.(ids)} 
                  placeholder="Search and select project members..."
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">At least one project team member is required.</p>
              </>
            </div>
          )}
          {props.setCopyFromId && props.copyOptions && props.copyOptions.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Copy tasks from (optional)</label>
              <SingleSelectDropdown ariaLabel="Copy tasks from"
                options={[{ id: "", name: "Start empty" }, ...props.copyOptions.map((p) => ({ id: p.id, name: p.name }))]}
                selectedId={props.copyFromId ?? ""}
                onChange={(id) => props.setCopyFromId?.(id)}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Tasks and checklists are copied as new, with dates moved to this project's start. Copies are assigned to you.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Start Date</label>
              <input required type="date" value={props.startDate} onChange={(e) => props.setStartDate(e.target.value)} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all dark:text-slate-100" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">End Date</label>
              <input 
                required 
                type="date" 
                value={props.endDate}
                // On edit a past deadline must stay saveable; the browser would otherwise refuse to submit
                min={props.isEdit ? props.startDate || undefined : new Date().toLocaleDateString('en-CA')}
                onChange={(e) => props.setEndDate(e.target.value)} 
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all dark:text-slate-100" 
              />
            </div>
          </div>
          <div className="pt-6 flex gap-4">
            <button type="button" onClick={props.onClose} className="flex-1 px-6 py-3 btn-secondary text-sm font-bold">
              Cancel
            </button>
            <button type="submit" disabled={props.busy} className="flex-1 btn-primary font-bold py-3 disabled:opacity-70">
              {props.submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
