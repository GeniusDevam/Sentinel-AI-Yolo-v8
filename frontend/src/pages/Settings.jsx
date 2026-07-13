import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const CLASSES = ["person", "car", "motorcycle", "truck", "bicycle", "bus"];

export default function Settings() {
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const canWrite = user?.role !== "viewer";

  useEffect(() => { api.get("/settings").then(({ data }) => setS(data)); }, []);

  const save = async () => {
    try {
      await api.put("/settings", s);
      toast.success("Settings saved");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  if (!s) return <div className="text-zinc-500 data-mono text-sm">Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-3xl" data-testid="settings-page">
      <div>
        <div className="text-xs uppercase tracking-[0.28em] text-blue-400 data-mono">Configuration</div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mt-1">AI Settings</h1>
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-lg p-6 space-y-6">
        <Slider label="Confidence Threshold" value={s.confidence_threshold} min={0.05} max={0.95} step={0.05} onChange={(v) => setS({ ...s, confidence_threshold: v })} testId="slider-confidence" />
        <Slider label="IoU Threshold" value={s.iou_threshold} min={0.1} max={0.95} step={0.05} onChange={(v) => setS({ ...s, iou_threshold: v })} testId="slider-iou" />
        <Slider label="Max People Threshold" value={s.max_people_threshold} min={1} max={100} step={1} onChange={(v) => setS({ ...s, max_people_threshold: v })} display={(v) => v} testId="slider-max-people" />
        <Slider label="Alarm Volume" value={s.alarm_volume} min={0} max={100} step={5} onChange={(v) => setS({ ...s, alarm_volume: v })} display={(v) => `${v}%`} testId="slider-volume" />
        <Slider label="Frame Skip Rate" value={s.frame_skip} min={0} max={10} step={1} onChange={(v) => setS({ ...s, frame_skip: v })} display={(v) => `${v} frames`} testId="slider-frame-skip" />
        <Slider label="Abandoned Object Time" value={s.abandoned_object_seconds} min={5} max={600} step={5} onChange={(v) => setS({ ...s, abandoned_object_seconds: v })} display={(v) => `${v}s`} testId="slider-abandoned" />

        <div>
          <label className="block text-xs uppercase tracking-widest text-zinc-500 data-mono mb-2">Processing Resolution</label>
          <div className="flex gap-2">
            {["480p", "720p", "1080p"].map((r) => (
              <button
                key={r}
                onClick={() => setS({ ...s, processing_resolution: r })}
                data-testid={`resolution-${r}`}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${s.processing_resolution === r ? "bg-blue-600/20 border-blue-500/40 text-blue-300" : "bg-zinc-950 border-zinc-800 hover:border-white/20"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-zinc-500 data-mono mb-2">Detection Classes</label>
          <div className="flex flex-wrap gap-2">
            {CLASSES.map((c) => {
              const active = s.detection_classes.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => setS({ ...s, detection_classes: active ? s.detection_classes.filter((x) => x !== c) : [...s.detection_classes, c] })}
                  data-testid={`class-${c}`}
                  className={`text-xs capitalize px-3 py-1.5 rounded-md border transition-colors ${active ? "bg-blue-600/20 border-blue-500/40 text-blue-300" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-white/20"}`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <button onClick={save} disabled={!canWrite} data-testid="btn-save-settings" className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-md transition-colors">
          Save Configuration
        </button>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, display, testId }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs uppercase tracking-widest text-zinc-500 data-mono">{label}</label>
        <span className="data-mono text-blue-400 text-sm">{display ? display(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        data-testid={testId}
        className="w-full accent-blue-500"
      />
    </div>
  );
}
