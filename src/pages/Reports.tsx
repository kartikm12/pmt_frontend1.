import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Download, Filter } from "lucide-react";
import { api } from "@/lib/api";
import type { Project, User } from "@/lib/api-types";

// New specialized components
import { ProjectProgressChart } from "@/components/reports/ProjectProgressChart";
import { TaskStatusChart } from "@/components/reports/TaskStatusChart";
import { TeamPerformanceTable } from "@/components/reports/TeamPerformanceTable";
import { WorkloadDistributionChart } from "@/components/reports/WorkloadDistributionChart";
import { OverdueTasksList } from "@/components/reports/OverdueTasksList";
import { GanttTimeline } from "@/components/reports/GanttTimeline";
import { KPIOverview } from "@/components/reports/KPIOverview";
import { ActivityTimeline } from "@/components/reports/ActivityTimeline";
import { SingleSelectDropdown } from "@/components/ui/SingleSelectDropdown";
import { EffortTable } from "@/components/reports/EffortTable";
import { downloadCsv } from "@/lib/csv";
import { PageLoader } from "@/components/ui/PageLoader";

const MANAGER_ROLES = ["Admin", "Manager", "Project Manager"];

export function Reports() {
  const { currentUser } = useAuth();
  const isManager = useMemo(() => currentUser && MANAGER_ROLES.includes(currentUser.role), [currentUser]);

  const [dateRange, setDateRange] = useState("30");
  const [projectId, setProjectId] = useState<string>("");
  const [memberId, setMemberId] = useState<string>("");

  const [filterData, setFilterData] = useState<{ projects: Project[], users: User[] }>({ projects: [], users: [] });
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load select options for filters
  useEffect(() => {
    async function loadFilters() {
      try {
        const [projects, team] = await Promise.all([
          api.getProjects(),
          api.getTeam()
        ]);
        setFilterData({ projects, users: team });
      } catch (error) {
        console.error("Failed to load filter options", error);
      }
    }
    void loadFilters();
  }, []);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const filters: any = { days: parseInt(dateRange, 10) };
      if (projectId) filters.projectId = projectId;
      if (memberId) filters.memberId = memberId;

      const data = await api.getComprehensiveReport(filters);
      setReportData(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, [dateRange, projectId, memberId]);



  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Reports & Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Comprehensive insights into project health and team productivity.</p>
        </div>
        <button
          onClick={() => reportData && downloadCsv(`project-report-${new Date().toLocaleDateString("en-CA")}.csv`, [
            ["Project", "Tasks", "Completed", "Pending", "Hours estimated", "Hours logged"],
            ...reportData.projectProgress.map((r: any) => [r.name, r.total, r.completed, r.pending, r.estimatedHours ?? 0, r.loggedHours ?? 0])
          ])}
          disabled={!reportData?.projectProgress?.length}
          className="btn-secondary px-4 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Dynamic Filters */}
      <div className="card p-4 flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-slate-400" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">Filters Data</span>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="w-full sm:min-w-[140px]">
            <SingleSelectDropdown
              options={[
                { id: "1", name: "Today" },
                { id: "7", name: "Last 7 days" },
                { id: "30", name: "Last 30 days" },
                { id: "90", name: "Last 90 days" },
                { id: "365", name: "This year" },
              ]}
              selectedId={dateRange}
              onChange={setDateRange}
            />
          </div>
          <div className="w-full sm:min-w-[180px]">
            <SingleSelectDropdown
              options={[
                { id: "", name: "All Projects" },
                ...filterData.projects.map(p => ({ id: p.id, name: p.name }))
              ]}
              selectedId={projectId}
              onChange={setProjectId}
              placeholder="All Projects"
              maxInitialOptions={8}
            />
          </div>
          {isManager && (
            <div className="w-full sm:min-w-[180px]">
              <SingleSelectDropdown
                options={[
                  { id: "", name: "All Team Members" },
                  ...filterData.users.map(u => ({ id: u.id, name: u.name }))
                ]}
                selectedId={memberId}
                onChange={setMemberId}
                placeholder="All Team Members"
                maxInitialOptions={8}
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Content Areas */}
      {isLoading ? (
        <PageLoader />
      ) : reportData ? (
        <div className="space-y-6" id="printable-report-area">
          {/* Headline numbers (the API always sent them; nothing showed them) */}
          <KPIOverview data={reportData.kpis} />

          {/* Progress & Status Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 break-inside-avoid">
            <ProjectProgressChart data={reportData.projectProgress} />
            <TaskStatusChart data={reportData.statusData} />
          </div>

          <div className="break-inside-avoid">
            <EffortTable data={reportData.projectProgress} />
          </div>

          {/* Workload Distribution */}
          <div className="break-inside-avoid">
            <WorkloadDistributionChart data={reportData.workloadDistribution} />
          </div>

          {/* Performance & Overdue Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 break-inside-avoid">
            <TeamPerformanceTable data={reportData.teamPerformance} />
            <OverdueTasksList data={reportData.overdueTasks} />
          </div>

          {/* Timelines and Activities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 break-inside-avoid">
             <GanttTimeline data={reportData.projectProgress} />
             <ActivityTimeline data={reportData.recentActivity} />
          </div>
        </div>
      ) : (
        <div className="card p-20 flex items-center justify-center text-slate-500">
          No data available for the selected filters.
        </div>
      )}

      {/* Print specifically hidden styles */}
      <style>{`
        @media print {
          body { background-color: white !important; }
          .card { border: 1px solid #e2e8f0; box-shadow: none !important; }
          .dark .card { background-color: white !important; border-color: #e2e8f0; color: black; }
        }
      `}</style>
    </div>
  );
}
