import { useEffect, useState, useMemo } from "react";
import { 
  Trophy, 
  Medal, 
  Target, 
  TrendingUp, 
  Filter,
  Users,
  Award,
  Zap,
  Flame,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";
import type { LeaderboardEntry, Project } from "@/lib/api-types";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";

export function Leaderboard() {
  const { currentUser } = useAuth();
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState(7); // Default 7 days
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const { socket, joinProject, leaveProject } = useSocket();

  const projectOptions = useMemo(() => [
    { id: "", name: "All Projects" },
    ...projects.map(p => ({ id: p.id, name: p.name }))
  ], [projects]);

  useEffect(() => {
    async function loadProjects() {
      try {
        const projectsData = await api.getProjects();
        setProjects(projectsData);
      } catch (error) {
        console.error("Failed to load projects:", error);
      }
    }
    void loadProjects();
  }, []);

  const loadLeaderboard = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      const leaderboardData = await api.getLeaderboard({ range, projectId: selectedProjectId });
      setData(leaderboardData);
    } catch (error) {
      toast.error("Failed to load leaderboard data");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadLeaderboard();
  }, [range, selectedProjectId]);

  // WebSocket Listeners for real-time updates
  useEffect(() => {
    if (socket) {
      const handleTaskUpdate = () => {
        // Refresh leaderboard data without showing a full loading state
        void loadLeaderboard(false);
      };

      socket.on("task_created", handleTaskUpdate);
      socket.on("task_updated", handleTaskUpdate);
      socket.on("task_deleted", handleTaskUpdate);
      socket.on("task_activity_updated", handleTaskUpdate);

      return () => {
        socket.off("task_created", handleTaskUpdate);
        socket.off("task_updated", handleTaskUpdate);
        socket.off("task_deleted", handleTaskUpdate);
        socket.off("task_activity_updated", handleTaskUpdate);
      };
    }
  }, [socket, range, selectedProjectId]);

  // Project room management
  useEffect(() => {
    if (selectedProjectId) {
      joinProject(selectedProjectId);
      return () => leaveProject(selectedProjectId);
    }
  }, [selectedProjectId]);

  const top3 = data.slice(0, 3);

  const getBadgeIcon = (badge: string) => {
    switch (badge) {
      case "Top Performer": return <Award className="w-4 h-4 text-amber-500" />;
      case "Fast Finisher": return <Zap className="w-4 h-4 text-blue-500" />;
      case "Consistent": return <Flame className="w-4 h-4 text-orange-500" />;
      case "On Fire": return <TrendingUp className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
            <Trophy className="w-10 h-10 text-amber-500" />
            Hall of Fame
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-lg">Celebrate your team's top contributors and track efficiency.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white/50 dark:bg-zinc-900/50 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 backdrop-blur-xl">
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
            {[
              { label: "1D", value: 1 },
              { label: "7D", value: 7 },
              { label: "30D", value: 30 },
              { label: "ALL", value: 999 }
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => setRange(t.value)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  range === t.value 
                    ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 hidden md:block" />

          <div className="relative min-w-[200px]">
            <SingleSelectDropdown
              options={projectOptions}
              selectedId={selectedProjectId}
              onChange={setSelectedProjectId}
              placeholder="All Projects"
              maxInitialOptions={8}
              Icon={Filter}
              variant="ghost"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 animate-pulse font-medium">Calculating scores...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="card p-20 flex flex-col items-center text-center">
          <Target className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mb-6" />
          <h3 className="text-xl font-bold dark:text-white">No activity found</h3>
          <p className="text-zinc-500 mt-2 max-w-sm">There aren't any completed tasks for this period yet. Time to get to work!</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Podium */}
          {/* Podium */}
          <div className="relative pt-16 pb-10">
            {/* Stage Base Shadow/Glow */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-indigo-600/5 dark:bg-indigo-400/5 blur-3xl -z-10 rounded-full" />
            
            <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-0 max-w-5xl mx-auto px-4">
              {/* 2nd Place */}
              {top3[1] && (
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="order-2 md:order-1 flex-1 w-full md:max-w-[200px] flex flex-col items-center group"
                >
                  <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-full border-4 border-slate-300 dark:border-slate-700 p-1.5 bg-white dark:bg-zinc-800 shadow-xl group-hover:scale-105 transition-transform duration-500 overflow-hidden">
                      <Avatar name={top3[1].fullName} src={top3[1].avatarUrl} className="w-full h-full rounded-full object-cover" />
                    </div>
                    <div className="absolute -bottom-2 -right-1 w-10 h-10 bg-slate-300 dark:bg-slate-700 rounded-full flex items-center justify-center border-4 border-white dark:border-zinc-950 font-black text-slate-700 dark:text-slate-200 shadow-lg">2</div>
                  </div>
                  <div className="text-center mb-4">
                    <p className="font-black text-slate-800 dark:text-white truncate max-w-[150px]">{top3[1].fullName}</p>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{top3[1].score} PTS</p>
                  </div>
                  <div className="w-full h-32 bg-gradient-to-b from-slate-200/50 to-slate-200/5 dark:from-slate-800/50 dark:to-transparent border-t border-x border-slate-300/30 dark:border-slate-700/30 rounded-t-3xl flex flex-col items-center justify-center backdrop-blur-sm">
                    <div className="text-sm font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">Silver</div>
                  </div>
                </motion.div>
              )}

              {/* 1st Place */}
              {top3[0] && (
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="order-1 md:order-2 flex-1 w-full md:max-w-[240px] flex flex-col items-center group relative z-10"
                >
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Medal className="w-14 h-14 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]" />
                    </motion.div>
                  </div>
                  
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full scale-150 animate-pulse" />
                    <div className="relative w-32 h-32 rounded-full border-4 border-amber-500 p-2 bg-white dark:bg-zinc-800 shadow-2xl group-hover:scale-105 transition-transform duration-500 overflow-hidden">
                      <Avatar name={top3[0].fullName} src={top3[0].avatarUrl} className="w-full h-full rounded-full object-cover" />
                    </div>
                    <div className="absolute -bottom-2 -right-1 w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center border-4 border-white dark:border-zinc-950 font-black text-white shadow-xl">1</div>
                  </div>
                  
                  <div className="text-center mb-4">
                    <p className="font-black text-xl text-zinc-900 dark:text-white truncate max-w-[220px]">{top3[0].fullName}</p>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="text-sm font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">{top3[0].score} PTS</span>
                    </div>
                  </div>
                  
                  <div className="w-full h-48 bg-gradient-to-b from-amber-500/20 to-amber-500/5 dark:from-amber-600/20 dark:to-transparent border-t border-x border-amber-500/40 dark:border-amber-500/20 rounded-t-[40px] flex flex-col items-center justify-start pt-8 backdrop-blur-md shadow-[0_-10px_20px_rgba(245,158,11,0.05)]">
                    <div className="text-sm font-black text-amber-600 dark:text-amber-500 uppercase tracking-[0.4em] mb-4">Gold</div>
                    <div className="flex flex-wrap justify-center gap-2 px-4 text-[10px] font-black uppercase tracking-tighter">
                      {top3[0].badges.map(b => (
                        <span key={b} className="px-2.5 py-1 bg-amber-500 text-white rounded-full shadow-lg shadow-amber-500/30 flex items-center gap-1">
                          {getBadgeIcon(b)} {b}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 3rd Place */}
              {top3[2] && (
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="order-3 md:order-3 flex-1 w-full md:max-w-[200px] flex flex-col items-center group"
                >
                  <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-full border-4 border-orange-600/50 dark:border-orange-900/50 p-1.5 bg-white dark:bg-zinc-800 shadow-xl group-hover:scale-105 transition-transform duration-500 overflow-hidden">
                      <Avatar name={top3[2].fullName} src={top3[2].avatarUrl} className="w-full h-full rounded-full object-cover" />
                    </div>
                    <div className="absolute -bottom-2 -right-1 w-10 h-10 bg-orange-600 dark:bg-orange-800 rounded-full flex items-center justify-center border-4 border-white dark:border-zinc-950 font-black text-white shadow-lg">3</div>
                  </div>
                  <div className="text-center mb-4">
                    <p className="font-black text-slate-800 dark:text-white truncate max-w-[150px]">{top3[2].fullName}</p>
                    <p className="text-xs font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest">{top3[2].score} PTS</p>
                  </div>
                  <div className="w-full h-24 bg-gradient-to-b from-orange-600/10 to-transparent border-t border-x border-orange-600/20 dark:border-orange-900/30 rounded-t-3xl flex flex-col items-center justify-center backdrop-blur-sm">
                    <div className="text-sm font-black text-orange-600 dark:text-orange-800 uppercase tracking-[0.3em]">Bronze</div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Full Width Rankings Table */}
          <div className="card overflow-hidden">
            <div className="px-8 py-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                Full Rankings
              </h2>
              <span className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-3 py-1 rounded-full">{data.length} Members</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-50/50 dark:bg-zinc-900/50">
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Rank</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Member</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Activity</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Productivity</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {data.map((user) => (
                    <tr key={user.userId} className={cn(
                      "hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors group",
                      user.userId === currentUser?.id && "bg-indigo-50/50 dark:bg-indigo-900/20"
                    )}>
                      <td className="px-8 py-5">
                        <span className={cn(
                          "inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-sm",
                          user.rank === 1 ? "bg-amber-500 text-white" :
                          user.rank === 2 ? "bg-slate-300 text-slate-700" :
                          user.rank === 3 ? "bg-orange-300 text-orange-700" :
                          "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                        )}>
                          #{user.rank}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <Avatar name={""} src={user.avatarUrl} className="w-10 h-10 rounded-full border-2 border-white dark:border-zinc-800" />
                          <div>
                            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                              {user.fullName}
                              {user.userId === currentUser?.id && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-600 text-white rounded font-black uppercase">You</span>}
                            </div>
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter mt-0.5">{user.title || "Team Member"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <div className="text-sm font-black text-zinc-900 dark:text-zinc-100">{user.completedTasks}</div>
                            <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Completed</div>
                          </div>
                          <div className="text-center">
                            <div className={cn(
                              "text-sm font-black",
                              user.overdueTasks > 0 ? "text-red-500" : "text-zinc-900 dark:text-zinc-100"
                            )}>{user.overdueTasks}</div>
                            <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Overdue</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 min-w-[150px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="text-zinc-500 uppercase">Productivity</span>
                            <span className={cn(
                              user.productivityScore > 80 ? "text-emerald-500" :
                              user.productivityScore > 40 ? "text-amber-500" : "text-red-500"
                            )}>{user.productivityScore}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${user.productivityScore}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                              className={cn(
                                "h-full rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]",
                                user.productivityScore > 80 ? "bg-emerald-500" :
                                user.productivityScore > 40 ? "bg-amber-500" : "bg-red-500"
                              )}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                         <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">{user.score}</div>
                         <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Points</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
