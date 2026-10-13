import React, { useState } from "react";
import { CheckSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Subtask } from "@/lib/api-types";

// Checklist inside a task: contributors tick, add and remove items; viewers only read
export function TaskChecklist({ taskId, items, canEdit, onChange }: {
  taskId: string;
  items: Subtask[];
  canEdit: boolean;
  onChange: (items: Subtask[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const done = items.filter((s) => s.done).length;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      const created = await api.addSubtask(taskId, title);
      onChange([...items, created]);
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add the item");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: Subtask) => {
    onChange(items.map((s) => (s.id === item.id ? { ...s, done: !s.done } : s)));
    try {
      await api.updateSubtask(item.id, { done: !item.done });
    } catch (err) {
      onChange(items);
      toast.error(err instanceof Error ? err.message : "Couldn't update the item");
    }
  };

  const remove = async (item: Subtask) => {
    onChange(items.filter((s) => s.id !== item.id));
    try {
      await api.deleteSubtask(item.id);
    } catch (err) {
      onChange(items);
      toast.error(err instanceof Error ? err.message : "Couldn't remove the item");
    }
  };

  if (!items.length && !canEdit) return null;

  return (
    <div className="card p-6" aria-label="Checklist">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
          <CheckSquare className="w-5 h-5 text-zinc-400" />
          Checklist
        </h3>
        {items.length > 0 && <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{done}/{items.length} done</span>}
      </div>
      {items.length > 0 && (
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-4">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.round((done / items.length) * 100)}%` }} />
        </div>
      )}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <input
              type="checkbox"
              checked={item.done}
              disabled={!canEdit}
              onChange={() => void toggle(item)}
              aria-label={item.title}
              className="w-4 h-4 accent-emerald-600"
            />
            <span className={`flex-1 text-sm ${item.done ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"}`}>{item.title}</span>
            {canEdit && (
              <button onClick={() => void remove(item)} aria-label={`Remove ${item.title}`} className="p-1 text-slate-400 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form onSubmit={add} className="flex gap-2 mt-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
            placeholder="Add an item"
            aria-label="New checklist item"
            className="flex-1 input px-3 py-2 text-sm dark:text-slate-100"
          />
          <button type="submit" disabled={busy || !draft.trim()} className="btn-secondary px-4 py-2 text-sm font-bold disabled:opacity-50">Add</button>
        </form>
      )}
    </div>
  );
}
