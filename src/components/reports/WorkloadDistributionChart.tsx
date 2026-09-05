import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Users } from "lucide-react";

interface WorkloadDistributionChartProps {
  data: { name: string; taskCount: number }[];
}

export function WorkloadDistributionChart({ data }: WorkloadDistributionChartProps) {
  // Determine color based on workload magnitude (e.g. > 10 is overloaded, < 3 is underutilized)
  const getColor = (count: number) => {
    if (count >= 10) return "#ef4444"; // Red 500
    if (count >= 5) return "#3b82f6"; // Blue 500
    return "#10b981"; // Emerald 500
  };

  return (
    <div className="card p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
          <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Workload Distribution</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Open tasks assigned per team member</p>
        </div>
      </div>
      <div className="h-80 w-full">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={data} margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: "#475569", fontSize: 13, fontWeight: 600 }} 
              />
              <Tooltip 
                cursor={{ fill: "rgba(0,0,0,0.05)" }} 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
              />
              <Bar dataKey="taskCount" name="Open Tasks" radius={[0, 4, 4, 0]} maxBarSize={32}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColor(entry.taskCount)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500">No workload data available</div>
        )}
      </div>
    </div>
  );
}
