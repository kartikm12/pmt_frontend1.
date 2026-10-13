import React, { useEffect, useMemo, useState } from "react";
import { Mail, MoreVertical, Plus, Search, Users, X, Briefcase, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { isEmail } from "@/lib/utils";
import type { Project, User } from "@/lib/api-types";
import { useAuth } from "@/context/AuthContext";
import { isManager } from "@/utils/roleUtils";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { WorkloadPanel } from "@/components/team/WorkloadPanel";
import { useBusy } from "@/lib/useBusy";
import { PendingSignups } from "@/components/team/PendingSignups";
import { PageLoader } from "@/components/ui/PageLoader";

const ROLE_OPTIONS: User["role"][] = [
  "Manager",
  "Team Member",
  "Developer",
  "Designer",
  "Tester",
  "Support Engineer",
  "Business Analyst",
  "Project Manager",
  "Admin"
];

export function Team() {
  const { currentUser } = useAuth();
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [saving, guard] = useBusy();
  const [view, setView] = useState<"members" | "workload">("members");
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<User["role"]>("Team Member");
  const [inviteTitle, setInviteTitle] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteProjectId, setInviteProjectId] = useState("");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<User | null>(null);

  // Mirrors the server: only an Admin may grant the Admin role or manage an Admin's account
  const isAdmin = currentUser?.role === "Admin";
  const roleOptions = ROLE_OPTIONS.filter((role) => isAdmin || role !== "Admin").map((role) => ({ id: role, name: role }));
  const canManage = (user: User) => isAdmin || user.role !== "Admin";

  // Close the row menu on any outside click
  useEffect(() => {
    if (!activeMenu) return;
    const close = () => setActiveMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [activeMenu]);

  const handleUpdate = guard(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberToEdit) return;
    if (inviteName.trim().length < 2) {
      toast.error("Please enter the member's full name.");
      return;
    }

    try {
      await api.updateTeamMember(memberToEdit.id, {
        fullName: inviteName,
        role: inviteRole,
        title: inviteTitle,
        projectId: inviteProjectId || undefined
      });

      const teamData = (await api.getTeam()) as User[];
      setTeamMembers(teamData);
      toast.success("Team member updated successfully");
      setIsEditModalOpen(false);
      setMemberToEdit(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update member");
    }
  });

  const [teamLoaded, setTeamLoaded] = useState(false);
  const loadTeam = async () => {
    try {
      const [teamData, projectsData] = await Promise.all([api.getTeam(), api.getProjects()]);
      setTeamMembers(teamData as User[]);
      setAllProjects(projectsData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load team");
    } finally {
      setTeamLoaded(true);
    }
  };

  useEffect(() => {
    void loadTeam();
  }, []);

  const filteredUsers = useMemo(() => {
    return teamMembers.filter((user) => {
      const matchesSearch = user.name.toLowerCase().includes(activeSearchQuery.toLowerCase()) || user.email.toLowerCase().includes(activeSearchQuery.toLowerCase());
      const matchesRole = roleFilter === "All Roles" || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [teamMembers, activeSearchQuery, roleFilter]);

  const handleSearch = () => {
    setActiveSearchQuery(searchQuery);
  };

  const handleInvite = guard(async (e: React.FormEvent) => {
    e.preventDefault();
    // Forms use noValidate (no browser popups); these are the rules the browser used to enforce
    const problem =
      inviteName.trim().length < 2 ? "Please enter the member's full name."
      : !isEmail(inviteEmail) ? "Please enter a valid email address."
      : invitePassword.length < 8 ? "Temporary password must be at least 8 characters."
      : "";
    if (problem) {
      toast.error(problem);
      return;
    }

    try {
      await api.inviteTeamMember({
        fullName: inviteName,
        email: inviteEmail,
        password: invitePassword,
        role: inviteRole,
        title: inviteTitle,
        projectId: inviteProjectId || undefined
      });

      const teamData = (await api.getTeam()) as User[];
      setTeamMembers(teamData);
      toast.success(`${inviteName} added to the team!`);
      setIsInviteModalOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("Team Member");
      setInviteTitle("");
      setInvitePassword("");
      setInviteProjectId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add team member");
    }
  });

  const [memberToSuspend, setMemberToSuspend] = useState<User | null>(null);

  // Suspending signs the person out everywhere and blocks login; their work and history stay intact
  const changeStatus = guard(async (member: User, status: "Active" | "Suspended") => {
    setMemberToSuspend(null);
    try {
      await api.updateTeamMember(member.id, { status });
      setTeamMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, status } : m)));
      toast.success(status === "Suspended" ? `${member.name} is suspended` : `${member.name} is active again`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update member");
    }
  });

  const handleDeleteMember = guard(async () => {
    if (!memberToDelete) return;

    try {
      await api.deleteTeamMember(memberToDelete.id);
      setTeamMembers((prev) => prev.filter((member) => member.id !== memberToDelete.id));
      toast.success("Member removed from team");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove member");
    } finally {
      setIsDeleteModalOpen(false);
      setMemberToDelete(null);
    }
  });

  if (!teamLoaded) return <PageLoader />;

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Team Members</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Manage your team and their roles.</p>
        </div>
        {isManager(currentUser?.role) && (
          <button onClick={() => setIsInviteModalOpen(true)} className="btn-primary flex items-center gap-2 px-6 py-3">
            <Plus className="w-5 h-5" />
            Add Member
          </button>
        )}
      </div>

      {isInviteModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-300 backdrop-blur-sm" onClick={() => setIsInviteModalOpen(false)}>
            <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
              <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Add Team Member</h2>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">Invite a new colleague to your workspace</p>
                </div>
                <button onClick={() => setIsInviteModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleInvite} noValidate className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <Field label="Full Name">
                    <input required type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="w-full px-4 py-3 input text-sm focus:outline-none transition-all dark:text-slate-100 font-medium" />
                  </Field>
                  <Field label="Email Address">
                    <input required type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full px-4 py-3 input text-sm focus:outline-none transition-all dark:text-slate-100 font-medium" />
                  </Field>
                  <Field label="Role">
                    <SingleSelectDropdown
                      options={roleOptions}
                      selectedId={inviteRole}
                      onChange={(id) => setInviteRole(id as User["role"])}
                    />
                  </Field>
                  <Field label="Job Title">
                    <input type="text" value={inviteTitle} onChange={(e) => setInviteTitle(e.target.value)} className="w-full px-4 py-3 input text-sm focus:outline-none transition-all dark:text-slate-100 font-medium" placeholder="Frontend Developer" />
                  </Field>
                  <Field label="Temporary Password">
                    <div className="relative group">
                      <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                        required
                        minLength={8}
                        placeholder="At least 8 characters"
                        type={showInvitePassword ? "text" : "password"}
                        value={invitePassword} 
                        onChange={(e) => setInvitePassword(e.target.value)} 
                        className="w-full pl-11 pr-12 py-3 input text-sm focus:outline-none transition-all dark:text-slate-100 font-medium" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowInvitePassword(!showInvitePassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        tabIndex={-1}
                      >
                        {showInvitePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                  <Field label="Assign Project">
                    <SingleSelectDropdown
                      options={[
                        { id: "", name: "No Project" },
                        ...allProjects.map(p => ({ id: p.id, name: p.name }))
                      ]}
                      selectedId={inviteProjectId}
                      onChange={setInviteProjectId}
                      placeholder="Search and select project..."
                    />
                  </Field>
                </div>
                <div className="pt-10 flex flex-col sm:flex-row gap-4 sticky bottom-0 bg-white dark:bg-slate-900 mt-2">
                  <button type="button" onClick={() => setIsInviteModalOpen(false)} className="flex-1 px-6 py-4 btn-secondary text-sm font-bold uppercase tracking-widest">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="flex-1 btn-primary px-6 py-4 text-sm font-bold uppercase tracking-widest disabled:opacity-70">
                    {saving ? "Saving…" : "Add Member"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {isEditModalOpen &&
        memberToEdit &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-300 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}>
            <div className="card w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
              <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Edit Team Member</h2>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">Update member details and project access</p>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleUpdate} noValidate className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <Field label="Full Name">
                    <input required type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="w-full px-4 py-3 input text-sm focus:outline-none transition-all dark:text-slate-100 font-medium" />
                  </Field>
                  <Field label="Email Address">
                    <input disabled type="email" value={inviteEmail} className="w-full px-4 py-3 input text-sm opacity-50 cursor-not-allowed dark:text-slate-100 font-medium" />
                  </Field>
                  <Field label="Role">
                    <SingleSelectDropdown
                      options={roleOptions}
                      selectedId={inviteRole}
                      onChange={(id) => setInviteRole(id as User["role"])}
                      disabled={memberToEdit.id === currentUser?.id}
                    />
                    {memberToEdit.id === currentUser?.id && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">You can't change your own role.</p>
                    )}
                  </Field>
                  <Field label="Job Title">
                    <input type="text" value={inviteTitle} onChange={(e) => setInviteTitle(e.target.value)} className="w-full px-4 py-3 input text-sm focus:outline-none transition-all dark:text-slate-100 font-medium" placeholder="Frontend Developer" />
                  </Field>
                  <Field label="Assign Project">
                    <SingleSelectDropdown
                      options={[
                        { id: "", name: "No Project" },
                        ...allProjects.map(p => ({ id: p.id, name: p.name }))
                      ]}
                      selectedId={inviteProjectId}
                      onChange={setInviteProjectId}
                      placeholder="Search and select project..."
                    />
                  </Field>
                </div>
                <div className="pt-10 flex flex-col sm:flex-row gap-4 sticky bottom-0 bg-white dark:bg-slate-900 mt-2">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-6 py-4 btn-secondary text-sm font-bold uppercase tracking-widest">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="flex-1 btn-primary px-6 py-4 text-sm font-bold uppercase tracking-widest disabled:opacity-70">
                    {saving ? "Saving…" : "Update Member"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {isManager(currentUser?.role) && (
        <PendingSignups roleOptions={ROLE_OPTIONS.filter((role) => isAdmin || role !== "Admin")} onApproved={() => void loadTeam()} />
      )}

      {isManager(currentUser?.role) && (
        <div role="tablist" className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl -mb-4">
          {(["members", "workload"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === v ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
            >
              {v === "members" ? "Members" : "Workload"}
            </button>
          ))}
        </div>
      )}

      {view === "workload" && <WorkloadPanel />}

      {/* Hidden rather than unmounted so search and menus keep their state */}
      <div className={`card overflow-hidden ${view === "workload" ? "hidden" : ""}`}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative w-full sm:w-80 group">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search team members..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="w-full pl-11 pr-4 py-3 input text-sm text-slate-900 dark:text-white focus:outline-none transition-all font-medium" />
            </div>
            <button onClick={handleSearch} className="btn-primary px-6 py-3">
              Search
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Role:</span>
            <div className="min-w-[160px]">
              <SingleSelectDropdown
                options={[
                  { id: "All Roles", name: "All Roles" },
                  ...ROLE_OPTIONS.map((role) => ({ id: role, name: role }))
                ]}
                selectedId={roleFilter}
                onChange={setRoleFilter}
              />
            </div>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6">
              <Users className="w-10 h-10 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">No team members found</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-left">Name</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-left">Role</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-left">Email</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-left">Projects</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/10 dark:hover:bg-slate-800/30 transition-all group">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <Avatar name={user.name} src={user.avatar} className="w-12 h-12 rounded-2xl border-2 border-white dark:border-slate-800 shadow-sm object-cover" />
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {user.name}
                            {user.status === "Suspended" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40">
                                Suspended
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{user.title ?? user.status}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-left">
                      <span className="inline-flex items-center justify-center min-w-[120px] px-4 h-7 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 shadow-sm">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-400">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                          <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        </div>
                        {user.email}
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex flex-wrap gap-2">
                        {user.projects.length > 0 ? (
                          user.projects.map((project) => (
                            <span key={project.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/20 dark:bg-slate-800/40 text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 uppercase tracking-tight hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-colors">
                              <Briefcase className="w-3 h-3" />
                              {project.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500 italic font-medium">No active projects</span>
                        )}
                      </div>
                    </td>
                    {isManager(currentUser?.role) && (
                      <td className="px-8 py-5 whitespace-nowrap text-right relative">
                        {canManage(user) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(activeMenu === user.id ? null : user.id);
                          }}
                          aria-label={`Actions for ${user.name}`}
                          className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-all p-2 rounded-xl hover:bg-white/20 dark:hover:bg-slate-800/40"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        )}
                        {activeMenu === user.id && (
                          <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-30 py-2 flex flex-col">
                            <button
                              onClick={() => {
                                setMemberToEdit(user);
                                setInviteName(user.name);
                                setInviteEmail(user.email);
                                setInviteRole(user.role);
                                setInviteTitle(user.title || "");
                                setInviteProjectId(user.projects[0]?.id || "");
                                setIsEditModalOpen(true);
                                setActiveMenu(null);
                              }}
                              className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                              Edit Member
                            </button>
                            {user.id !== currentUser?.id && (
                              <button
                                onClick={() => {
                                  setActiveMenu(null);
                                  if (user.status === "Suspended") void changeStatus(user, "Active");
                                  else setMemberToSuspend(user);
                                }}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                              >
                                {user.status === "Suspended" ? "Reactivate Member" : "Suspend Member"}
                              </button>
                            )}
                            {user.id !== currentUser?.id && (
                              <button
                                onClick={() => {
                                  setMemberToDelete(user);
                                  setIsDeleteModalOpen(true);
                                  setActiveMenu(null);
                                }}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-t border-slate-100 dark:border-slate-800"
                              >
                                Delete Member
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isDeleteModalOpen &&
        memberToDelete &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200">
            <div className="card w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Member?</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8">
                  Are you sure you want to remove <span className="font-bold text-slate-900 dark:text-white">{memberToDelete.name}</span> from the team?
                </p>
                <div className="flex gap-4">
                  <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-6 py-3 btn-secondary">
                    Cancel
                  </button>
                  <button onClick={handleDeleteMember} disabled={saving} className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all disabled:opacity-70">
                    {saving ? "Removing…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      <ConfirmDialog
        open={!!memberToSuspend}
        title="Suspend member?"
        message={memberToSuspend ? `${memberToSuspend.name} will be signed out and can't log in until reactivated. Their tasks and history stay.` : undefined}
        confirmLabel="Suspend"
        onConfirm={() => memberToSuspend && changeStatus(memberToSuspend, "Suspended")}
        onCancel={() => setMemberToSuspend(null)}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      {children}
    </div>
  );
}
