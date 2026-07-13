import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";
import DashboardLayout from "@/layouts/DashboardLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import LiveMonitoring from "@/pages/LiveMonitoring";
import Cameras from "@/pages/Cameras";
import Events from "@/pages/Events";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Users from "@/pages/Users";
import Profile from "@/pages/Profile";
import About from "@/pages/About";

function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400 data-mono text-sm">
        Loading Sentinel AI...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RootRedirect() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

function App() {
  useEffect(() => {
    document.title = "Sentinel AI - Video Analytics";
  }, []);
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/live" element={<LiveMonitoring />} />
              <Route path="/cameras" element={<Cameras />} />
              <Route path="/events" element={<Events />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/users" element={<Users />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/about" element={<About />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" position="top-right" richColors closeButton />
      </AuthProvider>
    </div>
  );
}

export default App;
