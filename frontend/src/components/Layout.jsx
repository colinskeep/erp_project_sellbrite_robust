export default function Layout({ children }) {
  return (
    <div className="flex h-screen bg-bg text-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white flex flex-col p-6 shadow-xl">
        <h1 className="text-2xl font-semibold mb-10 tracking-tight">AZFT ERP</h1>

        <button
          onClick={() => window.location.href = "/"}
          className="w-full text-left px-3 py-2 mb-2 rounded hover:bg-white/10 transition"
        >
          Dashboard
        </button>

        <button
          onClick={() => window.location.href = "/replenishment"}
          className="w-full text-left px-3 py-2 mb-2 rounded hover:bg-white/10 transition"
        >
          Replenishment
        </button>

        <button
          onClick={() => window.location.href = "/purchase-orders"}
          className="w-full text-left px-3 py-2 rounded hover:bg-white/10 transition"
        >
          Purchase Orders
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 overflow-y-auto">{children}</div>
    </div>
  );
}