import type { Notification } from "@/lib/api-types";

// Where a notification leads, or why it can't any more (its task or project was deleted)
export function notificationTarget(n: Notification): { to?: string; gone?: string } {
  if (n.task?.deletedAt || n.project?.deletedAt) {
    return { gone: `This ${n.task?.deletedAt ? "task" : "project"} was deleted. A manager can restore it from Recently deleted.` };
  }
  if (n.taskId) return { to: `/tasks/${n.taskId}` };
  if (n.projectId) return { to: `/projects/${n.projectId}` };
  // Asset notices open that item's page (the server says "not found" if it's no longer yours to see)
  if (n.assetId) return { to: `/assets/${n.assetId}` };
  if (n.type?.startsWith("ASSET_")) return { to: "/assets" };
  if (n.title === "Sign-up waiting for approval") return { to: "/team" };
  return {};
}
