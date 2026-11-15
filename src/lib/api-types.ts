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
  reportsToId?: string | null;
  reportsTo?: { id: string; fullName: string; name?: string; email?: string } | null;
  assignedAssetsCount?: number;
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
  // Files posted with this comment (they also show in the task's Files tab)
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  fileType: string;
  fileSize: number;
  projectId?: string;
  taskId?: string;
  // Set when the file came with a comment
  commentId?: string | null;
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

// A project's own board column. stage = which of the four statuses it counts as (reports use the stage).
// Ids starting "stage:" are stand-ins for a server that has no columns yet; they're never sent back.
export interface BoardColumn {
  id: string;
  name: string;
  stage: TaskStatus;
  position: number;
}

export type RuleTrigger = "TASK_CREATED" | "MOVED_TO_COLUMN" | "ASSIGNED" | "DUE_TOMORROW" | "OVERDUE";
export type RuleActionType = "ASSIGN" | "ADD_WATCHER" | "MOVE_TO_COLUMN" | "SET_PRIORITY" | "ADD_LABEL" | "NOTIFY";
export interface ProjectRule {
  id: string;
  projectId: string;
  enabled: boolean;
  trigger: RuleTrigger;
  triggerValue: string | null;
  conditions: { priorities?: string[]; label?: string; assigneeId?: string };
  actions: { type: RuleActionType; value: string }[];
  runCount: number;
  lastRunAt: string | null;
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
  // The board column it sits in (its name is shown instead of the plain status when there is one)
  columnId?: string | null;
  columnName?: string | null;
  // The project's columns, on the task page's data (for its status picker)
  columns?: BoardColumn[];
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
  | "SYSTEM"
  | "ASSET_ASSIGNED"
  | "ASSET_RECEIPT_CONFIRMED"
  | "ASSET_PROBLEM_REPORTED"
  | "ASSET_WARRANTY_EXPIRING"
  | "ASSET_RETURN_REQUESTED"
  | "ASSET_COLLECTION_REQUIRED";

export interface Notification {
  id: string;
  userId: string;
  projectId?: string;
  taskId?: string;
  assetId?: string;
  type: NotificationType;
  title: string;
  message: string;
  body?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  project?: { id: string; name: string; deletedAt?: string | null };
  task?: { id: string; title: string; deletedAt?: string | null };
  asset?: { id: string; assetTag: string; name: string; status: string };
}

export type AssetStatus = "IN_STOCK" | "ASSIGNED" | "IN_REPAIR" | "LOST" | "RETIRED";
export type AssetCondition = "NEW" | "GOOD" | "FAIR" | "DAMAGED";
export type AssetAssignmentReceiptStatus = "PENDING" | "CONFIRMED";
export type AssetAssignmentCollectionStatus = "NONE" | "PENDING_COLLECTION" | "COLLECTED";
export type AssetEventType =
  | "CREATED"
  | "UPDATED"
  | "ASSIGNED"
  | "RECEIPT_CONFIRMED"
  | "RETURNED"
  | "MARKED_FOR_REPAIR"
  | "REPAIR_COMPLETED"
  | "MARKED_LOST"
  | "RETIRED"
  | "DELETED"
  | "RESTORED"
  | "PROBLEM_REPORTED"
  | "COLLECTION_REQUESTED";

export interface AssetCategory {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isCustom: boolean;
  _count?: { assets: number };
}

export interface AssetFile {
  id: string;
  assetId: string;
  name: string;
  url: string;
  downloadUrl?: string;
  mimeType: string;
  fileSize: number;
  uploadedById: string;
  createdAt: string;
}

export interface AssetAssignment {
  id: string;
  assetId: string;
  userId: string;
  projectId?: string | null;
  assignedById: string;
  assignedAt: string;
  assignmentCondition: AssetCondition;
  notes?: string | null;
  receiptStatus: AssetAssignmentReceiptStatus;
  receiptConfirmedAt?: string | null;
  returnedAt?: string | null;
  returnCondition?: AssetCondition | null;
  returnRemarks?: string | null;
  returnDisposition?: string | null;
  collectionStatus: AssetAssignmentCollectionStatus;
  collectionNotes?: string | null;
  isCurrent: boolean;
  user?: User;
}

export interface AssetEvent {
  id: string;
  assetId: string;
  eventType: AssetEventType;
  performedById?: string | null;
  title: string;
  description: string;
  metadata?: any;
  createdAt: string;
  performedBy?: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
    role: string;
  } | null;
}

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  categoryId: string;
  category?: AssetCategory;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  specifications?: string | null;
  condition: AssetCondition;
  status: AssetStatus;
  location?: string | null;
  purchaseDate?: string | null;
  purchaseCost?: number | null;
  vendorName?: string | null;
  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
  currentHolderId?: string | null;
  currentHolder?: User | null;
  projectId?: string | null;
  project?: Project | null;
  createdById: string;
  createdBy?: { id: string; fullName: string };
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  activeAssignment?: AssetAssignment | null;
  files?: AssetFile[];
}

export interface AssetSummary {
  totalAssets: number;
  assigned: number;
  inStock: number;
  inRepair: number;
  lost: number;
  retired: number;
}

