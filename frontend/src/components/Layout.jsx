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
        ${active ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-[#0f172a] text-white">
      
      {/* Sidebar */}
      <div className="w-64 bg-white/5 backdrop-blur-xl border-r border-white/10 p-6 flex flex-col">
        
        {/* Logo */}
        <div className="mb-10">
          <h1 className="text-xl font-semibold tracking-tight">
            AZFT ERP
          </h1>
          <p className="text-xs text-gray-400 mt-1">
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
          className="text-sm text-red-400 hover:text-red-300 transition"
        >
          Logout
        </button>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        
        {/* Top Bar */}
        <div className="h-14 border-b border-white/10 bg-white/5 backdrop-blur-xl flex items-center justify-between px-6">
          <div className="text-sm text-gray-400">
            {location.pathname.replace("/", "") || "dashboard"}
          </div>

          <div className="text-sm text-gray-400">
            Logged in
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto bg-gradient-to-br from-[#0f172a] to-[#111827]">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}