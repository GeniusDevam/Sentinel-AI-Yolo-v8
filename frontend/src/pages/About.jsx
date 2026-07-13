import { ShieldCheck, Cpu, Video, Brain, ChartLineUp } from "@phosphor-icons/react";

export default function About() {
  const features = [
    { icon: Brain, title: "YOLOv8 Detection", text: "Person, car, motorcycle, truck, bicycle, bus + fire/smoke heuristics." },
    { icon: Video, title: "Multi-source Input", text: "Live webcam, RTSP IP cameras, image and video uploads." },
    { icon: ShieldCheck, title: "Intrusion & Crowd", text: "Drawable restricted zones, crowd threshold alerts, motion & abandoned objects." },
    { icon: ChartLineUp, title: "Analytics & Reports", text: "Hourly charts, category mixes, PDF reports across daily/weekly/monthly." },
    { icon: Cpu, title: "System Telemetry", text: "FPS, CPU usage, inference latency streamed to the command center." },
  ];

  return (
    <div className="space-y-6 max-w-4xl" data-testid="about-page">
      <div>
        <div className="text-xs uppercase tracking-[0.28em] text-blue-400 data-mono">About</div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mt-1">Sentinel AI Platform</h1>
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-lg p-6">
        <p className="text-zinc-300 leading-relaxed">
          <span className="text-white font-semibold">Sentinel AI</span> is an enterprise-grade
          intelligent video analytics platform engineered for factories, warehouses, offices,
          campuses, airports and smart cities. It combines a real-time perception stack
          (YOLOv8) with a modern command-center UX so operators get situational awareness
          without cognitive overload.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((f) => (
          <div key={f.title} className="bg-zinc-900 border border-white/5 rounded-lg p-5 hover:border-white/20 transition-colors">
            <f.icon size={24} weight="duotone" className="text-blue-400" />
            <div className="font-display text-lg mt-3">{f.title}</div>
            <div className="text-sm text-zinc-400 mt-1">{f.text}</div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-lg p-6">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">Tech Stack</div>
        <div className="font-display text-lg mt-1 mb-3">Under the hood</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs data-mono">
          {["FastAPI", "MongoDB", "Ultralytics YOLOv8", "OpenCV", "React 19", "Tailwind", "Recharts", "ReportLab"].map((t) => (
            <div key={t} className="px-3 py-2 rounded border border-zinc-800 text-zinc-300">{t}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
