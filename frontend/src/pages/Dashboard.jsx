import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Camera, ShieldWarning, Pulse, Cpu, Lightning, Users, Fire, Car } from "@phosphor-icons/react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899"];

function Stat({ icon: Icon, label, value, hint, tone = "blue", testId }) {
  const toneMap = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    green: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
  };
  return (
    <div className="bg-zinc-900 border border-white/5 rounded-lg p-5 hover:border-white/20 transition-colors" data-testid={testId}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 data-mono">{label}</div>
          <div className="mt-2 font-display text-3xl font-semibold tracking-tight">{value}</div>
          {hint && <div className="mt-1 text-[11px] data-mono text-zinc-500">{hint}</div>}
        </div>
        <div className={`w-9 h-9 rounded-md border flex items-center justify-center ${toneMap[tone]}`}>
          <Icon size={18} weight="regular" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [s, e] = await Promise.all([api.get("/dashboard/stats"), api.get("/events?limit=8")]);
      setStats(s.data);
      setEvents(e.data.items || []);
    };
    load();
    const int = setInterval(load, 8000);
    return () => clearInterval(int);
  }, []);

  if (!stats) {
    return <div className="text-zinc-500 data-mono text-sm">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-blue-400 data-mono">Overview</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mt-1">Command Center</h1>
        </div>
        <div className="flex items-center gap-3 text-xs data-mono text-zinc-500">
          <span className="live-dot" /> Live telemetry
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat testId="stat-detections" icon={Lightning} label="Detections Today" value={stats.total_detections_today} hint="last 24h aggregated" tone="blue" />
        <Stat testId="stat-alerts" icon={ShieldWarning} label="Active Alerts" value={stats.active_alerts} hint="critical / 6h window" tone="red" />
        <Stat testId="stat-cameras" icon={Camera} label="Active Cameras" value={`${stats.active_cameras}/${stats.total_cameras}`} hint="online now" tone="green" />
        <Stat testId="stat-status" icon={Pulse} label="System Status" value={stats.system_status.toUpperCase()} hint="all subsystems nominal" tone="green" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat testId="stat-fps" icon={Pulse} label="Detection FPS" value={stats.fps} hint="mean over cluster" tone="blue" />
        <Stat testId="stat-cpu" icon={Cpu} label="CPU Usage" value={`${stats.cpu_usage}%`} hint="inference nodes" tone="amber" />
        <Stat testId="stat-inference" icon={Lightning} label="Inference Time" value={`${stats.inference_ms} ms`} hint="p50 latency" tone="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-zinc-900 border border-white/5 rounded-lg p-5" data-testid="chart-hourly">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">Detections</div>
              <div className="font-display text-lg font-semibold">Hourly activity (24h)</div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={stats.hourly_detections}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="hour" stroke="#71717a" fontSize={10} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} labelStyle={{ color: "#a1a1aa" }} />
                <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900 border border-white/5 rounded-lg p-5" data-testid="chart-categories">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">Categories</div>
          <div className="font-display text-lg font-semibold mb-4">Detection Mix</div>
          <div className="h-64">
            {stats.categories.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={stats.categories} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} stroke="#09090b">
                    {stats.categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 10, color: "#a1a1aa" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-zinc-900 border border-white/5 rounded-lg p-5" data-testid="chart-trend">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">Trend</div>
          <div className="font-display text-lg font-semibold mb-4">Person / activity — last 12h</div>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={stats.person_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="hour" stroke="#71717a" fontSize={10} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} />
                <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: "#10B981" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900 border border-white/5 rounded-lg p-5" data-testid="recent-alerts">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">Feed</div>
          <div className="font-display text-lg font-semibold mb-4">Recent Alerts</div>
          <div className="space-y-2 max-h-64 overflow-auto pr-1">
            {events.length === 0 && <div className="text-zinc-500 text-sm">No recent alerts</div>}
            {events.map((e, idx) => (
              <div key={e.id} className="fade-in-up flex items-start gap-3 p-2 rounded-md border border-white/5 hover:border-white/10 transition-colors" style={{ animationDelay: `${idx * 40}ms` }}>
                <div className={`mt-1.5 w-2 h-2 rounded-full ${e.severity === "critical" ? "bg-red-500" : e.severity === "warning" ? "bg-amber-500" : "bg-emerald-500"}`} />
                <div className="min-w-0">
                  <div className="text-sm truncate">{e.detection_type.replaceAll("_", " ")}</div>
                  <div className="text-[11px] data-mono text-zinc-500 truncate">{e.camera_name} · conf {(e.confidence * 100).toFixed(0)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
