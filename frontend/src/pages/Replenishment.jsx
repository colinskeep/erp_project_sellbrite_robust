import { useEffect, useState } from "react";
import axios from "axios";
import Skeleton from "../components/Skeleton";
import Spinner from "../components/Spinner";

const API_KEY = process.env.API_KEY;
const token = localStorage.getItem("token");

export default function Replenishment() {
  const [data, setData] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState("");
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    setLoading(true);

    axios
      .get("https://erp-project-sellbrite-robust.onrender.com/replenishment", {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-api-key": API_KEY,
        },
        params: vendor ? { vendor } : {},
      })
      .then((res) => {
        const cleaned = res.data.filter(
          (item) => item.sku && item.sku.trim() !== ""
        );
        setData(cleaned);

        const uniqueVendors = [...new Set(cleaned.map((i) => i.vendor))];
        setVendors(uniqueVendors);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [vendor]);

  const toggleItem = (item) => {
    setSelected((prev) =>
      prev.find((i) => i.sku === item.sku)
        ? prev.filter((i) => i.sku !== item.sku)
        : [...prev, item]
    );
  };

  const getSupplier = (title) => {
    if (!title) return "UNKNOWN";
    return title.split(" ")[0].toUpperCase();
  };

  const createPO = async () => {
    if (selected.length === 0) {
      alert("No items selected");
      return;
    }

    const grouped = {};

    selected.forEach((item) => {
      const supplier = getSupplier(item.title);

      if (!grouped[supplier]) grouped[supplier] = [];

      grouped[supplier].push({
        sku: item.sku,
        title: item.title,
        quantity: Math.ceil(item.needed),
        cost: item.cost,
      });
    });

    for (const supplier in grouped) {
      await axios.post(
        "https://erp-project-sellbrite-robust.onrender.com/purchase-orders",
        {
          supplier,
          items: grouped[supplier],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-api-key": API_KEY,
          },
        }
      );
    }

    alert("Purchase Orders created");
    setSelected([]);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Spinner />
        <div className="bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-white/10">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full mb-2" />
          ))}
        </div>
      </div>
    );
  }

  const actionableItems = data.filter((item) => item.needed > 0);

  return (
    <div className="space-y-6">

      {/* 🔷 HEADER */}
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-lg flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-white">Replenishment</h1>
          <p className="text-sm text-gray-300 mt-1">
            Identify low-stock items and generate purchase orders
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="bg-white/10 border border-white/10 text-gray-200 px-3 py-2 rounded-lg text-sm focus:outline-none"
          >
            <option value="">All Vendors</option>
            {vendors
              .filter((v) => v && v !== "UNKNOWN")
              .map((v, idx) => (
                <option key={`${v}-${idx}`} value={v}>
                  {v}
                </option>
              ))}
          </select>

          <button
            onClick={createPO}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition shadow-md disabled:opacity-40"
            disabled={selected.length === 0}
          >
            Create PO ({selected.length})
          </button>
        </div>
      </div>

      {/* 🔷 SUMMARY */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/10 backdrop-blur-xl border border-white/10 p-5 rounded-xl shadow-md">
          <p className="text-sm text-gray-300">Items needing reorder</p>
          <p className="text-2xl font-semibold mt-1 text-white">
            {actionableItems.length}
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/10 p-5 rounded-xl shadow-md">
          <p className="text-sm text-gray-300">Selected</p>
          <p className="text-2xl font-semibold mt-1 text-white">
            {selected.length}
          </p>
        </div>
      </div>

      {/* 🔷 TABLE */}
      <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-gray-400 border-b border-white/10">
            <tr>
              <th className="p-3"></th>
              <th className="p-3 text-left">SKU</th>
              <th className="p-3 text-left">Vendor</th>
              <th className="p-3 text-left">Title</th>
              <th className="p-3 text-center">Stock</th>
              <th className="p-3 text-center">On Order</th>
              <th className="p-3 text-center">Needed</th>
            </tr>
          </thead>

          <tbody>
            {actionableItems.map((item) => {
              const isSelected = selected.find((i) => i.sku === item.sku);

              return (
                <tr
                  key={item.sku}
                  className={`border-t border-white/5 transition hover:bg-white/5 ${
                    isSelected ? "bg-indigo-500/20" : ""
                  }`}
                >
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onChange={() => toggleItem(item)}
                      className="accent-indigo-500"
                    />
                  </td>

                  <td className="p-3 font-medium text-white">{item.sku}</td>
                  <td className="p-3 text-gray-300">{item.vendor}</td>
                  <td className="p-3 text-gray-300">{item.title}</td>

                  <td className="p-3 text-center text-gray-300">
                    {item.inventory}
                  </td>
                  <td className="p-3 text-center text-gray-300">
                    {item.on_order}
                  </td>

                  <td className="p-3 text-center">
                    <span className="px-2 py-1 bg-orange-400/20 text-orange-300 rounded-md font-semibold text-xs">
                      {Math.ceil(item.needed)}
                    </span>
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