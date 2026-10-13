import type { Recurrence, Task } from "./api-types";
import type { PlanningPayload } from "./api";
import { safeFormat } from "@/utils/dateUtils";

// Form state for the task planning fields (strings, as the inputs hold them)
export interface PlanningState {
  labels: string[];
  estimateHours: string;
  startDate: string;
  recurrence: "" | Recurrence;
  milestoneId: string;
  blockedByIds: string[];
}

export const emptyPlanning: PlanningState = { labels: [], estimateHours: "", startDate: "", recurrence: "", milestoneId: "", blockedByIds: [] };

export function planningFromTask(task: Task): PlanningState {
  return {
    labels: task.labels ?? [],
    estimateHours: task.estimateHours != null ? String(task.estimateHours) : "",
    startDate: task.startDate ? safeFormat(task.startDate, "yyyy-MM-dd", "") : "",
    recurrence: task.recurrence ?? "",
    milestoneId: task.milestoneId ?? "",
    blockedByIds: task.blockedBy?.map((b) => b.id) ?? []
  };
}

export function planningToPayload(p: PlanningState): PlanningPayload {
  const hours = p.estimateHours.trim() === "" ? null : Number(p.estimateHours);
  return {
    labels: p.labels,
    estimateHours: hours !== null && Number.isFinite(hours) ? hours : null,
    startDate: p.startDate || null,
    recurrence: p.recurrence || null,
    milestoneId: p.milestoneId || null,
    blockedByIds: p.blockedByIds
  };
}

// Problems the form can catch before saving (the server re-checks)
export function planningError(p: PlanningState, dueDate?: string): string | null {
  if (p.estimateHours.trim() !== "") {
    const h = Number(p.estimateHours);
    if (!Number.isFinite(h) || h < 0 || h > 1000) return "Estimate must be between 0 and 1000 hours.";
  }
  if (p.startDate && dueDate && p.startDate > dueDate) return "Start date must be on or before the deadline.";
  return null;
}

// Status words the board uses, for "blocked by" warnings
export function openBlockers(task: Pick<Task, "blockedBy">) {
  return (task.blockedBy ?? []).filter((b) => b.status !== "DONE" && b.status !== "Completed");
}
