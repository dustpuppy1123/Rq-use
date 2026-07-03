import { useState, useEffect } from 'react';
import { User } from '../types';
import { 
  Clock, 
  Car, 
  CheckCircle2, 
  Map, 
  TrendingUp, 
  TrendingDown, 
  Award, 
  Activity, 
  Zap, 
  ShieldAlert,
  Calendar
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

interface DriverPerformanceProps {
  user: User;
}

interface PerformanceData {
  priorityStats: Array<{ name: string; time: number; count: number }>;
  typeStats: Array<{ name: string; count: number; time: number }>;
  shiftStats: {
    shift_count: number;
    total_distance: number;
    total_completed: number;
    avg_completed_per_shift: number;
  };
  responseTimeTrends: Array<{ day: string; avg_response: number; alarm_count: number }>;
  isSimulated: boolean;
}

export default function DriverPerformance({ user }: DriverPerformanceProps) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPerformance() {
      try {
        setLoading(true);
        const res = await fetch(`/api/drivers/${user.id}/performance`);
        if (!res.ok) {
          throw new Error('Failed to retrieve telemetry data');
        }
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching performance:', err);
        setError(err.message || 'Unable to load performance telemetry');
      } finally {
        setLoading(false);
      }
    }
    fetchPerformance();
  }, [user.id]);

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center min-h-[350px]">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold text-sm">Compiling Fleet Telemetry...</p>
        <p className="text-xs text-slate-400 mt-1">Analyzing driving duration, response velocities & reports</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-rose-100 text-center text-rose-600 flex flex-col items-center min-h-[300px] justify-center">
        <ShieldAlert size={48} className="text-rose-500 mb-3 animate-bounce" />
        <h3 className="font-bold text-lg text-slate-900">Telemetry Sync Interrupted</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">{error || "Could not synchronize dispatch timestamps."}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-6 px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-all shadow-md"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // Color Palettes for Charts
  const PRIORITY_COLORS: Record<string, string> = {
    High: '#ef4444',   // Red
    Medium: '#f59e0b', // Amber/Gold
    Low: '#3b82f6',    // Blue
  };

  const TYPE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6'];

  // Calculate some insights for motivation card
  const optimalTime = 10.0; // Benchmark objective is under 10 minutes
  const latestAvg = data.responseTimeTrends[data.responseTimeTrends.length - 1]?.avg_response || 10.0;
  const previousAvg = data.responseTimeTrends[data.responseTimeTrends.length - 2]?.avg_response || 11.0;
  const improvement = previousAvg - latestAvg;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Banner alerting simulated benchmark values if freshly registered */}
      {data.isSimulated && (
        <div className="bg-slate-100 border border-slate-200 text-slate-700 px-4 py-3.5 rounded-2xl text-xs flex items-start gap-3 shadow-inner">
          <Activity size={18} className="text-slate-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-black uppercase tracking-wider block text-[10px] text-slate-600 mb-0.5">💡 Baseline Sandbox Telemetry</span>
            You are viewing typical performance profiles. As you start completing alarms, submitting feed reports, and completing duty shifts, the charts will automatically update in real-time.
          </div>
        </div>
      )}

      {/* Modern Grid KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Solved</span>
            <span className="text-xl font-extrabold text-slate-900">{data.shiftStats.total_completed}</span>
            <span className="text-[10px] text-slate-400 block">reported cases</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
            <Calendar size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Duty Shifts</span>
            <span className="text-xl font-extrabold text-slate-900">{data.shiftStats.shift_count}</span>
            <span className="text-[10px] text-slate-400 block">active blocks</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
            <Map size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Odometer Log</span>
            <span className="text-xl font-extrabold text-slate-900">{data.shiftStats.total_distance}</span>
            <span className="text-[10px] text-slate-400 block">total kilometers</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
            <Clock size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Avg/Shift</span>
            <span className="text-xl font-extrabold text-slate-900">{data.shiftStats.avg_completed_per_shift}</span>
            <span className="text-[10px] text-slate-400 block">dispatches</span>
          </div>
        </div>
      </div>

      {/* Chart 1: Area line chart of Response Velocity over past days */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
          <div>
            <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
              <Clock size={18} className="text-amber-500" />
              Response Time Trend (Minutes)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Average dispatch creation time to report submission</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-xs text-slate-600">
            {improvement > 0 ? (
              <>
                <TrendingDown size={14} className="text-emerald-500" />
                <span>Improving (<b>{improvement.toFixed(1)}m</b> faster)</span>
              </>
            ) : (
              <>
                <TrendingUp size={14} className="text-slate-400" />
                <span>Steady Response profile</span>
              </>
            )}
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.responseTimeTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorResponse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit="m" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                formatter={(value: any) => [`${value} minutes`, 'Response Time']}
              />
              <Area type="monotone" dataKey="avg_response" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorResponse)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bi-grid charts for Incident types & Priority analysis */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Incident Type & Frequency (Donut chart) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-extrabold text-slate-900 flex items-center gap-2">
              <Award size={18} className="text-indigo-500" />
              Incident Frequency
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">Breakdown of reported incident typologies</p>
          </div>

          <div className="h-48 my-4 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.typeStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {data.typeStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={TYPE_COLORS[index % TYPE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  formatter={(value: any) => [`${value} dispatches`, 'Volume']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Clean modular Legend list below */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
            {data.typeStats.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[index % TYPE_COLORS.length] }} />
                <span className="text-slate-600 truncate">{entry.name}</span>
                <span className="font-bold text-slate-900 ml-auto">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Response Times (Bar Chart) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-extrabold text-slate-900 flex items-center gap-2">
              <Zap size={18} className="text-rose-500 animate-pulse" />
              Response Time vs Priority
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">Average dispatch resolution times (Minutes)</p>
          </div>

          <div className="h-48 my-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.priorityStats} layout="vertical" margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} unit="m" />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  formatter={(value: any) => [`${value} min`, 'Avg Response']}
                />
                <Bar dataKey="time" radius={[0, 8, 8, 0]} maxBarSize={24}>
                  {data.priorityStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>High priority emergency objective: &lt; 8 mins</span>
            <span>Medium target: &lt; 12 mins</span>
          </div>
        </div>
      </div>

      {/* Motivational / Insight Card */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center gap-5 relative overflow-hidden">
        {/* Abstract background highlight */}
        <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center shrink-0 border border-amber-500/20">
          <Award size={28} />
        </div>
        
        <div className="flex-1 text-center sm:text-left">
          <h4 className="font-black text-white text-base">Exceptional Operations Grade</h4>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Your average response time is currently clocked at <b className="text-amber-400">{latestAvg.toFixed(1)} minutes</b>, which satisfies the fleet safety target. Continue practicing proactive situational safety on dispatch.
          </p>
        </div>
      </div>
    </div>
  );
}
