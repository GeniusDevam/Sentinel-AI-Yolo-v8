import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { FilePdf } from "@phosphor-icons/react";

export default function Reports() {
  const [period, setPeriod] = useState("daily");
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/reports/summary?period=${period}`).then(({ data }) => setData(data));
  }, [period]);

  const downloadPdf = async () => {
    try {
      const res = await api.get(`/reports/pdf?period=${period}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sentinel_${period}_report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch { toast.error("PDF failed"); }
  };

  if (!data) return <div className="text-zinc-500 data-mono text-sm">Loading report...</div>;

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-blue-400 data-mono">Reporting</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mt-1">Analytics Reports</h1>
        </div>
        <div className="flex items-center gap-2">
          {["daily", "weekly", "monthly"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              data-testid={`period-${p}`}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors capitalize ${period === p ? "bg-blue-600/20 border-blue-500/40 text-blue-300" : "bg-zinc-950 border-zinc-800 hover:border-white/20"}`}
            >
              {p}
            </button>
          ))}
          <button onClick={downloadPdf} data-testid="btn-download-pdf" className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-md transition-colors">
            <FilePdf size={16} /> Download PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">Total Events</div>
          <div className="font-display text-4xl font-semibold mt-2">{data.total_events}</div>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">Critical Alerts</div>
          <div className="font-display text-4xl font-semibold mt-2 text-red-400">{data.critical_alerts}</div>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">Warnings</div>
          <div className="font-display text-4xl font-semibold mt-2 text-amber-400">{data.warnings}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">Breakdown</div>
          <div className="font-display text-lg mb-4">Events by Type</div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.by_type} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" stroke="#71717a" fontSize={10} />
                <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={10} width={130} />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a" }} />
                <Bar dataKey="value" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900 border border-white/5 rounded-lg p-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">Fleet</div>
          <div className="font-display text-lg mb-4">Camera Uptime</div>
          <div className="space-y-2">
            {data.camera_uptime.map((c) => (
              <div key={c.name} className="flex items-center justify-between p-2 rounded border border-white/5">
                <div className="min-w-0">
                  <div className="text-sm truncate">{c.name}</div>
                  <div className="text-[10px] data-mono text-zinc-500 uppercase">{c.status}</div>
                </div>
                <div className="data-mono text-emerald-400">{c.uptime.toFixed(2)}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-lg p-5">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">Top Incidents</div>
        <div className="font-display text-lg mb-4">Most Common Detections</div>
        {data.top_incidents.length === 0 ? (
          <div className="p-8 border border-dashed border-zinc-800 rounded-md text-center text-zinc-500 text-sm">No incidents recorded</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {data.top_incidents.map((i, idx) => (
              <div key={i.name} className="p-4 rounded-md border border-white/5 bg-zinc-950">
                <div className="text-[10px] data-mono text-zinc-500">#{idx + 1}</div>
                <div className="mt-1 font-display text-sm truncate">{i.name.replaceAll("_", " ")}</div>
                <div className="data-mono text-2xl text-blue-400 mt-1">{i.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
