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
  projects?: Project[];
}

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
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
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
  activity?: Activity[];
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
  project?: { id: string; name: string };
  task?: { id: string; title: string };
}
