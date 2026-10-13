import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, RotateCcw, CheckSquare, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PageLoader } from "@/components/ui/PageLoader";

type TrashData = Awaited<ReturnType<typeof api.getTrash>>;
const KEEP_DAYS = 30;

const daysLeft = (deletedAt: string) => Math.max(0, KEEP_DAYS - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 864e5));

// Projects and tasks deleted in the last 30 days; company managers bring them back
export function Trash() {
  const navigate = useNavigate();
  const [data, setData] = useState<TrashData | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => api.getTrash().then(setData).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load deleted items"));
  useEffect(() => {
    void load();
  }, []);

  const restore = async (kind: "project" | "task", id: string, name: string) => {
    setBusyId(id);
    try {
      if (kind === "project") await api.restoreProject(id);
      else await api.restoreTask(id);
      toast.success(`"${name}" restored`, {
        action: { label: "Open", onClick: () => navigate(kind === "project" ? `/projects/${id}` : `/tasks/${id}`) }
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't restore it");
    } finally {
      setBusyId(null);
    }
  };

  const empty = data && !data.projects.length && !data.tasks.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Recently deleted</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1.5">Deleted projects and tasks stay here for {KEEP_DAYS} days. Restoring a project brings back its tasks and team too.</p>
      </div>

      {error ? (
        <div role="alert" className="card p-8 text-red-600">{error}</div>
      ) : !data ? (
        <PageLoader />
      ) : empty ? (
        <div className="card p-16 text-center">
          <Trash2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="font-semibold text-slate-600 dark:text-slate-300">Nothing deleted in the last {KEEP_DAYS} days</p>
        </div>
      ) : (
        <>
          {data.projects.length > 0 && (
            <Section title="Projects" count={data.projects.length}>
              {data.projects.map((p) => (
                <Row
                  key={p.id}
                  icon={<FolderKanban className="w-5 h-5 text-indigo-500" />}
                  name={p.name}
                  detail={`${p._count.tasks} task${p._count.tasks === 1 ? "" : "s"} · deleted ${formatDistanceToNow(new Date(p.deletedAt), { addSuffix: true })}`}
                  left={daysLeft(p.deletedAt)}
                  busy={busyId === p.id}
                  onRestore={() => void restore("project", p.id, p.name)}
                />
              ))}
            </Section>
          )}
          {data.tasks.length > 0 && (
            <Section title="Tasks" count={data.tasks.length}>
              {data.tasks.map((t) => (
                <Row
                  key={t.id}
                  icon={<CheckSquare className="w-5 h-5 text-emerald-500" />}
                  name={t.title}
                  detail={`${t.project.name} · deleted ${formatDistanceToNow(new Date(t.deletedAt), { addSuffix: true })}`}
                  left={daysLeft(t.deletedAt)}
                  busy={busyId === t.id}
                  onRestore={() => void restore("task", t.id, t.title)}
                />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden" aria-label={title}>
      <h2 className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title} <span className="text-slate-400">({count})</span>
      </h2>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">{children}</ul>
    </section>
  );
}

function Row({ icon, name, detail, left, busy, onRestore }: { icon: React.ReactNode; name: string; detail: string; left: number; busy: boolean; onRestore: () => void; key?: React.Key }) {
  return (
    <li className="flex items-center gap-4 px-6 py-4" data-trash-item={name}>
      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 dark:text-white truncate">{name}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
      <span className={`hidden sm:inline text-xs font-bold ${left <= 3 ? "text-red-600" : "text-slate-400"}`}>{left} day{left === 1 ? "" : "s"} left</span>
      <button onClick={onRestore} disabled={busy} className="btn-secondary px-4 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-50" aria-label={`Restore ${name}`}>
        <RotateCcw className="w-4 h-4" />
        Restore
      </button>
    </li>
  );
}
