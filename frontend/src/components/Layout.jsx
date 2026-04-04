import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

export default function Layout({ children }) {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!token) return <>{children}</>;

  const navItem = (path, label) => {
    const active = location.pathname === path;

    return (
      <button
        onClick={() => navigate(path)}
        className={`w-full text-left px-3 py-2 rounded-lg transition 
        ${
          active
            ? "bg-white/20 text-white"
            : "text-gray-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-800 via-slate-800 to-slate-700 text-gray-100">
      
      {/* Sidebar */}
      <div className="w-64 bg-slate-700/70 backdrop-blur-xl border-r border-white/10 p-6 flex flex-col">
        
        {/* Logo */}
        <div className="mb-10">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            AZFT ERP
          </h1>
          <p className="text-xs text-gray-300 mt-1">
            Inventory Intelligence
          </p>
        </div>

        {/* Nav */}
        <nav className="space-y-1">
          {navItem("/", "Dashboard")}
          {navItem("/replenishment", "Replenishment")}
          {navItem("/purchase-orders", "Purchase Orders")}
        </nav>

        <div className="flex-1" />

        {/* Logout */}
        <button
          onClick={logout}
          className="text-sm text-rose-400 hover:text-rose-300 transition"
        >
          Logout
        </button>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        
        {/* Top Bar */}
        <div className="h-14 border-b border-white/10 bg-white/10 backdrop-blur-xl flex items-center justify-between px-6">
          <div className="text-sm text-gray-300 capitalize">
            {location.pathname.replace("/", "") || "dashboard"}
          </div>

          <div className="text-sm text-gray-300">
            Logged in
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto relative">
          
          {/* Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_65%)] pointer-events-none" />

          <div className="max-w-7xl mx-auto relative">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}