import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { UploadSimple, Image as ImageIcon, VideoCamera, Broadcast, PolygonIcon, Trash } from "@phosphor-icons/react";

const COLOR_MAP = {
  person: "#2563EB",
  car: "#10B981",
  motorcycle: "#F59E0B",
  truck: "#10B981",
  bicycle: "#F59E0B",
  bus: "#10B981",
  fire: "#EF4444",
  smoke: "#A1A1AA",
};

function Overlay({ detections, width, height, zonePoints, setZonePoints, drawZone }) {
  const overlayRef = useRef(null);

  const onClick = (e) => {
    if (!drawZone) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const y = ((e.clientY - rect.top) / rect.height) * height;
    setZonePoints([...zonePoints, [x, y]]);
  };

  return (
    <svg
      ref={overlayRef}
      className="absolute inset-0 w-full h-full"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      onClick={onClick}
      style={{ cursor: drawZone ? "crosshair" : "default" }}
    >
      {detections.map((d, i) => {
        const [x1, y1, x2, y2] = d.bbox;
        const color = COLOR_MAP[d.class_name] || "#2563EB";
        return (
          <g key={i}>
            <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={2} />
            <rect x={x1} y={y1 - 22} width={Math.max(90, d.class_name.length * 9 + 40)} height={20} fill={color} />
            <text x={x1 + 6} y={y1 - 7} fill="#fff" fontFamily="JetBrains Mono, monospace" fontSize={12}>
              {d.class_name} {(d.confidence * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
      {zonePoints.length > 0 && (
        <polygon
          points={zonePoints.map((p) => p.join(",")).join(" ")}
          fill="rgba(239,68,68,0.15)"
          stroke="#EF4444"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      )}
      {zonePoints.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={5} fill="#EF4444" />
      ))}
    </svg>
  );
}

export default function LiveMonitoring() {
  const [cameras, setCameras] = useState([]);
  const [active, setActive] = useState(null);
  const [detections, setDetections] = useState([]);
  const [drawZone, setDrawZone] = useState(false);
  const [zonePoints, setZonePoints] = useState([]);
  const [imgResult, setImgResult] = useState(null); // {annotated_image, detections, ...}
  const [videoResult, setVideoResult] = useState(null);
  const [videoFrameIdx, setVideoFrameIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const videoTimerRef = useRef(null);

  useEffect(() => {
    api.get("/cameras").then(({ data }) => {
      setCameras(data);
      if (data[0]) setActive(data[0]);
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await api.get(`/live/simulate/${active.id}`);
        if (!cancelled) setDetections(data.detections);
      } catch {}
    };
    poll();
    const int = setInterval(poll, 1400);
    return () => { cancelled = true; clearInterval(int); };
  }, [active]);

  // Video playback loop
  useEffect(() => {
    if (videoResult && videoResult.frames.length) {
      videoTimerRef.current = setInterval(() => {
        setVideoFrameIdx((i) => (i + 1) % videoResult.frames.length);
      }, 700);
      return () => clearInterval(videoTimerRef.current);
    }
  }, [videoResult]);

  const uploadImage = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setImgResult(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post("/detect/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setImgResult(data);
      toast.success(`Detected ${data.detections.length} objects in ${data.inference_ms}ms`);
    } catch (err) {
      toast.error("Image detection failed");
    }
    setBusy(false);
    e.target.value = "";
  };

  const uploadVideo = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setVideoResult(null);
    setVideoFrameIdx(0);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("max_frames", "16");
      const { data } = await api.post("/detect/video", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setVideoResult(data);
      toast.success(`Analyzed ${data.sampled_frames} frames (avg ${data.avg_inference_ms}ms)`);
    } catch (err) {
      toast.error("Video detection failed");
    }
    setBusy(false);
    e.target.value = "";
  };

  return (
    <div className="space-y-6" data-testid="live-page">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-blue-400 data-mono">Live Analytics</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mt-1">Live Monitoring</h1>
        </div>
        <div className="flex items-center gap-2 text-xs data-mono text-zinc-500">
          <span className="live-dot" /> Simulated stream · YOLOv8 uploads
        </div>
      </div>

      {/* Camera selector strip */}
      <div className="flex gap-3 overflow-x-auto pb-2" data-testid="camera-strip">
        {cameras.map((c) => (
          <button
            key={c.id}
            onClick={() => { setActive(c); setZonePoints([]); }}
            data-testid={`camera-tile-${c.id}`}
            className={`shrink-0 w-56 text-left rounded-lg overflow-hidden border transition-colors ${active?.id === c.id ? "border-blue-500/60" : "border-white/5 hover:border-white/20"}`}
          >
            <div className="relative aspect-video bg-zinc-800">
              {c.thumbnail_url && <img src={c.thumbnail_url} alt={c.name} className="w-full h-full object-cover" />}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] data-mono px-1.5 py-0.5 rounded bg-black/60">
                <span className="live-dot !w-1.5 !h-1.5" /> LIVE
              </div>
            </div>
            <div className="p-2 bg-zinc-900">
              <div className="text-sm truncate">{c.name}</div>
              <div className="text-[10px] text-zinc-500 data-mono truncate">{c.location}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Live view */}
      {active && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-zinc-900 border border-white/5 rounded-lg overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">Camera</div>
                <div className="font-display text-lg">{active.name}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setDrawZone(!drawZone); if (drawZone) setZonePoints([]); }}
                  data-testid="btn-toggle-zone"
                  className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${drawZone ? "bg-red-500/10 border-red-500/40 text-red-400" : "bg-zinc-950 border-zinc-800 hover:border-white/20"}`}
                >
                  {drawZone ? "Finish Zone" : "Draw Restricted Zone"}
                </button>
                <button
                  onClick={() => setZonePoints([])}
                  data-testid="btn-clear-zone"
                  className="text-xs px-3 py-1.5 rounded-md border border-zinc-800 bg-zinc-950 hover:border-white/20 transition-colors flex items-center gap-1.5"
                >
                  <Trash size={14} /> Clear
                </button>
              </div>
            </div>
            <div className="relative aspect-video bg-zinc-950 scan-line">
              {active.thumbnail_url && <img src={active.thumbnail_url} alt={active.name} className="absolute inset-0 w-full h-full object-cover" />}
              <Overlay
                detections={detections}
                width={1280}
                height={720}
                zonePoints={zonePoints}
                setZonePoints={setZonePoints}
                drawZone={drawZone}
              />
              <div className="absolute top-3 left-3 flex items-center gap-2 px-2 py-1 rounded bg-black/60 backdrop-blur text-[11px] data-mono">
                <Broadcast size={14} className="text-red-400" /> LIVE · {active.scene}
              </div>
              <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/60 backdrop-blur text-[11px] data-mono text-zinc-300">
                {detections.length} objects · {new Date().toISOString().slice(11, 19)}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-zinc-900 border border-white/5 rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">Live Counts</div>
              <div className="mt-2 space-y-2">
                {["person", "car", "motorcycle", "truck", "bicycle", "bus"].map((c) => {
                  const n = detections.filter((d) => d.class_name === c).length;
                  return (
                    <div key={c} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-zinc-400">{c}</span>
                      <span className="data-mono text-white">{n}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-zinc-900 border border-white/5 rounded-lg p-4" data-testid="upload-panel">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">YOLOv8 Detection</div>
              <div className="font-display text-lg mb-3">Run on your file</div>
              <label className="flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-dashed border-zinc-700 hover:border-blue-500/50 hover:text-blue-400 cursor-pointer transition-colors" data-testid="upload-image-label">
                <ImageIcon size={16} /> Upload image
                <input type="file" accept="image/*" onChange={uploadImage} className="hidden" data-testid="upload-image-input" />
              </label>
              <label className="mt-2 flex items-center gap-2 text-sm px-3 py-2 rounded-md border border-dashed border-zinc-700 hover:border-blue-500/50 hover:text-blue-400 cursor-pointer transition-colors" data-testid="upload-video-label">
                <VideoCamera size={16} /> Upload video
                <input type="file" accept="video/*" onChange={uploadVideo} className="hidden" data-testid="upload-video-input" />
              </label>
              {busy && <div className="mt-3 text-xs data-mono text-blue-400">Processing on YOLOv8n...</div>}
            </div>
          </div>
        </div>
      )}

      {/* Image result */}
      {imgResult && (
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-4" data-testid="image-result">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">Result</div>
              <div className="font-display text-lg">Image Detection Result</div>
            </div>
            <div className="text-xs data-mono text-zinc-500">
              {imgResult.detections.length} objects · {imgResult.inference_ms}ms
            </div>
          </div>
          <img src={`data:image/jpeg;base64,${imgResult.annotated_image}`} alt="result" className="max-w-full rounded-md" />
        </div>
      )}

      {/* Video result */}
      {videoResult && videoResult.frames.length > 0 && (
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-4" data-testid="video-result">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">Result</div>
              <div className="font-display text-lg">Video Detection Playback</div>
            </div>
            <div className="text-xs data-mono text-zinc-500">
              Frame {videoFrameIdx + 1}/{videoResult.frames.length} · avg {videoResult.avg_inference_ms}ms
            </div>
          </div>
          <img src={`data:image/jpeg;base64,${videoResult.frames[videoFrameIdx].image}`} alt="frame" className="max-w-full rounded-md" />
        </div>
      )}
    </div>
  );
}
