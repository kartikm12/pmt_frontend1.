import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, RotateCcw, CheckSquare, Trash2, Search, Clock, X } from "lucide-react";
import { formatDistanceToNow, isToday } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PageLoader } from "@/components/ui/PageLoader";
import { useAuth } from "@/context/AuthContext";
import { isManager } from "@/utils/roleUtils";
import { cn } from "@/lib/utils";

type Kind = "project" | "task";
type Item = { kind: Kind; id: string; name: string; where: string; deletedAt: string; deletedBy: string | null };
type Filter = "all" | Kind;

const DAY = 864e5;
const daysLeft = (deletedAt: string, keep: number) => Math.max(0, keep - Math.floor((Date.now() - new Date(deletedAt).getTime()) / DAY));
const groupOf = (deletedAt: string) => (isToday(new Date(deletedAt)) ? "Today" : Date.now() - new Date(deletedAt).getTime() < 7 * DAY ? "This week" : "Earlier");
const GROUPS = ["Today", "This week", "Earlier"] as const;

// Projects and tasks deleted in the last 30 days; company managers bring them back
export function Trash() {
  const { currentUser } = useAuth();
  if (!isManager(currentUser?.role)) {
    return <div className="card p-10 text-center text-slate-600 dark:text-slate-300">Only managers can see and restore deleted items.</div>;
  }
  return <TrashView />;
}

