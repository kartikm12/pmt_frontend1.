import { lazy } from "react";

// Each page is its own download, fetched when first opened (the app used to ship as one large file)
const loaders = {
  Dashboard: () => import("./Dashboard").then((m) => ({ default: m.Dashboard })),
  Projects: () => import("./Projects").then((m) => ({ default: m.Projects })),
  ProjectDetails: () => import("./ProjectDetails").then((m) => ({ default: m.ProjectDetails })),
  Tasks: () => import("./Tasks").then((m) => ({ default: m.Tasks })),
  TaskDetails: () => import("./TaskDetails").then((m) => ({ default: m.TaskDetails })),
  Reports: () => import("./Reports").then((m) => ({ default: m.Reports })),
  Leaderboard: () => import("./Leaderboard").then((m) => ({ default: m.Leaderboard })),
  Team: () => import("./Team").then((m) => ({ default: m.Team })),
  Settings: () => import("./Settings").then((m) => ({ default: m.Settings })),
  Notifications: () => import("./Notifications").then((m) => ({ default: m.Notifications })),
  Calendar: () => import("./Calendar").then((m) => ({ default: m.Calendar })),
  Trash: () => import("./Trash").then((m) => ({ default: m.Trash })),
  AuditLog: () => import("./AuditLog").then((m) => ({ default: m.AuditLog }))
};

export const Pages = Object.fromEntries(Object.entries(loaders).map(([name, load]) => [name, lazy(load)])) as {
  [K in keyof typeof loaders]: ReturnType<typeof lazy>;
};

// After sign-in, fetch the other pages while the browser is idle so later clicks open instantly
let preloaded = false;
export function preloadPages() {
  if (preloaded) return;
  preloaded = true;
  const run = () => Object.values(loaders).forEach((load) => void load().catch(() => undefined));
  const idle = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => void) | undefined;
  if (idle) idle(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}
