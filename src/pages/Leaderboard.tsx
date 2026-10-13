import { useEffect, useMemo, useState } from "react";
import { Trophy, Crown, Target, Filter, Info, Award, Zap, Flame, X } from "lucide-react";
import { api } from "@/lib/api";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";
import type { LeaderboardEntry, Project } from "@/lib/api-types";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";

const PERIODS = [
  { label: "Today", value: 1 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "All time", value: 999 }
];

// Mirrors LeaderboardService on the server; keep the two in step
const SCORE_RULES: Array<[string, Array<[string, string]>]> = [
  ["Tasks assigned to you", [
    ["Completed", "+10"],
    ["Completed before its deadline", "+5 extra"],
    ["Completed and Urgent / High", "+10 / +5 extra"],
    ["Overdue", "−5 each"]
  ]],
  ["Projects you manage", [
    ["Completed", "+100"],
    ["Completed before its deadline", "+30 extra"],
    ["Overdue", "−20 each"]
  ]]
];

const BADGE_ICON: Record<string, typeof Award> = { "Top Performer": Award, "Fast Finisher": Zap, Consistent: Flame };

export function Leaderboard() {
  const { currentUser } = useAuth();
  const { socket, joinProject, leaveProject } = useSocket();
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState(7);
  const [projectId, setProjectId] = useState("");
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    api.getProjects().then(setProjects).catch(() => undefined);
  }, []);

  const load = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      setData(await api.getLeaderboard({ range, projectId }));
    } catch {
      toast.error("Couldn't load the leaderboard");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [range, projectId]);

  // Scores move as tasks change; refresh quietly
  useEffect(() => {
    if (!socket) return;
    const refresh = () => void load(false);
    const events = ["task_created", "task_updated", "task_deleted", "task_activity_updated"];
    events.forEach((e) => socket.on(e, refresh));
    return () => events.forEach((e) => socket.off(e, refresh));
  }, [socket, range, projectId]);

  useEffect(() => {
    if (!projectId) return;
    joinProject(projectId);
    return () => leaveProject(projectId);
  }, [projectId]);

  const me = data.find((d) => d.userId === currentUser?.id);
  const ahead = me && me.rank > 1 ? data[me.rank - 2] : undefined;
  const top3 = data.slice(0, 3);
  // Podium order on wide screens: 2nd, 1st, 3rd
  const podium = useMemo(() => [top3[1], top3[0], top3[2]].filter(Boolean) as LeaderboardEntry[], [data]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-500" />
            Leaderboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Points for finishing work, extra for finishing it on time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Period" className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                role="radio"
                aria-checked={range === p.value}
                onClick={() => setRange(p.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                  range === p.value ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="min-w-[190px]">
            <SingleSelectDropdown
              options={[{ id: "", name: "All projects" }, ...projects.map((p) => ({ id: p.id, name: p.name }))]}
              selectedId={projectId}
              onChange={setProjectId}
              Icon={Filter}
              variant="default"
            />
          </div>
          <button onClick={() => setShowRules((s) => !s)} aria-expanded={showRules} className="btn-secondary px-3 py-2 text-xs font-bold flex items-center gap-1.5">
            <Info className="w-4 h-4" />
            How the score works
          </button>
        </div>
      </div>

      {showRules && (
        <section className="card p-5" aria-label="How the score works">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900 dark:text-white">How the score works</h2>
            <button onClick={() => setShowRules(false)} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4 text-sm">
            {SCORE_RULES.map(([group, rules]) => (
              <div key={group}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{group}</h3>
                <dl>
                  {rules.map(([what, pts]) => (
                    <div key={what} className="flex justify-between gap-4 border-b border-slate-100 dark:border-slate-800 py-1.5">
                      <dt className="text-slate-600 dark:text-slate-300">{what}</dt>
                      <dd className={cn("font-bold whitespace-nowrap", pts.startsWith("−") ? "text-red-600" : "text-emerald-600")}>{pts}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">Only work finished inside the chosen period counts. Scores never go below 0.</p>
        </section>
      )}

      {isLoading ? (
        <div className="card p-16 flex flex-col items-center gap-3 text-slate-500">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          Working out the scores…
        </div>
      ) : data.length === 0 ? (
        <div className="card p-16 flex flex-col items-center text-center">
          <Target className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No finished work in this period</h3>
          <p className="text-slate-500 mt-1 max-w-sm">Pick a longer period, or complete a task to get on the board.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end" aria-label="Top three">
            {podium.map((u) => {
              const first = u.rank === 1;
              return (
                <div
                  key={u.userId}
                  data-podium={u.rank}
                  className={cn(
                    "card text-center p-5",
                    first ? "border-2 border-amber-400 dark:border-amber-500/70 sm:py-8 order-first sm:order-none" : "",
                    u.userId === currentUser?.id && "ring-2 ring-indigo-400"
                  )}
                >
                  <p className={cn("text-xs font-bold flex items-center justify-center gap-1", first ? "text-amber-600" : "text-slate-500")}>
                    {first && <Crown className="w-4 h-4" />}
                    {u.rank === 1 ? "1st" : u.rank === 2 ? "2nd" : "3rd"}
                  </p>
                  <Avatar name={u.fullName} src={u.avatarUrl} className={cn("mx-auto my-3 rounded-full object-cover", first ? "w-20 h-20 ring-4 ring-amber-200 dark:ring-amber-900/50" : "w-16 h-16")} />
                  <p className="font-bold text-slate-900 dark:text-white truncate">{u.fullName}</p>
                  <p className={cn("font-black tracking-tight", first ? "text-3xl text-amber-600 dark:text-amber-400" : "text-2xl text-slate-900 dark:text-white")}>{u.score}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{u.completedTasks} done · {u.onTimeRate}% on time</p>
                  {u.badges.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                      {u.badges.map((b) => {
                        const Icon = BADGE_ICON[b] ?? Award;
                        return (
                          <span key={b} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                            <Icon className="w-3 h-3" />
                            {b}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {me && (
            <div role="status" data-my-rank className="flex items-center gap-3 px-5 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 text-sm font-semibold">
              <Trophy className="w-4 h-4 shrink-0" />
              {me.rank === 1
                ? `You're 1st of ${data.length} with ${me.score} points.`
                : `You're ${ordinal(me.rank)} of ${data.length} with ${me.score} points${ahead ? `, ${ahead.score - me.score} behind ${ahead.fullName}` : ""}.`}
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    {["#", "Person", "Done", "Active", "Overdue", "On time", "Score"].map((h, i) => (
                      <th key={h} className={cn("px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400", i === 6 && "text-right")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.map((u) => {
                    const mine = u.userId === currentUser?.id;
                    return (
                      <tr key={u.userId} data-rank-row={u.fullName} className={cn(mine && "bg-indigo-50/70 dark:bg-indigo-900/20")}>
                        <td className="px-5 py-3 font-bold text-slate-500 w-12">{u.rank}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={u.fullName} src={u.avatarUrl} className="w-8 h-8 rounded-full" />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-white truncate">
                                {u.fullName}
                                {mine && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white font-bold">You</span>}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.title || "Team member"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">{u.completedTasks}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{u.inProgressTasks}</td>
                        <td className={cn("px-5 py-3 font-semibold", u.overdueTasks ? "text-red-600 dark:text-red-400" : "text-slate-400")}>{u.overdueTasks}</td>
                        <td className="px-5 py-3 min-w-[130px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div className={cn("h-full rounded-full", u.onTimeRate >= 80 ? "bg-emerald-500" : u.onTimeRate >= 50 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${u.onTimeRate}%` }} />
                            </div>
                            <span className="w-9 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">{u.completedTasks ? `${u.onTimeRate}%` : "—"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-lg font-black text-indigo-600 dark:text-indigo-400">{u.score}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