function TrashView() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[] | null>(null);
  const [keep, setKeep] = useState(30);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const load = () =>
    api.getTrash().then((d) => {
      setKeep(d.keepDays ?? 30);
      setItems([
        ...d.projects.map((p): Item => ({ kind: "project", id: p.id, name: p.name, where: p.restorableTasks ? `Project with ${p.restorableTasks} task${p.restorableTasks === 1 ? "" : "s"}` : "Empty project", deletedAt: p.deletedAt, deletedBy: p.deletedBy ?? null })),
        ...d.tasks.map((t): Item => ({ kind: "task", id: t.id, name: t.title, where: `Task in ${t.project.name}`, deletedAt: t.deletedAt, deletedBy: t.deletedBy ?? null }))
      ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)));
    }).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load deleted items"));
  useEffect(() => {
    void load();
  }, []);

  const counts = { all: items?.length ?? 0, project: items?.filter((i) => i.kind === "project").length ?? 0, task: items?.filter((i) => i.kind === "task").length ?? 0 };
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((i) => (filter === "all" || i.kind === filter) && (!q || `${i.name} ${i.where} ${i.deletedBy ?? ""}`.toLowerCase().includes(q)));
  }, [items, filter, query]);
  const shownSelected = shown.filter((i) => selected.has(i.id));
  const allShownSelected = shown.length > 0 && shownSelected.length === shown.length;

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(shown.map((i) => i.id)));

  // One request per item; every result is reported, then the list reloads once
  const restore = async (targets: Item[]) => {
    setBusy(new Set(targets.map((t) => t.id)));
    const results = await Promise.allSettled(targets.map((t) => (t.kind === "project" ? api.restoreProject(t.id) : api.restoreTask(t.id))));
    setBusy(new Set());
    const ok = targets.filter((_, i) => results[i].status === "fulfilled");
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (ok.length === 1) {
      const t = ok[0];
      toast.success(`"${t.name}" restored`, { action: { label: "Open", onClick: () => navigate(t.kind === "project" ? `/projects/${t.id}` : `/tasks/${t.id}`) } });
    } else if (ok.length > 1) toast.success(`${ok.length} items restored`);
    if (failed.length) toast.error(`${failed.length} couldn't be restored: ${failed[0].reason instanceof Error ? failed[0].reason.message : "try again"}`);
    setSelected((s) => { const n = new Set(s); ok.forEach((t) => n.delete(t.id)); return n; });
    await load();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Recently deleted</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5">
            {items ? `${counts.all} item${counts.all === 1 ? "" : "s"}. ` : ""}Each stays {keep} days, then it's removed for good. Restoring a project brings back its tasks and team too.
          </p>
        </div>
      </div>

      {error ? (
        <div role="alert" className="card p-8 text-red-600">{error}</div>
      ) : !items ? (
        <PageLoader />
      ) : !items.length ? (
        <div className="card p-16 text-center">
          <Trash2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="font-semibold text-slate-700 dark:text-slate-200">Nothing deleted in the last {keep} days</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Deleted projects and tasks show up here, so a mistake can be undone.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div role="radiogroup" aria-label="Show" className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold self-start">
              {(["all", "project", "task"] as Filter[]).map((f) => (
                <button
                  key={f}
                  role="radio"
                  aria-checked={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn("px-3 py-1.5 rounded-lg whitespace-nowrap", filter === f ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-slate-600 dark:text-slate-300")}
                >
                  {f === "all" ? "All" : f === "project" ? "Projects" : "Tasks"} <span className="text-slate-400 font-normal">{counts[f]}</span>
                </button>
              ))}
            </div>
            <div className="relative sm:ml-auto sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search deleted items" aria-label="Search deleted items" className="input pl-9 py-2 text-sm w-full" />
            </div>
          </div>

          {shownSelected.length > 0 && (
            <div role="toolbar" aria-label="Selected items" className="sticky top-2 z-20 flex flex-wrap items-center gap-3 card px-5 py-3 border-indigo-200 dark:border-indigo-900">
              <span className="text-sm font-bold text-slate-900 dark:text-white">{shownSelected.length} selected</span>
              <button onClick={() => void restore(shownSelected)} disabled={busy.size > 0} className="btn-primary px-4 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-60">
                <RotateCcw className="w-4 h-4" /> {busy.size > 0 ? "Restoring…" : "Restore selected"}
              </button>
              <button onClick={() => setSelected(new Set())} className="ml-auto p-2 text-slate-400 hover:text-slate-600" aria-label="Clear selection">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {!shown.length ? (
            <div className="card p-10 text-center text-sm text-slate-500 dark:text-slate-400">No deleted items match.</div>
          ) : (
            <div className="card overflow-hidden">
              <label className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-pointer">
                <input type="checkbox" checked={allShownSelected} onChange={toggleAll} className="w-4 h-4 accent-indigo-600" aria-label="Select all shown items" />
                Select all {shown.length}
              </label>
              {GROUPS.map((g) => {
                const rows = shown.filter((i) => groupOf(i.deletedAt) === g);
                if (!rows.length) return null;
                return (
                  <section key={g} aria-label={g}>
                    <h2 className="px-5 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{g}</h2>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {rows.map((i) => (
                        <Row key={i.id} item={i} left={daysLeft(i.deletedAt, keep)} checked={selected.has(i.id)} busy={busy.has(i.id)} onToggle={() => toggle(i.id)} onRestore={() => void restore([i])} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ item, left, checked, busy, onToggle, onRestore }: { item: Item; left: number; checked: boolean; busy: boolean; onToggle: () => void; onRestore: () => void; key?: string }) {
  const soon = left <= 3;
  return (
    <li className={cn("flex items-center gap-3 sm:gap-4 px-5 py-3.5", checked && "bg-indigo-50/60 dark:bg-indigo-500/5")} data-trash-item={item.name}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="w-4 h-4 accent-indigo-600 shrink-0" aria-label={`Select ${item.name}`} />
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", item.kind === "project" ? "bg-indigo-50 dark:bg-indigo-500/10" : "bg-emerald-50 dark:bg-emerald-500/10")}>
        {item.kind === "project" ? <FolderKanban className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> : <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 sm:line-clamp-none sm:truncate">
          {item.where} · deleted {item.deletedBy ? `by ${item.deletedBy}, ` : ""}{formatDistanceToNow(new Date(item.deletedAt), { addSuffix: true })}
        </p>
        <p className={cn("sm:hidden text-xs font-semibold mt-0.5", soon ? "text-red-600 dark:text-red-400" : "text-slate-400")}>
          {left === 0 ? "Goes today" : `${left} day${left === 1 ? "" : "s"} left`}
        </p>
      </div>
      <span
        data-days-left={left}
        className={cn("hidden sm:inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap", soon ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}
        title={`Removed for good after ${left === 0 ? "today" : `${left} more day${left === 1 ? "" : "s"}`}`}
      >
        {soon && <Clock className="w-3 h-3" />}
        {left === 0 ? "Goes today" : `${left} day${left === 1 ? "" : "s"} left`}
      </span>
      <button onClick={onRestore} disabled={busy} className="btn-secondary px-3 sm:px-4 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-50 shrink-0" aria-label={`Restore ${item.name}`}>
        <RotateCcw className="w-4 h-4" />
        <span className="hidden sm:inline">Restore</span>
      </button>
    </li>
  );
}
