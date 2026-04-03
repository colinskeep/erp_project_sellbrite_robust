import { useEffect, useState } from "react";
import axios from "axios";
import Skeleton from "../components/Skeleton";
import Spinner from "../components/Spinner";
const API_KEY = import.meta.env.API_KEY;

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
        params: vendor ? { vendor } : {},
      }, { 'headers': {
        "x-api-key": API_KEY
      }})
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
      await axios.post("https://erp-project-sellbrite-robust.onrender.com/purchase-orders", {
        supplier,
        items: grouped[supplier],
      }, { 'headers': {
        "x-api-key": API_KEY
      }});
    }

    alert("Purchase Orders created");
    setSelected([]);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Spinner />
        <div className="bg-white p-6 rounded-2xl border">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full mb-2" />
          ))}
        </div>
      </div>
    );
  }

  const actionableItems = data.filter((item) => item.needed > 0);

  return (
    <div className="p-6 space-y-6">

      {/* 🔷 HEADER */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Replenishment</h1>
          <p className="text-sm text-gray-500 mt-1">
            Identify low-stock items and generate purchase orders
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <select
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="border px-3 py-2 rounded-lg text-sm"
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
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition disabled:opacity-50"
            disabled={selected.length === 0}
          >
            Create PO ({selected.length})
          </button>
        </div>
      </div>

      {/* 🔷 SUMMARY BAR */}
      <div className="bg-white border border-gray-200 p-6 shadow-sm rounded-xl flex justify-between text-sm">
        <div>
          <span className="text-gray-500">Items needing reorder:</span>{" "}
          <span className="font-semibold">{actionableItems.length}</span>
        </div>
        <div>
          <span className="text-gray-500">Selected:</span>{" "}
          <span className="font-semibold">{selected.length}</span>
        </div>
      </div>

      {/* 🔷 TABLE */}
      <div className="overflow-x-auto bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
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
                  className={`border-t hover:bg-gray-50 ${
                    isSelected ? "bg-indigo-50" : ""
                  }`}
                >
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onChange={() => toggleItem(item)}
                    />
                  </td>
                  <td className="p-3 font-medium">{item.sku}</td>
                  <td className="p-3">{item.vendor}</td>
                  <td className="p-3">{item.title}</td>

                  <td className="p-3 text-center">{item.inventory}</td>
                  <td className="p-3 text-center">{item.on_order}</td>

                  <td className="p-3 text-center">
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md font-semibold text-xs">
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