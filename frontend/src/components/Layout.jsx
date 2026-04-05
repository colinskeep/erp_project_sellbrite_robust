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
        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition
        ${
          active
            ? "bg-blue-50 text-blue-600 font-medium"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-white text-gray-900">
      
      {/* 🔷 SIDEBAR */}
      <div className="w-64 border-r border-gray-200 bg-white flex flex-col p-6">
        
        {/* Logo */}
        <div className="mb-10">
          <h1 className="text-lg font-semibold tracking-tight text-gray-900">
            AZFT ERP
          </h1>
          <p className="text-xs text-gray-500 mt-1">
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
          className="text-sm text-red-500 hover:text-red-600 transition"
        >
          Logout
        </button>
      </div>

      {/* 🔷 MAIN */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-blue-50/40 to-white">
        
        {/* Top Bar */}
        <div className="h-14 border-b border-gray-200 bg-white/70 backdrop-blur flex items-center justify-between px-6">
          <div className="text-sm text-gray-500 capitalize">
            {location.pathname.replace("/", "") || "dashboard"}
          </div>

          <div className="text-sm text-gray-500">
            Logged in
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}