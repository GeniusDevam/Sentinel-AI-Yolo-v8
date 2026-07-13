import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Plus, Trash, ArrowClockwise, PencilSimple } from "@phosphor-icons/react";

const SCENES = ["warehouse", "traffic", "factory", "webcam"];

export default function Cameras() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", scene: "warehouse", source_type: "demo", stream_url: "" });
  const [edit, setEdit] = useState(null);

  const load = () => api.get("/cameras").then(({ data }) => setItems(data));

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name) return toast.error("Name required");
    try {
      await api.post("/cameras", { ...form, enabled: true });
      toast.success("Camera added");
      setShowAdd(false);
      setForm({ name: "", location: "", scene: "warehouse", source_type: "demo", stream_url: "" });
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to add");
    }
  };

  const toggle = async (c) => {
    try {
      await api.patch(`/cameras/${c.id}`, { enabled: !c.enabled });
      load();
    } catch (e) { toast.error("Not allowed"); }
  };

  const rename = async (c) => {
    if (!edit?.name) return;
    try {
      await api.patch(`/cameras/${c.id}`, { name: edit.name, location: edit.location });
      toast.success("Renamed");
      setEdit(null);
      load();
    } catch (e) { toast.error("Failed"); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    try {
      await api.delete(`/cameras/${c.id}`);
      toast.success("Deleted");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Only admin"); }
  };

  const reconnect = async (c) => {
    try {
      await api.post(`/cameras/${c.id}/reconnect`);
      toast.success("Reconnected");
      load();
    } catch (e) { toast.error("Failed"); }
  };

  const canWrite = user?.role !== "viewer";
  const canDelete = user?.role === "admin";

  return (
    <div className="space-y-6" data-testid="cameras-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-blue-400 data-mono">Fleet</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mt-1">Camera Management</h1>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            data-testid="btn-add-camera"
            className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-md transition-colors"
          >
            <Plus size={16} /> Add Camera
          </button>
        )}
      </div>

      {showAdd && (
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-5" data-testid="add-camera-form">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm" data-testid="input-camera-name" />
            <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm" data-testid="input-camera-location" />
            <select value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm" data-testid="select-camera-source">
              <option value="demo">Demo (simulated)</option>
              <option value="webcam">Browser Webcam</option>
              <option value="rtsp">RTSP / IP Camera</option>
            </select>
            <select value={form.scene} onChange={(e) => setForm({ ...form, scene: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm">
              {SCENES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {form.source_type === "rtsp" && (
              <input placeholder="rtsp://user:pass@ip:554/stream" value={form.stream_url} onChange={(e) => setForm({ ...form, stream_url: e.target.value })} className="md:col-span-4 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm" />
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={create} className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-md transition-colors" data-testid="btn-create-camera">Create</button>
            <button onClick={() => setShowAdd(false)} className="text-sm border border-zinc-800 hover:border-white/20 px-3 py-2 rounded-md transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((c) => (
          <div key={c.id} className="bg-zinc-900 border border-white/5 rounded-lg overflow-hidden hover:border-white/20 transition-colors" data-testid={`camera-card-${c.id}`}>
            <div className="relative aspect-video bg-zinc-800">
              {c.thumbnail_url && <img src={c.thumbnail_url} alt={c.name} className="w-full h-full object-cover" />}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] data-mono px-1.5 py-0.5 rounded bg-black/60">
                <span className={`w-1.5 h-1.5 rounded-full ${c.enabled ? "bg-emerald-500" : "bg-zinc-500"}`} /> {c.status?.toUpperCase()}
              </div>
              <div className="absolute top-2 right-2 text-[10px] data-mono px-1.5 py-0.5 rounded bg-black/60">{c.scene}</div>
            </div>
            <div className="p-4">
              {edit?.id === c.id ? (
                <div className="space-y-2">
                  <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-sm" />
                  <input value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => rename(c)} className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded transition-colors">Save</button>
                    <button onClick={() => setEdit(null)} className="text-xs border border-zinc-800 px-2 py-1 rounded">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="font-display text-base truncate">{c.name}</div>
                      <div className="text-xs data-mono text-zinc-500 truncate">{c.location}</div>
                    </div>
                    <div className="text-[10px] data-mono text-emerald-400">{c.uptime_pct?.toFixed(2)}%</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => toggle(c)} disabled={!canWrite} className="text-xs px-2 py-1 rounded border border-zinc-800 hover:border-white/20 transition-colors disabled:opacity-50" data-testid={`btn-toggle-${c.id}`}>
                      {c.enabled ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => reconnect(c)} disabled={!canWrite} className="text-xs px-2 py-1 rounded border border-zinc-800 hover:border-white/20 transition-colors disabled:opacity-50 flex items-center gap-1" data-testid={`btn-reconnect-${c.id}`}>
                      <ArrowClockwise size={12} /> Reconnect
                    </button>
                    <button onClick={() => setEdit({ id: c.id, name: c.name, location: c.location })} disabled={!canWrite} className="text-xs px-2 py-1 rounded border border-zinc-800 hover:border-white/20 transition-colors disabled:opacity-50 flex items-center gap-1" data-testid={`btn-edit-${c.id}`}>
                      <PencilSimple size={12} /> Rename
                    </button>
                    <button onClick={() => remove(c)} disabled={!canDelete} className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 flex items-center gap-1" data-testid={`btn-delete-${c.id}`}>
                      <Trash size={12} /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
