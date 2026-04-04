import { useEffect, useState } from "react";
import axios from "axios";
import Spinner from "../components/Spinner";
const API_KEY = process.env.API_KEY;
const token = localStorage.getItem("token");


export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("reorder");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    axios.get("https://erp-project-sellbrite-robust.onrender.com/replenishment", 
      { headers: { "Authorization": `Bearer ${token}`, "x-api-key": API_KEY } })
      .then((res) => {
        const cleaned = res.data.filter(i => i.sku && i.sku.trim() !== "");
        setData(cleaned);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  const formatUSD = (num) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num || 0);

  const totalRevenue = data.reduce((sum, i) => sum + (i.revenue || 0), 0);
  const totalCost = data.reduce(
    (sum, i) => sum + ((i.cost || 0) * (i.sold_qty || 0)),
    0
  );
  const profit = totalRevenue - totalCost;
  const lowStock = data.filter((i) => i.reorder_qty > 0).length;

  let filtered = data.filter(
    (item) =>
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      (item.title || "").toLowerCase().includes(search.toLowerCase())
  );

  if (filter === "low") {
    filtered = filtered.filter((i) => i.reorder_qty > 0);
  }

  if (sort === "reorder") {
    filtered.sort((a, b) => b.reorder_qty - a.reorder_qty);
  } else if (sort === "revenue") {
    filtered.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
  } else if (sort === "days") {
    filtered.sort(
      (a, b) => (a.days_of_stock || 999) - (b.days_of_stock || 999)
    );
  }

  return (
  <div className="p-8 space-y-8">
    {/* HEADER */}
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-semibold text-white tracking-tight">
          Supply Chain Dashboard
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Real-time inventory and replenishment insights
        </p>
      </div>

      <div className="flex gap-3">
        <input
          placeholder="Search SKU or product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <select
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300"
        >
          <option value="all">All Items</option>
          <option value="low">Low Stock</option>
        </select>

        <select
          onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300"
        >
          <option value="reorder">Reorder Qty</option>
          <option value="revenue">Revenue</option>
          <option value="days">Days Left</option>
        </select>
      </div>
    </div>

    {/* KPI GRID */}
    <div className="grid grid-cols-4 gap-6">
      <KPI title="Revenue (90d)" value={formatUSD(totalRevenue)} />
      <KPI title="Estimated Profit" value={formatUSD(profit)} />
      <KPI title="Low Stock SKUs" value={lowStock} highlight />
      <KPI title="Total SKUs" value={data.length} />
    </div>

    {/* ALERT */}
    {lowStock > 0 && (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex justify-between items-center">
        <span>⚠️ {lowStock} SKUs need reordering soon</span>
        <span className="text-xs text-red-300">Action recommended</span>
      </div>
    )}

    {/* TABLE */}
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
        <h2 className="text-white font-medium">Replenishment Queue</h2>
        <span className="text-gray-400 text-sm">
          Showing {Math.min(filtered.length, 50)} of {filtered.length}
        </span>
      </div>

      <table className="w-full text-sm text-gray-300">
        <thead className="bg-white/5 text-xs uppercase text-gray-400">
          <tr>
            <th className="p-3 text-left">SKU</th>
            <th className="p-3 text-left">Product</th>
            <th className="p-3 text-center">Stock</th>
            <th className="p-3 text-center">Daily</th>
            <th className="p-3 text-center">Days Left</th>
            <th className="p-3 text-center">Reorder</th>
          </tr>
        </thead>

        <tbody>
          {filtered.slice(0, 50).map((item) => {
            const days = item.days_of_stock || 0;

            return (
              <tr
                key={item.sku}
                className="border-t border-white/5 hover:bg-white/5 transition"
              >
                <td className="p-3 font-medium text-white">{item.sku}</td>

                <td className="p-3 text-gray-300">{item.title}</td>

                <td className="p-3 text-center">
                  {item.inventory}
                </td>

                <td className="p-3 text-center">
                  {item.daily_sales?.toFixed(2)}
                </td>

                <td
                  className={`p-3 text-center font-semibold ${
                    days < 14 ? "text-red-400" : "text-gray-300"
                  }`}
                >
                  {Math.round(days)}
                </td>

                <td className="p-3 text-center text-indigo-400 font-semibold">
                  {Math.round(item.reorder_qty)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

/* KPI COMPONENT */
function KPI({ title, value, highlight }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition">
      <div className="text-sm text-gray-400">{title}</div>

      <div
        className={`text-2xl font-semibold mt-1 ${
          highlight ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
}