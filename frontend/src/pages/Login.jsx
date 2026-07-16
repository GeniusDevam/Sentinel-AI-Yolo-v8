import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, Eye, EyeSlash } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (res.ok) {
      toast.success("Welcome back to Sentinel AI");
      nav("/dashboard");
    } else {
      toast.error(res.error || "Sign in failed");
    }
  };

  const quick = (role) => {
    const map = {
      admin: ["admin@sentinel.ai", "Admin@123"],
      operator: ["operator@sentinel.ai", "Operator@123"],
      viewer: ["viewer@sentinel.ai", "Viewer@123"],
    };
    setEmail(map[role][0]);
    setPassword(map[role][1]);
  };

  const demoMode = String(process.env.REACT_APP_DEMO_MODE || "true").toLowerCase() === "true";

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex" data-testid="login-page">
      <div className="hidden lg:flex flex-1 relative overflow-hidden border-r border-white/10">
        <div className="absolute inset-0 grid-bg opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-emerald-600/5" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <ShieldCheck size={22} weight="fill" className="text-blue-400" />
            </div>
            <div>
              <div className="font-display text-xl font-semibold tracking-tight">Sentinel AI</div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500 data-mono">Intelligent Video Analytics</div>
            </div>
          </div>

          <div className="max-w-md">
            <div className="text-xs uppercase tracking-[0.3em] text-blue-400 data-mono mb-3">Enterprise Command Center</div>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              Situational awareness at the speed of thought.
            </h1>
            <p className="mt-5 text-zinc-400 text-sm leading-relaxed">
              Real-time object detection, intrusion zones, crowd analytics, fire &amp; smoke
              detection — unified across every camera on your perimeter.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                ["24/7", "Autonomous"],
                ["6 cls", "Detections"],
                ["<50ms", "Inference"],
              ].map(([v, l]) => (
                <div key={l} className="p-3 rounded-md bg-zinc-900/60 border border-white/5">
                  <div className="data-mono text-lg text-blue-400">{v}</div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500">{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-zinc-600 data-mono">© Sentinel AI Systems / v1.0.0</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-md" data-testid="login-form">
          <div className="mb-8">
            <div className="text-xs uppercase tracking-[0.3em] text-blue-400 data-mono mb-2">Secure Access</div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">Sign in to command center</h2>
            <p className="text-sm text-zinc-400 mt-2">
              Use one of the seeded accounts below or your credentials.
            </p>
          </div>

          <label className="block text-xs uppercase tracking-widest text-zinc-500 data-mono mb-2">Email</label>
          <input
            data-testid="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="you@company.com"
          />

          <label className="block text-xs uppercase tracking-widest text-zinc-500 data-mono mt-5 mb-2">Password</label>
          <div className="relative">
            <input
              data-testid="login-password"
              type={show ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors" data-testid="login-toggle-password">
              {show ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            data-testid="login-submit"
            type="submit"
            disabled={busy}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-medium rounded-md py-2.5 text-sm transition-colors"
          >
            {busy ? "Authenticating..." : "Sign In"}
          </button>

          <div className="mt-8">
            {demoMode ? (
              <>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono mb-2">Demo Accounts</div>
                <div className="grid grid-cols-3 gap-2">
                  {["admin", "operator", "viewer"].map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => quick(r)}
                      data-testid={`quick-login-${r}`}
                      className="text-xs py-2 rounded-md bg-zinc-900 border border-zinc-800 hover:border-blue-500/50 hover:text-blue-400 transition-colors capitalize"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">
                Access restricted · authorised personnel only
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
