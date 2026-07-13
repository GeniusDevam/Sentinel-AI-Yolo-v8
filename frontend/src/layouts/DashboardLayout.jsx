import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  ChartLineUp,
  Video,
  Camera,
  ClockCounterClockwise,
  FileText,
  Gear,
  UsersThree,
  UserCircle,
  Info,
  SignOut,
  ShieldCheck,
} from "@phosphor-icons/react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: ChartLineUp, testId: "nav-dashboard" },
  { to: "/live", label: "Live Monitoring", icon: Video, testId: "nav-live" },
  { to: "/cameras", label: "Cameras", icon: Camera, testId: "nav-cameras" },
  { to: "/events", label: "Detection History", icon: ClockCounterClockwise, testId: "nav-events" },
  { to: "/reports", label: "Reports", icon: FileText, testId: "nav-reports" },
  { to: "/settings", label: "AI Settings", icon: Gear, testId: "nav-settings" },
  { to: "/users", label: "User Management", icon: UsersThree, testId: "nav-users", roles: ["admin"] },
  { to: "/profile", label: "Profile", icon: UserCircle, testId: "nav-profile" },
  { to: "/about", label: "About", icon: Info, testId: "nav-about" },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex" data-testid="app-shell">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-white/10 bg-zinc-950/80 backdrop-blur-xl flex flex-col">
        <div className="px-6 pt-6 pb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <ShieldCheck size={20} weight="fill" className="text-blue-400" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg font-semibold tracking-tight">Sentinel AI</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 data-mono">Command Center</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.filter((n) => !n.roles || n.roles.includes(user?.role)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-testid={item.testId}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600/15 text-white border border-blue-500/30"
                    : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`
              }
            >
              <item.icon size={18} weight="regular" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-sm font-semibold data-mono">
              {(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{user?.name || "User"}</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 data-mono">{user?.role}</div>
            </div>
            <button
              onClick={onLogout}
              data-testid="logout-btn"
              className="text-zinc-400 hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <SignOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-6 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <header className="h-14 border-b border-white/10 bg-zinc-950/70 backdrop-blur-md flex items-center justify-between px-6" data-testid="top-bar">
      <div className="flex items-center gap-3">
        <span className="live-dot" />
        <span className="text-xs uppercase tracking-[0.2em] text-zinc-400 data-mono">System Online</span>
      </div>
      <div className="flex items-center gap-6 text-xs data-mono text-zinc-400">
        <span>UTC {new Date().toISOString().slice(11, 19)}</span>
        <span className="hidden md:inline">Build v1.0.0</span>
      </div>
    </header>
  );
}
