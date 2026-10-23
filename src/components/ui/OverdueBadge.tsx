import { AlertCircle } from "lucide-react";
import { isOverdue } from "@/utils/dateUtils";

// A project is late when its end date has passed and it is still being worked on (Planning or Active);
// the same rule Reports uses for "Overdue" project health
export const projectIsOverdue = (p: { status: string; dueDate?: string | Date | null }) =>
  !["Completed", "Cancelled", "On Hold"].includes(p.status) && isOverdue(p.dueDate);

// Said in words, not only by turning the name red (colour alone is missed by many people and by screen readers)
export function OverdueBadge({ className = "" }: { className?: string }) {
  return (
    <span data-overdue className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/20 ${className}`}>
      <AlertCircle className="w-3 h-3" aria-hidden="true" />
      Overdue
    </span>
  );
}
