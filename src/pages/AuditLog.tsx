import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Project, User } from "@/lib/api-types";
import { safeFormat } from "@/utils/dateUtils";
import { downloadCsv } from "@/lib/csv";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";
import { useAuth } from "@/context/AuthContext";

type Entry = Awaited<ReturnType<typeof api.getAuditLog>>[number];
const PAGE = 100;
// Same names as the server's ActivityAction list
const ACTIONS = [
  "USER_REGISTERED", "USER_LOGGED_IN", "PROJECT_CREATED", "PROJECT_UPDATED", "PROJECT_ARCHIVED",
  "PROJECT_MEMBER_ADDED", "PROJECT_MEMBER_REMOVED", "TASK_CREATED", "TASK_UPDATED", "TASK_DELETED",
  "TASK_STATUS_CHANGED", "TASK_ASSIGNED", "COMMENT_ADDED", "TEAM_MEMBER_INVITED", "TEAM_MEMBER_REMOVED", "PROFILE_UPDATED"
];
const label = (a: string) => a.charAt(0) + a.slice(1).toLowerCase().replace(/_/g, " ");

// Who did what and when, across the whole company (Admins only)
export function AuditLog() {
  const { currentUser } = useAuth();
  // The API scopes non-Admins to their own activity, so the page itself is Admin-only
  if (currentUser?.role !== "Admin") {
    return <div className="card p-10 text-center text-slate-600 dark:text-slate-300">Only Admins can see the audit log.</div>;
  }
  return <AuditLogView />;
}

function AuditLogView() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [userId, setUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getTeam(), api.getProjects()]).then(([u, p]) => {
      setUsers(u);
      setProjects(p);
    }).catch(() => undefined);
  }, []);

  const filters = (skip: number) => ({
    userId,
    projectId,
    action,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    skip,
    limit: PAGE
  });

  const load = async (skip: number) => {
    if (from && to && from > to) {
      setError("The start date must be before the end date.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const page = await api.getAuditLog(filters(skip));
      setEntries((prev) => (skip ? [...prev, ...page] : page));
      setHasMore(page.length === PAGE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the audit log");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load(0);
  }, [userId, projectId, action, from, to]);

  // Export everything that matches, not just the loaded page (capped so a browser tab copes)
  const exportCsv = async () => {
    try {
      const all: Entry[] = [];
      for (let skip = 0; skip < 5000; skip += 500) {
        const page = await api.getAuditLog({ ...filters(skip), limit: 500 });
        all.push(...page);
        if (page.length < 500) break;
      }
      downloadCsv(`audit-log-${safeFormat(new Date().toISOString(), "yyyy-MM-dd")}.csv`, [
        ["When", "Who", "Email", "Action", "Project", "Details"],
        ...all.map((e) => [safeFormat(e.createdAt, "yyyy-MM-dd HH:mm:ss"), e.user?.fullName ?? "System", e.user?.email ?? "", e.action, e.project?.name ?? "", e.description])
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't export the audit log");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-indigo-500" />
            Audit log
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5">Every sign-in and change, newest first. Only Admins can see this page.</p>
        </div>
        <button onClick={() => void exportCsv()} disabled={!entries.length} className="btn-secondary px-4 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-50">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <SingleSelectDropdown options={[{ id: "", name: "Everyone" }, ...users.map((u) => ({ id: u.id, name: u.name }))]} selectedId={userId} onChange={setUserId} variant="default" />
        <SingleSelectDropdown options={[{ id: "", name: "All projects" }, ...projects.map((p) => ({ id: p.id, name: p.name }))]} selectedId={projectId} onChange={setProjectId} variant="default" />
        <SingleSelectDropdown options={[{ id: "", name: "All actions" }, ...ACTIONS.map((a) => ({ id: a, name: label(a) }))]} selectedId={action} onChange={setAction} variant="default" />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="input px-3 py-2 text-sm dark:text-slate-100" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" className="input px-3 py-2 text-sm dark:text-slate-100" />
      </div>

      {error && <div role="alert" className="card p-4 text-sm font-semibold text-red-600">{error}</div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                {["When", "Who", "Action", "Project", "Details"].map((h) => (
                  <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {entries.map((e) => (
                <tr key={e.id} data-audit-action={e.action}>
                  <td className="px-5 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">{safeFormat(e.createdAt, "MMM d, yyyy h:mm a")}</td>
                  <td className="px-5 py-3 whitespace-nowrap font-semibold text-slate-900 dark:text-white">{e.user?.fullName ?? "System"}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">{label(e.action)}</span>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {e.project ? <Link to={`/projects/${e.project.id}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">{e.project.name}</Link> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300 min-w-[260px]">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && !entries.length && !error && <p className="p-10 text-center text-slate-500">Nothing matches these filters.</p>}
        {(hasMore || isLoading) && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <button onClick={() => void load(entries.length)} disabled={isLoading} className="btn-secondary px-5 py-2 text-sm font-bold disabled:opacity-50">
              {isLoading ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
