import React, { useState } from "react";
import { Timer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { TimeEntry } from "@/lib/api-types";
import { safeFormat } from "@/utils/dateUtils";

const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

// Hours spent on a task against its estimate; contributors log their own time
export function TimeLog({ taskId, entries, estimateHours, canLog, canManage, currentUserId, onChange }: {
  taskId: string;
  entries: TimeEntry[];
  estimateHours?: number | null;
  canLog: boolean;
  canManage: boolean;
  currentUserId?: string;
  onChange: (entries: TimeEntry[]) => void;
}) {
  const today = safeFormat(new Date().toISOString(), "yyyy-MM-dd");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [spentOn, setSpentOn] = useState(today);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const total = hours(entries.reduce((sum, e) => sum + e.minutes, 0));
  const over = estimateHours != null && total > estimateHours;

  const log = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = Number(amount);
    if (!amount.trim() || !Number.isFinite(h) || h < 0.1 || h > 24) {
      setError("Enter the hours spent, between 0.1 and 24.");
      return;
    }
    if (spentOn > today) {
      setError("Time can't be logged for a future date.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const entry = await api.logTime(taskId, { minutes: Math.round(h * 60), note: note.trim() || undefined, spentOn: new Date(spentOn).toISOString() });
      onChange([entry, ...entries]);
      setAmount("");
      setNote("");
      toast.success("Time logged");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't log the time");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (entry: TimeEntry) => {
    try {
      await api.deleteTimeEntry(entry.id);
      onChange(entries.filter((x) => x.id !== entry.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the entry");
    }
  };

  return (
    <div className="card p-6" aria-label="Time">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
          <Timer className="w-5 h-5 text-zinc-400" />
          Time
        </h3>
        <span className={`text-sm font-bold ${over ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300"}`} data-time-total>
          {total}h logged{estimateHours != null ? ` of ${estimateHours}h estimated` : ""}
        </span>
      </div>
      {estimateHours != null && estimateHours > 0 && (
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-4">
          <div className={`h-full ${over ? "bg-red-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, Math.round((total / estimateHours) * 100))}%` }} />
        </div>
      )}

      {canLog && (
        <form onSubmit={log} noValidate className="grid grid-cols-1 sm:grid-cols-[90px_140px_1fr_auto] gap-2 mb-4">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Hours" aria-label="Hours spent" className="input px-3 py-2 text-sm dark:text-slate-100" />
          <input type="date" value={spentOn} max={today} onChange={(e) => setSpentOn(e.target.value)} aria-label="Day worked" className="input px-3 py-2 text-sm dark:text-slate-100" />
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="What did you do? (optional)" aria-label="Time note" className="input px-3 py-2 text-sm dark:text-slate-100" />
          <button type="submit" disabled={busy} className="btn-primary px-4 py-2 text-sm font-bold disabled:opacity-50">Log</button>
          {error && <p role="alert" className="sm:col-span-4 text-sm font-semibold text-red-600">{error}</p>}
        </form>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No time logged yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {entries.map((entry) => (
            <li key={entry.id} className="group flex items-center gap-3 py-2 text-sm">
              <span className="w-14 font-bold text-slate-900 dark:text-white">{hours(entry.minutes)}h</span>
              <span className="w-20 text-slate-500 dark:text-slate-400">{safeFormat(entry.spentOn, "MMM d")}</span>
              <span className="flex-1 min-w-0 truncate text-slate-600 dark:text-slate-300">
                <span className="font-semibold">{entry.user?.fullName ?? "Someone"}</span>
                {entry.note ? ` · ${entry.note}` : ""}
              </span>
              {(entry.user?.id === currentUserId || canManage) && (
                <button onClick={() => void remove(entry)} aria-label={`Remove ${hours(entry.minutes)}h entry`} className="p-1 text-slate-400 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
