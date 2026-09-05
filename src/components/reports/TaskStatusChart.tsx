import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

interface TaskStatusChartProps {
  data: { name: string; value: number }[];
}

const COLORS = {
  "TODO": "#94a3b8", // Slate 400
  "IN_PROGRESS": "#fbbf24", // Amber 400
  "REVIEW": "#60a5fa", // Blue 400
  "DONE": "#10b981", // Emerald 500
};

const STATUS_LABELS: Record<string, string> = {
  "TODO": "To Do",
  "IN_PROGRESS": "In Progress",
  "REVIEW": "Review",
  "DONE": "Completed"
};

export function TaskStatusChart({ data }: TaskStatusChartProps) {
  const formattedData = data.map(item => ({
    name: STATUS_LABELS[item.name] || item.name,
    value: item.value,
    color: COLORS[item.name as keyof typeof COLORS] || "#CBD5E1"
  }));

  return (
    <div className="card p-8 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
          <PieChartIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Tasks by Status</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Distribution of all tasks</p>
        </div>
      </div>
      <div className="h-80 w-full flex-grow flex items-center justify-center">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={formattedData}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={120}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {formattedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                itemStyle={{ fontWeight: 600 }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle" 
                formatter={(value, entry: any) => <span className="text-slate-700 dark:text-slate-300 font-medium ml-1">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
           <div className="flex items-center justify-center text-slate-500 h-full">No tasks available</div>
        )}
      </div>
    </div>
  );
}
