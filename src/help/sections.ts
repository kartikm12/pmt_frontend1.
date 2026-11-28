// The Help menu. It follows PMT's own menu, so a guide sits where its screen does. Each page is
// content/<section>/<page>.md; its front matter says who it's for (`who: everyone | managers | admins`),
// and people only see the pages for what their role can do.

export type HelpSection = { id: string; title: string; icon: string; blurb: string; pages: string[] };

export const SECTIONS: HelpSection[] = [
  { id: "start", title: "Start here", icon: "Compass", blurb: "Signing in, finding your way, and your notifications.", pages: ["welcome", "sign-in", "find-your-way", "notifications"] },
  { id: "dashboard", title: "Dashboard", icon: "LayoutDashboard", blurb: "What the numbers on your first screen mean.", pages: ["dashboard"] },
  { id: "projects", title: "Projects", icon: "FolderKanban", blurb: "Projects, the board, the timeline, files and rules.", pages: ["projects-list", "create-a-project", "board", "board-columns", "timeline", "project-team", "files-and-activity", "rules", "finish-a-project"] },
  { id: "tasks", title: "Tasks", icon: "CheckSquare", blurb: "Create tasks, work on them, and keep track.", pages: ["create-a-task", "task-page", "checklist-and-comments", "repeating-tasks", "tasks-list"] },
  { id: "calendar", title: "Calendar", icon: "CalendarDays", blurb: "Deadlines by day, and moving them.", pages: ["calendar"] },
  { id: "reports", title: "Reports", icon: "BarChart3", blurb: "Project health, progress and overdue work.", pages: ["reports", "leaderboard"] },
  { id: "team", title: "Team", icon: "Users", blurb: "People, roles, who reports to whom, and sign-ups.", pages: ["team-list", "add-people", "roles", "reports-to", "approve-sign-ups"] },
  { id: "assets", title: "Assets", icon: "Laptop", blurb: "Company laptops, phones and cards: who has what.", pages: ["your-assets", "asset-list", "add-an-asset", "assign-and-return", "repair-lost-retire", "qr-labels"] },
  { id: "admin", title: "Recently deleted and Audit log", icon: "ShieldCheck", blurb: "Bring back deleted work, and see who did what.", pages: ["recently-deleted", "audit-log"] },
  { id: "settings", title: "Settings", icon: "Settings", blurb: "Your profile, password and emails.", pages: ["settings"] }
];
