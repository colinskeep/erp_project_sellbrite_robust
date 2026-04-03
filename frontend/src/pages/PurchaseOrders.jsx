import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Spinner from "../components/Spinner";
const API_KEY = import.meta.env.API_KEY;

export default function PurchaseOrders() {
  const [pos, setPos] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔍 Filters
  const [search, setSearch] = useState("");
  const [vendor, setVendor] = useState("");
  const [vendors, setVendors] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    fetchPOs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [search, vendor, startDate, endDate, pos]);

  const fetchPOs = async () => {
    try {
      const res = await axios.get("https://erp-project-sellbrite-robust.onrender.com/purchase-orders", { headers: {
        "x-api-key": API_KEY
      }});

      if (Array.isArray(res.data)) {
        const sorted = res.data.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        setPos(sorted);

        // extract vendors
        const uniqueVendors = [
          ...new Set(sorted.map((p) => p.supplier)),
        ];
        setVendors(uniqueVendors);
      }
    } catch (err) {
      console.error(err);
      setPos([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let data = [...pos];

    // 🔍 Search (PO # or vendor)
    if (search) {
      data = data.filter(
        (p) =>
          p.id.toString().includes(search) ||
          (p.supplier || "")
            .toLowerCase()
            .includes(search.toLowerCase())
      );
    }

    // 🏷 Vendor filter
    if (vendor) {
      data = data.filter((p) => p.supplier === vendor);
    }

    // 📅 Date range
    if (startDate) {
      data = data.filter(
        (p) => new Date(p.created_at) >= new Date(startDate)
      );
    }

    if (endDate) {
      data = data.filter(
        (p) => new Date(p.created_at) <= new Date(endDate)
      );
    }

    setFiltered(data);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  const statusColors = {
    draft: "bg-gray-200 text-gray-700",
    submitted: "bg-blue-100 text-blue-700",
    received: "bg-green-100 text-green-700",
  };

  return (
    <div className="p-6 space-y-6">

      {/* 🔷 HEADER */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm p-6 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and track all purchase orders
          </p>
        </div>

        {/* ⚡ Create PO */}
        <button
          onClick={() => navigate("/replenishment")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition"
        >
          + Create PO
        </button>
      </div>

      {/* 🔷 FILTER BAR */}
      <div className="bg-white border border-gray-200 p-6 shadow-sm rounded-xl p-4 flex flex-wrap gap-3 items-center">

        {/* 🔍 Search */}
        <input
          type="text"
          placeholder="Search PO # or Vendor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-3 py-2 rounded-lg text-sm w-64"
        />

        {/* 🏷 Vendor */}
        <select
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          className="border px-3 py-2 rounded-lg text-sm"
        >
          <option value="">All Vendors</option>
          {vendors
            .filter((v) => v)
            .map((v, i) => (
              <option key={i} value={v}>
                {v}
              </option>
            ))}
        </select>

        {/* 📅 Date Range */}
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border px-3 py-2 rounded-lg text-sm"
        />

        <span className="text-gray-400">to</span>

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border px-3 py-2 rounded-lg text-sm"
        />
      </div>

      {/* 🔷 TABLE */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex justify-between items-start overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3 text-left">PO #</th>
              <th className="p-3 text-left">Vendor</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right">Created</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length > 0 ? (
              filtered.map((po) => {
                const total =
                  po.items?.reduce(
                    (sum, item) =>
                      sum +
                      (Number(item.quantity) || 0) *
                        (Number(item.cost) || 0),
                    0
                  ) || 0;

                return (
                  <tr
                    key={po.id}
                    onClick={() =>
                      navigate(`/purchase-orders/${po.id}`)
                    }
                    className="border-t hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="p-3 font-medium">#{po.id}</td>
                    <td className="p-3">{po.supplier || "—"}</td>

                    <td className="p-3 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          statusColors[po.status] || "bg-gray-100"
                        }`}
                      >
                        {po.status?.toUpperCase()}
                      </span>
                    </td>

                    <td className="p-3 text-right font-medium">
                      ${Number(po.total || 0).toFixed(2)}
                    </td>

                    <td className="p-3 text-right text-gray-500 text-xs">
                      {po.created_at
                        ? new Date(
                            po.created_at
                          ).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" className="p-10 text-center text-gray-400">
                  No matching purchase orders
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}