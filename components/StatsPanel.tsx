import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { DailyStat } from '../types';
import { Activity, CalendarDays, CheckCircle2 } from 'lucide-react';

interface StatsPanelProps {
  history: DailyStat[];
  currentStreak: number;
  totalCompletedToday: number;
  themeColor: string;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ history, currentStreak, totalCompletedToday, themeColor }) => {
  // Process data for the chart (last 7 days)
  const chartData = history.slice(-7).map(stat => ({
    name: stat.date.slice(5), // MM-DD
    completed: stat.completedCount,
    total: stat.totalTasksAtEnd
  }));

  if (chartData.length === 0) {
    chartData.push({ name: 'Today', completed: totalCompletedToday, total: 10 });
  }

  return (
    <div className="h-full w-full flex flex-col p-6 space-y-8 bg-zinc-900 border-r border-zinc-800 text-zinc-300 overflow-y-auto">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Activity size={24} style={{ color: themeColor }} />
          Performance
        </h2>
        <p className="text-xs text-zinc-500">Your daily groove statistics.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-zinc-900 text-zinc-400">
              <CalendarDays size={18} />
            </div>
            <span className="text-sm font-medium text-zinc-400">Current Streak</span>
          </div>
          <p className="text-3xl font-bold text-white pl-1">{currentStreak} <span className="text-sm font-normal text-zinc-500">days</span></p>
        </div>

        <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-700/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-zinc-900 text-zinc-400">
              <CheckCircle2 size={18} />
            </div>
            <span className="text-sm font-medium text-zinc-400">Completed Today</span>
          </div>
          <p className="text-3xl font-bold text-white pl-1">{totalCompletedToday} <span className="text-sm font-normal text-zinc-500">tasks</span></p>
        </div>
      </div>

      <div className="flex-grow min-h-[200px] flex flex-col">
        <h3 className="text-sm font-semibold mb-4 text-zinc-400">Last 7 Days Activity</h3>
        <div className="flex-1 w-full -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis 
                dataKey="name" 
                stroke="#52525b" 
                fontSize={10} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                hide 
              />
              <Tooltip 
                cursor={{fill: 'transparent'}}
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '8px', color: '#fff' }}
                itemStyle={{ color: themeColor }}
              />
              <Bar dataKey="completed" radius={[4, 4, 0, 0]}>
                 {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={themeColor} fillOpacity={0.8} />
                  ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="text-xs text-zinc-600 mt-auto pt-4 border-t border-zinc-800">
        Consistency is key to the rhythm of success.
      </div>
    </div>
  );
};

export default StatsPanel;
