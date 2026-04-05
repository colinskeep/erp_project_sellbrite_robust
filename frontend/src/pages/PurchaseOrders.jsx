import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Spinner from "../components/Spinner";
import {
  Card,
  Button,
  Section,
  Table,
  Badge,
} from "../components/ui";

const API_KEY = process.env.API_KEY;
const token = localStorage.getItem("token");

export default function PurchaseOrders() {
  const [pos, setPos] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);

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
      const res = await axios.get(
        "https://erp-project-sellbrite-robust.onrender.com/purchase-orders",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-api-key": API_KEY,
          },
        }
      );

      if (Array.isArray(res.data)) {
        const sorted = res.data.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        setPos(sorted);

        const uniqueVendors = [
          ...new Set(sorted.map((p) => p.supplier).filter(Boolean)),
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

    if (search) {
      data = data.filter(
        (p) =>
          p.id.toString().includes(search) ||
          (p.supplier || "")
            .toLowerCase()
            .includes(search.toLowerCase())
      );
    }

    if (vendor) {
      data = data.filter((p) => p.supplier === vendor);
    }

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

  const getStatusVariant = (status) => {
    if (status === "submitted") return "info";
    if (status === "received") return "success";
    return "default";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <Section
        title="Purchase Orders"
        right={
          <Button onClick={() => navigate("/replenishment")}>
            + Create PO
          </Button>
        }
      >
        <p className="text-sm text-gray-500">
          Manage and track all purchase orders
        </p>
      </Section>

      {/* FILTERS */}
      <Card className="p-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search PO # or Vendor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64"
        />

        <select
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Vendors</option>
          {vendors.map((v, i) => (
            <option key={i} value={v}>
              {v}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />

        <span className="text-gray-500">to</span>

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </Card>

      {/* TABLE */}
      <Section title="All Purchase Orders">
        <Table
          columns={["PO #", "Vendor", "Status", "Total", "Created"]}
          data={filtered}
          renderRow={(po) => {
            // ✅ FIX: use backend total OR fallback calculation
            const total =
              Number(po.total) ||
              (po.items?.reduce((sum, item) => {
                const qty = Number(item.quantity) || 0;
                const cost = Number(item.cost) || 0;
                return sum + qty * cost;
              }, 0) || 0);

            return (
              <tr
                key={po.id}
                onClick={() => navigate(`/purchase-orders/${po.id}`)}
                className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer transition"
              >
                <td className="p-3 font-medium text-gray-900">
                  #{po.id}
                </td>

                <td className="p-3 text-gray-600">
                  {po.supplier || "—"}
                </td>

                <td className="p-3 text-center">
                  <Badge variant={getStatusVariant(po.status)}>
                    {po.status?.toUpperCase()}
                  </Badge>
                </td>

                <td className="p-3 text-right font-medium text-gray-900">
                  ${total.toFixed(2)}
                </td>

                <td className="p-3 text-right text-gray-500 text-xs">
                  {po.created_at
                    ? new Date(po.created_at).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            );
          }}
          emptyState={
            <div className="text-center text-gray-500 py-10">
              No matching purchase orders
            </div>
          }
        />
      </Section>
    </div>
  );
}