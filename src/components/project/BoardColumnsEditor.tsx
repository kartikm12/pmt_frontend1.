import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { GripVertical, Lock, Plus, Trash2, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { BoardColumn, TaskStatus } from "@/lib/api-types";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";

// What each column "counts as": reports, the dashboard and overdue alerts go by this, whatever the name
export const STAGE_LABEL: Record<TaskStatus, string> = { "To Do": "Not started", "In Progress": "In progress", Review: "Review", Completed: "Done" };
const STAGE_TONE: Record<TaskStatus, string> = {
  "To Do": "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
  "In Progress": "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
  Review: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  Completed: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
};
// One colour per stage, used on the board's column headers and here: grey, indigo, amber, green
export const STAGE_DOT: Record<TaskStatus, string> = {
  "To Do": "bg-slate-400",
  "In Progress": "bg-indigo-500",
  Review: "bg-amber-500",
  Completed: "bg-emerald-500"
};
const STAGES: TaskStatus[] = ["To Do", "In Progress", "Review", "Completed"];
const MAX_COLUMNS = 12;

type Row = { key: string; id?: string; name: string; stage: TaskStatus };
let seq = 0;
const newKey = () => `new-${++seq}`;

interface Props {
  projectId: string;
  projectName: string;
  columns: BoardColumn[];
  // How many tasks sit in each column now (removing one that has tasks asks where they go)
  counts: Map<string, number>;
  onClose: () => void;
  onSaved: (columns: BoardColumn[], moved: number) => void;
}

export function BoardColumnsEditor({ projectId, projectName, columns, counts, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<Row[]>(() => columns.map((c) => ({ key: c.id, id: c.id.startsWith("stage:") ? undefined : c.id, name: c.name, stage: c.stage })));
  // Removed columns that still have tasks, and the row (key) their tasks go to
  const [removed, setRemoved] = useState<{ id: string; name: string; count: number; to: string }[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Problems show after the first Save, then update (and clear) as the person fixes them
  const [tried, setTried] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInput.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  const onlyOf = (stage: TaskStatus, key: string) => rows.filter((r) => r.stage === stage).length === 1 && rows.find((r) => r.key === key)?.stage === stage;
  const lockReason = (r: Row) =>
    onlyOf("To Do", r.key) ? "Keep at least one column that counts as Not started" : onlyOf("Completed", r.key) ? "Keep at least one column that counts as Done" : "";

  const problem = useMemo(() => {
    const names = rows.map((r) => r.name.trim());
    if (names.some((n) => !n)) return "Each column needs a name.";
    if (names.some((n) => n.length > 30)) return "Column names are up to 30 characters.";
    const lower = names.map((n) => n.toLowerCase());
    const dup = lower.findIndex((n, i) => lower.indexOf(n) !== i);
    // Name the column that was there first (as the server does), not the new one being typed
    if (dup >= 0) return `Two columns are called "${names[lower.indexOf(lower[dup])]}". Give each column its own name.`;
    if (!rows.some((r) => r.stage === "To Do")) return "Keep at least one column that counts as Not started.";
    if (!rows.some((r) => r.stage === "Completed")) return "Keep at least one column that counts as Done.";
    return "";
  }, [rows]);

  const update = (key: string, change: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...change } : r)));

  const removeRow = (row: Row) => {
    const left = rows.filter((r) => r.key !== row.key);
    setRows(left);
    const count = row.id ? counts.get(row.id) ?? 0 : 0;
    if (row.id && count > 0) {
      // Their tasks go to the first column of the same stage by default (else the first column); changeable below
      const to = (left.find((r) => r.stage === row.stage) ?? left[0]).key;
      setRemoved((prev) => [...prev, { id: row.id!, name: row.name, count, to }]);
    }
    // Tasks heading for the removed row go to the first remaining column instead
    setRemoved((prev) => prev.map((m) => (m.to === row.key ? { ...m, to: left[0].key } : m)));
  };

  const onDragEnd = ({ source, destination }: DropResult) => {
    if (!destination || destination.index === source.index) return;
    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(source.index, 1);
      next.splice(destination.index, 0, moved);
      return next;
    });
  };

  const save = async () => {
    setTried(true);
    if (problem || saving) return;
    setSaving(true);
    setError("");
    try {
      const moveTo: Record<string, string> = {};
      for (const m of removed) {
        const at = rows.findIndex((r) => r.key === m.to);
        const target = rows[at];
        if (!target) continue;
        moveTo[m.id] = target.id ?? `new:${at}`;
      }
      const result = await api.saveColumns(projectId, rows.map((r) => ({ id: r.id, name: r.name.trim(), stage: r.stage })), moveTo);
      onSaved(result.columns, result.moved);
    } catch (e: any) {
      setError(e?.message || "Couldn't save the columns. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4 animate-in fade-in duration-200" onClick={() => !saving && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="columns-title" data-columns-editor className="card w-full max-w-xl max-h-[92dvh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 sm:px-6 pt-5 pb-3 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 id="columns-title" className="text-lg font-bold text-slate-900 dark:text-white">Board columns</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{projectName}. Each column counts as a stage, so reports and overdue alerts keep working.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="p-2 -m-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-4 overflow-y-auto flex-1">
          <div className="hidden sm:grid grid-cols-[20px_minmax(0,1fr)_150px_36px] gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-0.5">
            <span /><span>Column</span><span>Counts as</span><span />
          </div>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="columns">
              {(drop) => (
                <div ref={drop.innerRef} {...drop.droppableProps}>
                  {rows.map((row, index) => {
                    const lock = lockReason(row);
                    const count = row.id ? counts.get(row.id) ?? 0 : 0;
                    return (
                      <Fragment key={row.key}>
                      <Draggable draggableId={row.key} index={index}>
                        {(drag, snap) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            data-column-row={row.name}
                            className={`grid grid-cols-[20px_minmax(0,1fr)_36px] sm:grid-cols-[20px_minmax(0,1fr)_150px_36px] gap-2 items-center mb-2 rounded-xl ${snap.isDragging ? "bg-white dark:bg-slate-900 shadow-xl ring-2 ring-indigo-300" : ""}`}
                          >
                            <span {...drag.dragHandleProps} aria-label={`Move ${row.name || "column"}`} className="text-slate-400 cursor-grab flex justify-center">
                              <GripVertical className="w-4 h-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="relative">
                                <span aria-hidden="true" data-stage-dot={row.stage} className={`absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${STAGE_DOT[row.stage]}`} />
                                <input
                                  ref={index === 0 ? firstInput : undefined}
                                  value={row.name}
                                  maxLength={30}
                                  aria-label={`Column ${index + 1} name`}
                                  onChange={(e) => update(row.key, { name: e.target.value })}
                                  className="w-full pl-8 pr-3 py-2 input text-sm font-medium dark:text-slate-100"
                                />
                              </div>
                              {count > 0 && <p className="text-[11px] text-slate-400 mt-0.5 pl-1">{count} task{count === 1 ? "" : "s"}</p>}
                            </div>
                            <div className="col-start-2 sm:col-start-auto row-start-2 sm:row-start-auto">
                              <SingleSelectDropdown
                                ariaLabel={`Column ${index + 1} counts as`}
                                searchPlaceholder="Search stages..."
                                options={STAGES.map((s) => ({ id: s, name: STAGE_LABEL[s] }))}
                                selectedId={row.stage}
                                onChange={(s) => update(row.key, { stage: s as TaskStatus })}
                              />
                            </div>
                            <div className="flex justify-center">
                              {lock ? (
                                <span title={lock} aria-label={lock} className="p-2 text-slate-300 dark:text-slate-600"><Lock className="w-4 h-4" /></span>
                              ) : (
                                <button type="button" onClick={() => removeRow(row)} aria-label={`Remove ${row.name || "column"}`} title="Remove column" className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                      </Fragment>
                    );
                  })}
                  {drop.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <button
            type="button"
            disabled={rows.length >= MAX_COLUMNS}
            onClick={() => setRows((prev) => [...prev, { key: newKey(), name: "", stage: "In Progress" }])}
            className="mt-1 btn-secondary px-3 py-2 text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add column
          </button>
          {rows.length >= MAX_COLUMNS && <p className="text-xs text-slate-500 mt-2">A board has up to {MAX_COLUMNS} columns.</p>}

          {removed.length > 0 && (
            <div className="mt-5 space-y-3" data-removed-columns>
              {removed.map((m) => (
                <div key={m.id} className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                    "{m.name}" has {m.count} task{m.count === 1 ? "" : "s"}. Move {m.count === 1 ? "it" : "them"} to:
                  </p>
                  <SingleSelectDropdown
                    ariaLabel={`Move tasks from ${m.name} to`}
                    searchPlaceholder="Search columns..."
                    options={rows.map((r) => ({ id: r.key, name: r.name.trim() || "(unnamed column)" }))}
                    selectedId={m.to}
                    onChange={(to) => setRemoved((prev) => prev.map((x) => (x.id === m.id ? { ...x, to } : x)))}
                  />
                </div>
              ))}
            </div>
          )}

          {((tried && problem) || error) && <p role="alert" className="mt-4 text-sm font-semibold text-red-600 dark:text-red-400">{(tried && problem) || error}</p>}
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary px-5 py-2.5 text-sm font-bold">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={saving} className="btn-primary px-5 py-2.5 text-sm font-bold inline-flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Saving…" : "Save columns"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// For the toast after saving
export function columnsSavedMessage(moved: number) {
  return moved ? `Columns saved. ${moved} task${moved === 1 ? "" : "s"} moved.` : "Columns saved";
}

export function stageTone(stage: TaskStatus) {
  return STAGE_TONE[stage];
}

