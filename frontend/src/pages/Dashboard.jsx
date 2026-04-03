import { useEffect, useState } from "react";
import axios from "axios";
import Spinner from "../components/Spinner";
const API_KEY = import.meta.env.API_KEY;

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("reorder");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    axios.get("https://erp-project-sellbrite-robust.onrender.com/replenishment", {headers: {
        "x-api-key": API_KEY
      }
    })
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
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Supply Chain Dashboard</h1>

        <div className="flex gap-3">
          <input
            placeholder="Search SKU or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 px-3 py-2 border rounded-lg"
          />

          <select
            onChange={(e) => setFilter(e.target.value)}
            className="w-40 px-3 py-2 border rounded-lg"
          >
            <option value="all">All Items</option>
            <option value="low">Low Stock</option>
          </select>

          <select
            onChange={(e) => setSort(e.target.value)}
            className="w-40 px-3 py-2 border rounded-lg"
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
        <KPI title="Low Stock SKUs" value={lowStock} />
        <KPI title="Total SKUs" value={data.length} />
      </div>

      {/* ALERT */}
      {lowStock > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
          ⚠️ {lowStock} SKUs need reordering soon
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
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
                <tr key={item.sku} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{item.sku}</td>
                  <td className="p-3">{item.title}</td>
                  <td className="p-3 text-center">{item.inventory}</td>
                  <td className="p-3 text-center">
                    {item.daily_sales?.toFixed(2)}
                  </td>
                  <td
                    className={`p-3 text-center font-semibold ${
                      days < 14 ? "text-red-600" : "text-gray-700"
                    }`}
                  >
                    {Math.round(days)}
                  </td>
                  <td className="p-3 text-center text-indigo-600 font-bold">
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
}

/* KPI COMPONENT */
function KPI({ title, value }) {
  return (
    <div className="bg-white p-5 rounded-2xl border shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}