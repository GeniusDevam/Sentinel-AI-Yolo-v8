import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { UserPlus, Trash } from "@phosphor-icons/react";

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "viewer" });

  const load = () => api.get("/users").then(({ data }) => setUsers(data)).catch(() => toast.error("Admin only"));

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.email || !form.password) return toast.error("Fill all fields");
    try {
      await api.post("/auth/register", form);
      toast.success("User created");
      setShowAdd(false);
      setForm({ name: "", email: "", password: "", role: "viewer" });
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const changeRole = async (u, role) => {
    try {
      await api.patch(`/users/${u.id}`, { role });
      toast.success("Role updated");
      load();
    } catch { toast.error("Failed"); }
  };

  const del = async (u) => {
    if (!window.confirm(`Delete ${u.email}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("Deleted");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  if (user?.role !== "admin") {
    return (
      <div className="p-12 border border-dashed border-zinc-800 rounded-md text-center text-zinc-500" data-testid="access-denied">
        Admin access required
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-blue-400 data-mono">Access Control</div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mt-1">User Management</h1>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} data-testid="btn-add-user" className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-md transition-colors">
          <UserPlus size={16} /> Add User
        </button>
      </div>

      {showAdd && (
        <div className="bg-zinc-900 border border-white/5 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm" />
            <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm" />
            <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm">
              <option value="viewer">Viewer</option>
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={create} data-testid="btn-create-user" className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-md transition-colors">Create</button>
            <button onClick={() => setShowAdd(false)} className="text-sm border border-zinc-800 hover:border-white/20 px-3 py-2 rounded-md transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-white/5 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-950 text-zinc-500 uppercase text-[10px] tracking-widest">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-left px-4 py-2">Joined</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/5" data-testid={`user-row-${u.id}`}>
                <td className="px-4 py-2.5">{u.name}</td>
                <td className="px-4 py-2.5 data-mono text-xs text-zinc-400">{u.email}</td>
                <td className="px-4 py-2.5">
                  <select value={u.role} onChange={(e) => changeRole(u, e.target.value)} disabled={u.email === user.email} className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs">
                    <option value="viewer">Viewer</option>
                    <option value="operator">Operator</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-2.5 data-mono text-xs text-zinc-500">{u.created_at?.slice(0, 10)}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => del(u)} disabled={u.email === user.email} className="text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-30" data-testid={`btn-delete-user-${u.id}`}>
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
