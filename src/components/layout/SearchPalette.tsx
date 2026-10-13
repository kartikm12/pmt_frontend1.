import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { CheckSquare, FolderKanban, Search, User as UserIcon } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";

type Results = Awaited<ReturnType<typeof api.search>>;
type Item = { key: string; group: string; title: string; subtitle?: string; icon: React.ReactNode; to: string };

const STATUS_WORD: Record<string, string> = { TODO: "To Do", IN_PROGRESS: "In Progress", REVIEW: "Review", DONE: "Completed" };

// Ctrl+K / Cmd+K: find any task, project or person you can see
export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setResults(null);
    setError("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Wait for a pause in typing; drop answers that arrive after a newer search started
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(true);
    const timer = setTimeout(() => {
      api.search(term)
        .then((r) => !stale && (setResults(r), setError("")))
        .catch((e) => !stale && setError(e instanceof Error ? e.message : "Search failed"))
        .finally(() => !stale && setLoading(false));
    }, 200);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [q]);

  const items = useMemo<Item[]>(() => {
    if (!results) return [];
    return [
      ...results.tasks.map((t) => ({ key: `t${t.id}`, group: "Tasks", title: t.title, subtitle: `${t.project.name} · ${STATUS_WORD[t.status] ?? t.status}`, icon: <CheckSquare className="w-4 h-4 text-emerald-500" />, to: `/tasks/${t.id}` })),
      ...results.projects.map((p) => ({ key: `p${p.id}`, group: "Projects", title: p.name, icon: <FolderKanban className="w-4 h-4 text-indigo-500" />, to: `/projects/${p.id}` })),
      ...results.people.map((u) => ({ key: `u${u.id}`, group: "People", title: u.fullName, subtitle: u.title ? `${u.title} · ${u.email}` : u.email, icon: <Avatar name={u.fullName} src={u.avatarUrl ?? undefined} className="w-5 h-5 rounded-full" />, to: `/tasks?person=${u.id}` }))
    ];
  }, [results]);

  useEffect(() => setActive(0), [items]);

  if (!open) return null;

  const go = (item?: Item) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="card w-full max-w-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") go(items[active]);
            }}
            placeholder="Search tasks, projects, people…"
            aria-label="Search"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls="search-results"
            aria-activedescendant={items[active] ? `sr-${items[active].key}` : undefined}
            className="flex-1 py-4 bg-transparent outline-none text-base dark:text-slate-100"
          />
          <kbd className="hidden sm:inline text-[10px] font-bold text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div id="search-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {q.trim().length < 2 ? (
            <p className="px-3 py-6 text-sm text-center text-slate-500">Type at least 2 letters. A label like "bug" finds tagged tasks too.</p>
          ) : error ? (
            <p role="alert" className="px-3 py-6 text-sm text-center text-red-600">{error}</p>
          ) : loading && !results ? (
            <p className="px-3 py-6 text-sm text-center text-slate-500">Searching…</p>
          ) : !items.length ? (
            <p className="px-3 py-6 text-sm text-center text-slate-500">No matches for "{q.trim()}"</p>
          ) : (
            items.map((item, i) => (
              <div key={item.key}>
                {(i === 0 || items[i - 1].group !== item.group) && (
                  <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.group}</p>
                )}
                <button
                  id={`sr-${item.key}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(item)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left ${i === active ? "bg-indigo-50 dark:bg-indigo-900/30" : ""}`}
                >
                  {item.icon}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">{item.title}</span>
                    {item.subtitle && <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</span>}
                  </span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
