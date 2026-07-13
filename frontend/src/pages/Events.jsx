import { useEffect, useState } from "react";
import api, { API } from "@/lib/api";
import { toast } from "sonner";
import { MagnifyingGlass, Download, Trash } from "@phosphor-icons/react";

const SEVERITY_STYLES = {
  info: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
};

export default function Events() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState("");
  const [type, setType] = useState("");
  const [sortDesc, setSortDesc] = useState(true);

  const load = async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (severity) params.set("severity", severity);
    if (type) params.set("detection_type", type);
    params.set("limit", "200");
    const { data } = await api.get(`/events?${params.toString()}`);
    let arr = data.items;
    if (!sortDesc) arr = [...arr].reverse();
    setItems(arr);
    setTotal(data.total);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, severity, type, sortDesc]);

  const del = async (id) => {
    if (!window.confirm("Delete this event?")) return;
    try {
      await api.delete(`/events/${id}`);
      toast.success("Deleted");
      load();
    } catch (e) { toast.error("Not allowed"); }
  };

  const exportCsv = async () => {
    try {
      const res = await api.get("/events/export.csv", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sentinel_events.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Export failed"); }
  };

  const types = Array.from(new Set(items.map((e) => e.detection_type)));

  return (
    <div className="space-y-6" data-testid="events-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-blue-400 data-mono">History</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mt-1">Detection Events</h1>
        </div>
        <button onClick={exportCsv} data-testid="btn-export-csv" className="flex items-center gap-2 text-sm border border-zinc-800 hover:border-white/20 px-3 py-2 rounded-md transition-colors">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input placeholder="Search camera or type..." value={q} onChange={(e) => setQ(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-9 pr-3 py-2 text-sm" data-testid="input-search" />
          </div>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm" data-testid="select-severity">
            <option value="">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm" data-testid="select-type">
            <option value="">All types</option>
            {["intrusion", "crowd_detection", "motion_detection", "abandoned_object", "fire_detection", "smoke_detection", "object_detection"].map((t) => (
              <option key={t} value={t}>{t.replaceAll("_", " ")}</option>
            ))}
          </select>
          <button onClick={() => setSortDesc(!sortDesc)} className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-left transition-colors hover:border-white/20" data-testid="btn-sort">
            Sort: {sortDesc ? "Newest first" : "Oldest first"}
          </button>
        </div>
        <div className="mt-3 text-xs data-mono text-zinc-500">{total} total events</div>
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-950 text-zinc-500 uppercase text-[10px] tracking-widest">
            <tr>
              <th className="text-left px-4 py-2">Time</th>
              <th className="text-left px-4 py-2">Camera</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Conf.</th>
              <th className="text-left px-4 py-2">Severity</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800">No events match your filters</td></tr>
            )}
            {items.map((e, idx) => (
              <tr key={e.id} className="border-t border-white/5 hover:bg-white/[0.02] fade-in-up" style={{ animationDelay: `${idx * 15}ms` }} data-testid={`event-row-${e.id}`}>
                <td className="px-4 py-2.5 data-mono text-xs text-zinc-400">{new Date(e.created_at).toLocaleString()}</td>
                <td className="px-4 py-2.5">{e.camera_name}</td>
                <td className="px-4 py-2.5 capitalize">{e.detection_type.replaceAll("_", " ")}</td>
                <td className="px-4 py-2.5 data-mono">{(e.confidence * 100).toFixed(0)}%</td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border data-mono ${SEVERITY_STYLES[e.severity]}`}>{e.severity}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => del(e.id)} className="text-zinc-500 hover:text-red-400 transition-colors" data-testid={`btn-delete-event-${e.id}`}>
                    <Trash size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
