import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Flag, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Milestone } from "@/lib/api-types";
import { safeFormat, isOverdue } from "@/utils/dateUtils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

// Milestones of one project with progress; managers can add, rename and delete them
export function MilestonesBar({ projectId, milestones, canManage, onChanged }: {
  projectId: string;
  milestones: Milestone[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<{ id?: string; name: string; dueDate: string } | null>(null);
  const [toDelete, setToDelete] = useState<Milestone | null>(null);
  const [error, setError] = useState("");

  if (!milestones.length && !canManage) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.name.trim()) {
      setError("Give the milestone a name.");
      return;
    }
    try {
      await api.saveMilestone(projectId, { id: editing.id, name: editing.name.trim(), dueDate: editing.dueDate || null });
      toast.success(editing.id ? "Milestone updated" : "Milestone added");
      setEditing(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the milestone");
    }
  };

  const remove = async () => {
    const m = toDelete;
    setToDelete(null);
    if (!m) return;
    try {
      await api.deleteMilestone(projectId, m.id);
      toast.success("Milestone deleted");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the milestone");
    }
  };

  return (
    <div className="flex flex-wrap items-stretch gap-3 mb-6" aria-label="Milestones">
      {milestones.map((m) => {
        const total = m.taskTotal ?? 0;
        const done = m.taskDone ?? 0;
        const pct = total ? Math.round((done / total) * 100) : 0;
        const late = done < total && isOverdue(m.dueDate);
        return (
          <div key={m.id} className="card px-4 py-3 min-w-[200px] flex-1 max-w-[280px]" data-milestone={m.name}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Flag className={`w-4 h-4 shrink-0 ${late ? "text-red-500" : "text-amber-500"}`} aria-hidden="true" />
                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{m.name}</span>
              </div>
              {canManage && (
                <div className="flex items-center shrink-0">
                  <button onClick={() => { setError(""); setEditing({ id: m.id, name: m.name, dueDate: m.dueDate ? safeFormat(m.dueDate, "yyyy-MM-dd", "") : "" }); }} className="p-1 text-slate-400 hover:text-indigo-600" aria-label={`Edit milestone ${m.name}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setToDelete(m)} className="p-1 text-slate-400 hover:text-red-600" aria-label={`Delete milestone ${m.name}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${m.name} progress`}>
              <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
            <p className={`text-[11px] mt-1.5 font-medium ${late ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>
              {done}/{total} done{m.dueDate ? ` · due ${safeFormat(m.dueDate, "MMM d")}` : ""}
            </p>
          </div>
        );
      })}
      {canManage && (
        <button
          onClick={() => { setError(""); setEditing({ name: "", dueDate: "" }); }}
          className="px-4 py-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-300 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Milestone
        </button>
      )}

      {editing && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <form role="dialog" aria-modal="true" aria-labelledby="milestone-title" noValidate onSubmit={save} className="card w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 id="milestone-title" className="text-lg font-bold text-slate-900 dark:text-white">{editing.id ? "Edit milestone" : "New milestone"}</h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            {error && <div role="alert" className="p-3 text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl">{error}</div>}
            <div className="space-y-1">
              <label htmlFor="milestone-name" className="text-sm text-slate-700 dark:text-slate-300">Name</label>
              <input id="milestone-name" autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Beta release" className="w-full input px-4 py-3 text-sm dark:text-slate-100" />
            </div>
            <div className="space-y-1">
              <label htmlFor="milestone-date" className="text-sm text-slate-700 dark:text-slate-300">Due date (optional)</label>
              <input id="milestone-date" type="date" value={editing.dueDate} onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })} className="w-full input px-4 py-3 text-sm dark:text-slate-100" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 btn-secondary py-2.5 text-sm font-bold">Cancel</button>
              <button type="submit" className="flex-1 btn-primary py-2.5 text-sm font-bold">Save</button>
            </div>
          </form>
        </div>,
        document.body
      )}
      <ConfirmDialog
        open={!!toDelete}
        title="Delete milestone?"
        message={toDelete ? `"${toDelete.name}" will be removed. Its tasks stay.` : undefined}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
