import { useEffect } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import type { Asset, AssetStatus, User } from "@/lib/api-types";
import { cn } from "@/lib/utils";

// Shared words and colours for the asset screens, so the list, the item page and "Your assets" agree.

export const STATUS_LABEL: Record<AssetStatus, string> = {
  IN_STOCK: "In stock",
  ASSIGNED: "Assigned",
  IN_REPAIR: "In repair",
  LOST: "Lost",
  RETIRED: "Retired"
};

const STATUS_TONE: Record<AssetStatus, string> = {
  IN_STOCK: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  ASSIGNED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  IN_REPAIR: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  LOST: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  RETIRED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
};

export const CONDITION_LABEL: Record<string, string> = { NEW: "New", GOOD: "Good", FAIR: "Fair", DAMAGED: "Damaged" };

export type AssetRow = Asset & {
  activeAssignment?: { receiptStatus?: string; collectionStatus?: string; assignedAt?: string; receiptConfirmedAt?: string | null } | null;
};

// What the status pill should say: the hand-over steps matter more than the plain status
export function statusOf(a: AssetRow): { label: string; tone: string; key: string } {
  const asg = a.activeAssignment;
  if (asg?.collectionStatus === "PENDING_COLLECTION") return { key: "collect", label: "To collect", tone: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" };
  if (a.status === "ASSIGNED" && asg?.receiptStatus === "PENDING") return { key: "unconfirmed", label: "Not confirmed", tone: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" };
  return { key: a.status, label: STATUS_LABEL[a.status] ?? a.status, tone: STATUS_TONE[a.status] ?? STATUS_TONE.IN_STOCK };
}

export function StatusPill({ asset, className }: { asset: AssetRow; className?: string }) {
  const s = statusOf(asset);
  return <span data-asset-status={s.key} className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", s.tone, className)}>{s.label}</span>;
}

// "Mar 2027", "in 24 days" (warning), "Ended 3 Jan 2026"
export function warrantyText(end?: string | null): { text: string; warn: boolean } | null {
  if (!end) return null;
  const d = new Date(end);
  const left = differenceInCalendarDays(d, new Date());
  if (left < 0) return { text: `Ended ${format(d, "d MMM yyyy")}`, warn: true };
  if (left <= 30) return { text: left === 0 ? "Ends today" : `Ends in ${left} day${left === 1 ? "" : "s"}`, warn: true };
  return { text: format(d, "MMM yyyy"), warn: false };
}

export const holderName = (a: Asset) => (a.currentHolder as unknown as { fullName?: string; name?: string } | null)?.fullName ?? a.currentHolder?.name ?? "";

export const describeItem = (a: Asset) => [a.brand, a.model].filter(Boolean).join(" ") || a.category?.name || "";

// The people a manager may hand things to: everyone below them in the "Reports to" chain, plus themselves.
// Admins may hand to anyone. (The server checks the same rule; this keeps the pickers honest.)
export function assignablePeople(people: User[], me: { id: string; role?: string } | null | undefined): User[] {
  if (!me) return [];
  const active = people.filter((p) => p.status !== "Suspended");
  if (me.role === "Admin") return active;
  const below = new Set<string>([me.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of people) {
      if (p.reportsToId && below.has(p.reportsToId) && !below.has(p.id)) {
        below.add(p.id);
        grew = true;
      }
    }
  }
  return active.filter((p) => below.has(p.id));
}

// Escape closes a form, like every other dialog in PMT (the copied asset forms didn't)
export function useEscapeToClose(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}
