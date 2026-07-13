import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";

export default function Profile() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [password, setPassword] = useState("");

  const save = async () => {
    try {
      const payload = { name };
      if (password) payload.password = password;
      await api.patch(`/users/${user.id}`, payload);
      toast.success("Profile updated");
      setPassword("");
      refresh();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  return (
    <div className="max-w-2xl space-y-6" data-testid="profile-page">
      <div>
        <div className="text-xs uppercase tracking-[0.28em] text-blue-400 data-mono">Identity</div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mt-1">Your Profile</h1>
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-display text-2xl">
            {(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="font-display text-xl">{user?.name}</div>
            <div className="text-sm data-mono text-zinc-500">{user?.email}</div>
            <div className="text-[10px] uppercase tracking-widest text-emerald-400 data-mono mt-1">{user?.role}</div>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-zinc-500 data-mono mb-2">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm" data-testid="profile-name" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-zinc-500 data-mono mb-2">New Password (optional)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm" data-testid="profile-password" placeholder="Leave blank to keep current" />
          </div>
          <button onClick={save} data-testid="btn-save-profile" className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-md transition-colors">Save Changes</button>
        </div>
      </div>
    </div>
  );
}
