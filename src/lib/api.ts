import type {
  Activity,
  Comment,
  LeaderboardEntry,
  Project,
  Task,
  TaskPriority,
  TaskStatus,
  User,
  Attachment,
  MembershipRole,
  Milestone,
  ProjectRole,
  Recurrence,
  Subtask,
  TaskLink,
  TimeEntry
} from "./api-types";

const getApiBaseUrl = () => {
  // Accept the backend address with or without "/api" (and a trailing slash); every route lives under /api
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/+$/, "").replace(/(\/api)?$/, "/api");
  let hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${hostname}:4000/api`;
  }
  return `/api`;
};

export const API_BASE_URL = getApiBaseUrl();
const TOKEN_KEY = "authToken";
const SESSION_EXPIRED_MESSAGE = "Session expired. Logged in from another device.";

export type RawUser = {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  bio?: string | null;
  phone?: string | null;
  title?: string | null;
  role:
    | "MANAGER"
    | "TEAM_MEMBER"
    | "DEVELOPER"
    | "DESIGNER"
    | "TESTER"
    | "SUPPORT_ENGINEER"
    | "BUSINESS_ANALYST"
    | "PROJECT_MANAGER"
    | "ADMIN";
  roleLocked?: boolean;
  status?: "ACTIVE" | "INVITED" | "OFFLINE" | "SUSPENDED";
  emailNotifications?: boolean;
};

export type RawProject = {
  id: string;
  name: string;
  description?: string | null;
  managerId: string;
  startDate?: string | null;
  dueDate?: string | null;
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  members?: Array<{ userId: string; role?: MembershipRole; user?: RawUser }>;
  manager?: RawUser;
  myRole?: ProjectRole;
  milestones?: Milestone[];
};

export type RawTask = {
  id: string;
  createdBy?: { id: string; fullName: string } | null;
  projectId: string;
  title: string;
  description?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string | null;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  project?: RawProject;
  assignees?: RawUser[];
  watchers?: RawUser[];
  comments?: Array<{
    id: string;
    userId: string;
    body: string;
    createdAt: string;
    updatedAt?: string;
    user?: RawUser;
  }>;
  labels?: string[];
  estimateHours?: number | null;
  startDate?: string | null;
  recurrence?: Recurrence | null;
  milestoneId?: string | null;
  milestone?: Milestone | null;
  subtaskTotal?: number;
  subtaskDone?: number;
  subtasks?: Subtask[];
  blockedBy?: TaskLink[];
  blocks?: TaskLink[];
  timeEntries?: TimeEntry[];
  myRole?: ProjectRole | null;
  createdAt?: string;
};

type RawActivity = {
  id: string;
  userId?: string | null;
  action: string;
  description: string;
  createdAt: string;
  user?: RawUser;
};

export function createAvatar(name: string, avatarUrl?: string | null) {
  const trimmedUrl = avatarUrl?.trim();
  if (trimmedUrl && trimmedUrl.length > 0) {
    if (trimmedUrl.startsWith("/uploads/")) {
      return `${API_BASE_URL.replace("/api", "")}${trimmedUrl}`;
    }
    return trimmedUrl;
  }
  return null;
}

const REVERSE_ROLE_MAP: Record<User["role"], RawUser["role"]> = {
  Manager: "MANAGER",
  "Team Member": "TEAM_MEMBER",
  Developer: "DEVELOPER",
  Designer: "DESIGNER",
  Tester: "TESTER",
  "Support Engineer": "SUPPORT_ENGINEER",
  "Business Analyst": "BUSINESS_ANALYST",
  "Project Manager": "PROJECT_MANAGER",
  Admin: "ADMIN"
};

export function mapUser(raw: RawUser): User {
  const roleMap: Record<RawUser["role"], User["role"]> = {
    MANAGER: "Manager",
    TEAM_MEMBER: "Team Member",
    DEVELOPER: "Developer",
    DESIGNER: "Designer",
    TESTER: "Tester",
    SUPPORT_ENGINEER: "Support Engineer",
    BUSINESS_ANALYST: "Business Analyst",
    PROJECT_MANAGER: "Project Manager",
    ADMIN: "Admin"
  };

  return {
    id: raw.id,
    name: raw.fullName,
    email: raw.email,
    role: roleMap[raw.role],
    roleLocked: raw.roleLocked,
    emailNotifications: raw.emailNotifications,
    avatar: createAvatar(raw.fullName, raw.avatarUrl),
    bio: raw.bio ?? undefined,
    phone: raw.phone ?? undefined,
    title: raw.title ?? undefined,
    status:
      raw.status === "ACTIVE"
        ? "Active"
        : raw.status === "INVITED"
          ? "Invited"
          : raw.status === "SUSPENDED"
            ? "Suspended"
            : "Offline"
  };
}

function mapProjectStatus(status: RawProject["status"]): Project["status"] {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "COMPLETED":
      return "Completed";
    case "ON_HOLD":
      return "On Hold";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "Planning";
  }
}

function mapTaskStatus(status: RawTask["status"]): TaskStatus {
  switch (status) {
    case "IN_PROGRESS":
      return "In Progress";
    case "REVIEW":
      return "Review";
    case "DONE":
      return "Completed";
    default:
      return "To Do";
  }
}

function mapTaskPriority(priority: RawTask["priority"]): TaskPriority {
  switch (priority) {
    case "LOW":
      return "Low";
    case "HIGH":
      return "High";
    case "URGENT":
      return "Urgent";
    default:
      return "Medium";
  }
}

function toApiProjectStatus(status: Project["status"]) {
  switch (status) {
    case "Active":
      return "ACTIVE";
    case "Completed":
      return "COMPLETED";
    case "On Hold":
      return "ON_HOLD";
    case "Cancelled":
      return "CANCELLED";
    default:
      return "PLANNING";
  }
}

function toApiTaskStatus(status: TaskStatus) {
  switch (status) {
    case "In Progress":
      return "IN_PROGRESS";
    case "Review":
      return "REVIEW";
    case "Completed":
      return "DONE";
    default:
      return "TODO";
  }
}

function toApiTaskPriority(priority: TaskPriority) {
  switch (priority) {
    case "Low":
      return "LOW";
    case "High":
      return "HIGH";
    case "Urgent":
      return "URGENT";
    default:
      return "MEDIUM";
  }
}

export function mapProject(raw: RawProject): Project {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    managerId: raw.managerId,
    startDate: raw.startDate ?? new Date().toISOString(),
    dueDate: raw.dueDate ?? new Date().toISOString(),
    teamMemberIds: raw.members?.map((member) => member.userId) ?? [],
    status: mapProjectStatus(raw.status),
    myRole: raw.myRole,
    milestones: raw.milestones,
    memberRoles: Object.fromEntries((raw.members ?? []).filter((m) => m.role).map((m) => [m.userId, m.role!]))
  };
}

export function mapTask(raw: RawTask): Task {
  return {
    id: raw.id,
    projectId: raw.projectId,
    title: raw.title,
    description: raw.description ?? "",
    assigneeIds: raw.assignees?.map(a => a.id) ?? [],
    priority: raw.priority.charAt(0) + raw.priority.slice(1).toLowerCase() as any,
    dueDate: raw.dueDate ?? "",
    status: raw.status === "TODO" ? "To Do" : raw.status === "IN_PROGRESS" ? "In Progress" : raw.status === "REVIEW" ? "Review" : "Completed",
    project: raw.project ? mapProject(raw.project) : undefined,
    assignees: raw.assignees?.map(mapUser),
    comments: raw.comments?.map(
      (comment): Comment => ({
        id: comment.id,
        userId: comment.userId,
        text: comment.body,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        user: comment.user ? mapUser(comment.user) : undefined
      })
    ),
    attachments: (raw as any).attachments || [],
    labels: raw.labels ?? [],
    estimateHours: raw.estimateHours ?? null,
    startDate: raw.startDate ?? null,
    recurrence: raw.recurrence ?? null,
    milestoneId: raw.milestoneId ?? null,
    milestone: raw.milestone ?? null,
    subtaskTotal: raw.subtaskTotal ?? raw.subtasks?.length ?? 0,
    subtaskDone: raw.subtaskDone ?? raw.subtasks?.filter((s) => s.done).length ?? 0,
    subtasks: raw.subtasks,
    blockedBy: raw.blockedBy ?? [],
    blocks: raw.blocks ?? [],
    watchers: raw.watchers?.map(mapUser),
    timeEntries: raw.timeEntries,
    myRole: raw.myRole ?? null,
    createdAt: raw.createdAt,
    createdByName: raw.createdBy?.fullName
  };
}

function mapDueDate(dueDate?: string | null) {
  if (!dueDate) return new Date().toISOString();
  try {
    return new Date(dueDate).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function mapActivity(raw: RawActivity): Activity {
  return {
    id: raw.id,
    userId: raw.userId ?? "",
    type: raw.action.toLowerCase(),
    details: raw.description,
    createdAt: raw.createdAt,
    user: raw.user ? mapUser(raw.user) : undefined
  };
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// Turn the server's zod output into one sentence, e.g. "Full name: String must contain at least 2 character(s)"
function readableError(data: any): string {
  const fieldErrors: Record<string, string[]> | undefined = data?.issues?.fieldErrors;
  const first = fieldErrors && Object.entries(fieldErrors).find(([, messages]) => messages?.length);
  if (first) {
    const label = first[0].replace(/Ids?$/, "").replace(/([A-Z])/g, " $1").toLowerCase().trim();
    return `${label.charAt(0).toUpperCase()}${label.slice(1)}: ${first[1][0]}`;
  }
  return data?.issues?.formErrors?.[0] || data?.message || "Request failed";
}

// Files now live in Supabase (absolute URLs); only old local uploads are server-relative
export function fileUrl(url: string) {
  return /^https?:\/\//.test(url) ? url : `${API_BASE_URL.replace(/\/api$/, "")}${url}`;
}

// A change already on its way is never sent twice: a repeat click on Save/Delete/Invite while the first
// request is still running gets that same request's answer instead of firing a duplicate
const inFlight = new Map<string, Promise<unknown>>();

function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  if (method === "GET" || (options.body !== undefined && typeof options.body !== "string")) return send<T>(path, options);
  const key = `${method} ${path} ${options.body ?? ""}`;
  const running = inFlight.get(key);
  if (running) return running as Promise<T>;
  const p = send<T>(path, options).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

async function send<T>(path: string, options: RequestInit = {}) {
  const token = getStoredToken();
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const error: any = new Error(readableError(data));
    error.issues = data?.issues;
    error.status = response.status;

    // Any 401 on a signed-in request means the session is gone (expired, replaced, or account removed)
    if (response.status === 401 && token) {
      window.dispatchEvent(
        new CustomEvent("auth:session-expired", {
          detail: {
            message: data?.message === SESSION_EXPIRED_MESSAGE
              ? "Your account was logged in from another device."
              : /suspended|removed from the workspace/i.test(data?.message ?? "")
                ? data.message
                : "Your session has ended. Please sign in again."
          }
        })
      );
    }

    throw error;
  }

  if (data && typeof data === "object" && "data" in data && "meta" in data) {
    return data.data as T;
  }

  return data as T;
}

// Planning fields shared by task create/update; undefined = "leave as is"
export type PlanningPayload = {
  labels?: string[];
  estimateHours?: number | null;
  startDate?: string | null;
  recurrence?: Recurrence | null;
  milestoneId?: string | null;
  blockedByIds?: string[];
};

function planningBody(p: PlanningPayload) {
  return {
    labels: p.labels,
    estimateHours: p.estimateHours,
    startDate: p.startDate === undefined ? undefined : p.startDate ? new Date(p.startDate).toISOString() : null,
    recurrence: p.recurrence,
    milestoneId: p.milestoneId,
    blockedByIds: p.blockedByIds
  };
}

export function mapAttachment(raw: any): Attachment {
  return {
    id: raw.id,
    name: raw.name,
    url: raw.url,
    fileType: raw.fileType,
    fileSize: raw.fileSize,
    projectId: raw.projectId,
    taskId: raw.taskId,
    userId: raw.userId,
    createdAt: raw.createdAt,
    user: raw.user ? mapUser(raw.user) : undefined
  };
}

export const api = {
  async login(email: string, password: string) {
    const response = await request<{ token: string; user: RawUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    setStoredToken(response.token);
    return { token: response.token, user: mapUser(response.user) };
  },

  // After the first account, sign-ups wait for a manager: the server answers { pending: true } and no token
  async register(fullName: string, email: string, password: string) {
    const response = await request<{ token: string | null; user: RawUser; pending?: boolean; message?: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ fullName, email, password })
    });
    if (response.pending || !response.token) {
      return { pending: true as const, message: response.message ?? "Your account is waiting for a manager's approval." };
    }
    setStoredToken(response.token);
    return { pending: false as const, token: response.token, user: mapUser(response.user) };
  },

  async forgotPassword(email: string) {
    return request<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
  },

  async resetPassword(token: string, password: string) {
    return request<{ message: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
  },

  async getPendingSignups() {
    return request<Array<{ id: string; fullName: string; email: string; createdAt: string }>>("/team/pending");
  },

  async approveSignup(userId: string, role: User["role"]) {
    return request(`/team/${userId}/approve`, { method: "POST", body: JSON.stringify({ role: REVERSE_ROLE_MAP[role] }) });
  },

  async rejectSignup(userId: string) {
    return request(`/team/${userId}/pending`, { method: "DELETE" });
  },

  async me() {
    const response = await request<RawUser>("/auth/me");
    return mapUser(response);
  },

  async logout() {
    return request<{ success: boolean }>("/auth/logout", {
      method: "POST"
    });
  },

  async updateMe(payload: {
    fullName?: string;
    email?: string;
    bio?: string;
    phone?: string;
    title?: string;
    avatarUrl?: string | null;
    emailNotifications?: boolean;
  }) {
    const response = await request<RawUser>("/users/me", {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    return mapUser(response);
  },

  async updatePassword(payload: { currentPassword: string; newPassword: string }) {
    return request<{ success: boolean }>("/users/me/password", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },

  async getProjects() {
    const response = await request<RawProject[]>("/projects");
    return response.map(mapProject);
  },

  async getProject(projectId: string) {
    return request<RawProject & { tasks: RawTask[]; members: Array<{ userId: string; user: RawUser }> }>(`/projects/${projectId}`);
  },

  async getProjectBundle(id: string): Promise<{ project: Project; tasks: Task[]; users: User[] }> {
    const data = await request<{ project: RawProject & { attachments?: any[] }; tasks: RawTask[]; users: RawUser[] }>(`/projects/${id}/bundle`);
    return {
      project: { ...mapProject(data.project), attachments: data.project.attachments || [] },
      tasks: data.tasks.map(mapTask),
      users: data.users.map(mapUser)
    };
  },

  async getComprehensiveReport(filters: { days?: number; projectId?: string; memberId?: string } = {}) {
    const params = new URLSearchParams();
    if (filters.days) params.append("days", filters.days.toString());
    if (filters.projectId) params.append("projectId", filters.projectId);
    if (filters.memberId) params.append("memberId", filters.memberId);
    
    const query = params.toString() ? `?${params.toString()}` : "";
    return request<{
      kpis: {
        activeProjects: number;
        completedTasks: number;
        pendingTasks: number;
        overdueTasks: number;
      };
      trends: { name: string; completed: number; new: number }[];
      statusData: { name: string; value: number }[];
      projectProgress: { name: string; completed: number; pending: number; total: number }[];
      overdueTasks: (RawTask & { assignees: RawUser[] })[];
      teamPerformance: { user: RawUser; completed: number; inProgress: number; total: number }[];
      workloadDistribution: { name: string; taskCount: number }[];
      recentActivity: RawActivity[];
    }>(`/stats/reports${query}`);
  },

  async getDashboardStats() {
    return request<{
      stats: {
        activeProjects: number;
        totalProjects: number;
        pendingProjects: number;
        completedProjects: number;
        pendingTasks: number;
        completedTasks: number;
        totalTasks: number;
        overdueTasks: number;
      };
      recentTasks: RawTask[];
      upcomingDeadlines: RawTask[];
    }>("/stats/dashboard");
  },

  async getNotifications() {
    return request<Notification[]>("/notifications");
  },

  async markNotificationAsRead(id: string) {
    return request<Notification>(`/notifications/${id}/read`, {
      method: "PATCH"
    });
  },

  async markAllNotificationsAsRead() {
    return request<{ count: number }>("/notifications/read-all", {
      method: "POST"
    });
  },

  async deleteNotification(id: string) {
    return request(`/notifications/${id}`, {
      method: "DELETE"
    });
  },

  async createProject(payload: {
    name: string;
    description: string;
    startDate: string;
    dueDate: string;
    managerId: string;
    memberIds?: string[];
    copyFromProjectId?: string;
  }) {
    const response = await request<RawProject>("/projects", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        status: "ACTIVE"
      })
    });

    return mapProject(response);
  },

  async updateProject(projectId: string, payload: Partial<Project> & { managerId?: string }) {
    const response = await request<RawProject>(`/projects/${projectId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: payload.name,
        description: payload.description,
        status: payload.status ? toApiProjectStatus(payload.status) : undefined,
        startDate: payload.startDate,
        dueDate: payload.dueDate,
        managerId: payload.managerId,
        memberIds: payload.teamMemberIds
      })
    });

    return mapProject(response);
  },

  async deleteProject(projectId: string) {
    return request<{ success: boolean }>(`/projects/${projectId}`, {
      method: "DELETE"
    });
  },

  async assignProjectMembers(projectId: string, memberIds: string[]) {
    return request(`/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify({ memberIds })
    });
  },

  async getTasks(projectId?: string) {
    const suffix = projectId ? `?projectId=${projectId}` : "";
    const response = await request<RawTask[]>(`/tasks${suffix}`);
    return response.map(mapTask);
  },

  async getTask(taskId: string) {
    const response = await request<RawTask>(`/tasks/${taskId}`);
    return mapTask(response);
  },

  async createTask(payload: {
    title: string;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate: string;
    projectId: string;
    assigneeIds?: string[];
  } & PlanningPayload) {
    const response = await request<RawTask>("/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: payload.title,
        description: payload.description,
        priority: toApiTaskPriority(payload.priority),
        status: toApiTaskStatus(payload.status),
        dueDate: payload.dueDate ? new Date(payload.dueDate).toISOString() : undefined,
        projectId: payload.projectId,
        assigneeIds: payload.assigneeIds || [],
        ...planningBody(payload)
      })
    });

    return mapTask(response);
  },

  async updateTask(taskId: string, payload: Partial<Omit<Task, keyof PlanningPayload>> & PlanningPayload) {
    const response = await request<RawTask>(`/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify({
        title: payload.title,
        description: payload.description,
        priority: payload.priority ? toApiTaskPriority(payload.priority) : undefined,
        status: payload.status ? toApiTaskStatus(payload.status) : undefined,
        dueDate: payload.dueDate ? new Date(payload.dueDate).toISOString() : undefined,
        projectId: payload.projectId,
        assigneeIds: payload.assigneeIds,
        ...planningBody(payload)
      })
    });

    return mapTask(response);
  },

  // ----- 14 Oct feature pack -----
  async setMemberRole(projectId: string, userId: string, role: MembershipRole) {
    return request(`/projects/${projectId}/members/${userId}`, { method: "PATCH", body: JSON.stringify({ role }) });
  },

  async saveMilestone(projectId: string, milestone: { id?: string; name: string; dueDate?: string | null }) {
    const body = JSON.stringify({ name: milestone.name, dueDate: milestone.dueDate ? new Date(milestone.dueDate).toISOString() : null });
    return milestone.id
      ? request<Milestone>(`/projects/${projectId}/milestones/${milestone.id}`, { method: "PATCH", body })
      : request<Milestone>(`/projects/${projectId}/milestones`, { method: "POST", body });
  },

  async deleteMilestone(projectId: string, milestoneId: string) {
    return request(`/projects/${projectId}/milestones/${milestoneId}`, { method: "DELETE" });
  },

  async addSubtask(taskId: string, title: string) {
    return request<Subtask>(`/tasks/${taskId}/subtasks`, { method: "POST", body: JSON.stringify({ title }) });
  },

  async updateSubtask(subtaskId: string, changes: { title?: string; done?: boolean }) {
    return request<Subtask>(`/tasks/subtasks/${subtaskId}`, { method: "PATCH", body: JSON.stringify(changes) });
  },

  async deleteSubtask(subtaskId: string) {
    return request(`/tasks/subtasks/${subtaskId}`, { method: "DELETE" });
  },

  async logTime(taskId: string, entry: { minutes: number; note?: string; spentOn?: string }) {
    return request<TimeEntry>(`/tasks/${taskId}/time`, { method: "POST", body: JSON.stringify(entry) });
  },

  async deleteTimeEntry(entryId: string) {
    return request(`/tasks/time/${entryId}`, { method: "DELETE" });
  },

  async setWatching(taskId: string, watch: boolean) {
    return request<{ watching: boolean }>(`/tasks/${taskId}/watch`, { method: watch ? "POST" : "DELETE" });
  },

  async reorderTasks(projectId: string, status: TaskStatus, orderedIds: string[]) {
    return request(`/tasks/reorder`, { method: "POST", body: JSON.stringify({ projectId, status: toApiTaskStatus(status), orderedIds }) });
  },

  // Every dated milestone you can see, in one request (the Calendar)
  async getMilestones() {
    return request<Array<Milestone & { projectId: string; projectName: string }>>("/projects/milestones");
  },

  async getTrash() {
    return request<{
      projects: Array<{ id: string; name: string; deletedAt: string; _count: { tasks: number } }>;
      tasks: Array<{ id: string; title: string; deletedAt: string; project: { id: string; name: string } }>;
    }>("/projects/trash");
  },

  async restoreProject(projectId: string) {
    return request(`/projects/${projectId}/restore`, { method: "POST" });
  },

  async restoreTask(taskId: string) {
    return request(`/tasks/${taskId}/restore`, { method: "POST" });
  },

  async search(q: string) {
    return request<{
      tasks: Array<{ id: string; title: string; status: string; project: { id: string; name: string } }>;
      projects: Array<{ id: string; name: string; status: string }>;
      people: Array<{ id: string; fullName: string; email: string; title?: string | null; avatarUrl?: string | null }>;
    }>(`/search?q=${encodeURIComponent(q)}`);
  },

  async getWorkload() {
    return request<Array<{
      userId: string; fullName: string; title?: string | null; avatarUrl?: string | null;
      openTasks: number; overdueTasks: number; estimatedHours: number; loggedHoursThisWeek: number;
    }>>("/stats/workload");
  },

  async getAuditLog(filters: { userId?: string; projectId?: string; action?: string; from?: string; to?: string; skip?: number; limit?: number }) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== "") params.append(k, String(v));
    return request<Array<RawActivity & { project?: { id: string; name: string } | null }>>(`/activity?${params.toString()}`);
  },

  async deleteTask(taskId: string) {
    return request<{ success: boolean }>(`/tasks/${taskId}`, {
      method: "DELETE"
    });
  },

  async getActivity(query = "") {
    const response = await request<RawActivity[]>(`/activity${query}`);
    return response.map(mapActivity);
  },

  async getTeam(): Promise<User[]> {
    const response = await request<Array<RawUser & { memberships?: Array<{ project: RawProject }> }>>("/team");
    return response.map((member) => ({
      ...mapUser(member),
      projects: member.memberships?.map((membership) => mapProject(membership.project)) ?? []
    }));
  },

  async inviteTeamMember(payload: {
    fullName: string;
    email: string;
    password: string;
    role?: User["role"];
    title?: string;
    projectId?: string;
  }) {
    return request("/team", {
      method: "POST",
      body: JSON.stringify({
        fullName: payload.fullName,
        email: payload.email,
        password: payload.password,
        role: payload.role ? REVERSE_ROLE_MAP[payload.role] : undefined,
        title: payload.title,
        projectId: payload.projectId
      })
    });
  },

  async deleteTeamMember(userId: string) {
    return request<{ success: boolean }>(`/team/${userId}`, {
      method: "DELETE"
    });
  },

  async updateTeamMember(
    userId: string,
    payload: {
      fullName?: string;
      role?: User["role"];
      title?: string;
      status?: "Active" | "Suspended";
      projectId?: string;
    }
  ) {
    const roleMap: Record<User["role"], RawUser["role"]> = {
      Manager: "MANAGER",
      "Team Member": "TEAM_MEMBER",
      Developer: "DEVELOPER",
      Designer: "DESIGNER",
      Tester: "TESTER",
      "Support Engineer": "SUPPORT_ENGINEER",
      "Business Analyst": "BUSINESS_ANALYST",
      "Project Manager": "PROJECT_MANAGER",
      Admin: "ADMIN"
    };

    return request(`/team/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({
        fullName: payload.fullName,
        role: payload.role ? roleMap[payload.role] : undefined,
        title: payload.title,
        status: payload.status ? payload.status.toUpperCase() : undefined,
        projectId: payload.projectId
      })
    });
  },

  async getLeaderboard(filters: { range?: number; projectId?: string } = {}) {
    const params = new URLSearchParams();
    if (filters.range) params.append("range", filters.range.toString());
    if (filters.projectId) params.append("projectId", filters.projectId);

    const query = params.toString() ? `?${params.toString()}` : "";
    return request<LeaderboardEntry[]>(`/leaderboard${query}`);
  },

  async postComment(taskId: string, body: string) {
    return request<Comment>(`/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body })
    });
  },

  async updateComment(commentId: string, body: string) {
    return request<{ id: string; body: string; updatedAt: string }>(`/tasks/comments/${commentId}`, {
      method: "PATCH",
      body: JSON.stringify({ body })
    });
  },

  async deleteComment(commentId: string) {
    return request(`/tasks/comments/${commentId}`, { method: "DELETE" });
  },

  mapActivity,
  mapTask,
  mapProject,
  mapUser,

  // Attachment methods
  async uploadAttachment(file: File, projectId?: string, taskId?: string): Promise<Attachment> {
    const formData = new FormData();
    formData.append("file", file);
    if (projectId) formData.append("projectId", projectId);
    if (taskId) formData.append("taskId", taskId);

    const token = getStoredToken();
    const response = await fetch(`${API_BASE_URL}/attachments/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to upload file");
    }

    return mapAttachment(await response.json());
  },

  async getAttachments(projectId?: string, taskId?: string): Promise<Attachment[]> {
    const params = new URLSearchParams();
    if (projectId) params.append("projectId", projectId);
    if (taskId) params.append("taskId", taskId);
    const response = await request<any[]>(`/attachments?${params.toString()}`);
    return response.map(mapAttachment);
  },

  async deleteAttachment(id: string): Promise<void> {
    await request(`/attachments/${id}`, { method: "DELETE" });
  },

  async uploadAvatar(file: File): Promise<RawUser> {
    const formData = new FormData();
    formData.append("avatar", file);

    const token = getStoredToken();
    const response = await fetch(`${API_BASE_URL}/users/me/avatar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to upload avatar");
    }

    return response.json();
  }
};
