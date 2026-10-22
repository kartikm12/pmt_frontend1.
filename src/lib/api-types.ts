export type UserStatus = "Active" | "Invited" | "Offline" | "Suspended";
export type UserRole =
  | "Manager"
  | "Team Member"
  | "Developer"
  | "Designer"
  | "Tester"
  | "Support Engineer"
  | "Business Analyst"
  | "Project Manager"
  | "Admin";
export type ProjectStatus = "Planning" | "Active" | "On Hold" | "Completed" | "Cancelled";
export type TaskStatus = "To Do" | "In Progress" | "Review" | "Completed";
export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string | null;
  bio?: string;
  phone?: string;
  title?: string;
  roleLocked?: boolean;
  status?: UserStatus;
  emailNotifications?: boolean;
  // Only filled for the signed-in person (from /auth/me)
  passwordChangedAt?: string | null;
  projects?: Project[];
}

// What the signed-in person may do in one project (from the server; company-wide managers are "manager" everywhere)
export type ProjectRole = "manager" | "contributor" | "viewer";
export type MembershipRole = "OWNER" | "MANAGER" | "CONTRIBUTOR" | "VIEWER";
// A repeat rule (see lib/repeat.ts), e.g. "FREQ=WEEKLY;BYDAY=WE"; older tasks may still say DAILY / WEEKLY / MONTHLY
export type Recurrence = string;

export interface Project {
  id: string;
  name: string;
  description: string;
  managerId: string;
  startDate: string;
  dueDate: string;
  teamMemberIds: string[];
  status: ProjectStatus;
  attachments?: Attachment[];
  myRole?: ProjectRole;
  memberRoles?: Record<string, MembershipRole>;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface TimeEntry {
  id: string;
  minutes: number;
  note?: string | null;
  spentOn: string;
  user?: { id: string; fullName: string; avatarUrl?: string | null };
}

export interface TaskLink {
  id: string;
  title: string;
  status: string;
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  user?: User;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  fileType: string;
  fileSize: number;
  projectId?: string;
  taskId?: string;
  userId: string;
  createdAt: string;
  user?: User;
}

export interface Activity {
  id: string;
  userId: string;
  type: string;
  details: string;
  createdAt: string;
  user?: User;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assigneeIds: string[];
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
  project?: Project;
  assignees?: User[];
  comments?: Comment[];
  attachments?: Attachment[];
  // Number of files, from the task page's own data (before the Files section loads them)
  attachmentCount?: number;
  activity?: Activity[];
  labels: string[];
  estimateHours?: number | null;
  startDate?: string | null;
  recurrence?: Recurrence | null;
  subtaskTotal?: number;
  subtaskDone?: number;
  subtasks?: Subtask[];
  blockedBy?: TaskLink[];
  blocks?: TaskLink[];
  watchers?: User[];
  timeEntries?: TimeEntry[];
  myRole?: ProjectRole | null;
  createdAt?: string;
  createdByName?: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
  title?: string | null;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  productivityScore: number;
  onTimeRate: number;
  score: number;
  badges: string[];
}

export type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_DUE_SOON"
  | "TASK_OVERDUE"
  | "PROJECT_UPDATED"
  | "TEAM_INVITE"
  | "COMMENT_MENTION"
  | "SYSTEM";

export interface Notification {
  id: string;
  userId: string;
  projectId?: string;
  taskId?: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  project?: { id: string; name: string; deletedAt?: string | null };
  task?: { id: string; title: string; deletedAt?: string | null };
}
