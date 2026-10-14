import type { Notification } from "@/lib/api-types";

// Where a notification leads, or why it can't any more (its task or project was deleted)
export function notificationTarget(n: Notification): { to?: string; gone?: string } {
  if (n.task?.deletedAt || n.project?.deletedAt) {
    return { gone: `This ${n.task?.deletedAt ? "task" : "project"} was deleted. A manager can restore it from Recently deleted.` };
  }
  if (n.taskId) return { to: `/tasks/${n.taskId}` };
  if (n.projectId) return { to: `/projects/${n.projectId}` };
  if (n.title === "Sign-up waiting for approval") return { to: "/team" };
  return {};
}
