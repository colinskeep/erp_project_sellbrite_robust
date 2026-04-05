import { useEffect, useState } from "react";
import axios from "axios";
import Spinner from "../components/Spinner";
import { Card, Button, Input, Section, Table, StatCard, Badge } from "../components/ui";

const API_KEY = process.env.API_KEY;
const token = localStorage.getItem("token");

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("reorder");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    axios
      .get("https://erp-project-sellbrite-robust.onrender.com/replenishment", {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-api-key": API_KEY,
        },
      })
      .then((res) => {
        const cleaned = res.data.filter(
          (i) => i.sku && i.sku.trim() !== ""
        );
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
    (sum, i) => sum + (i.cost || 0) * (i.sold_qty || 0),
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
    <div className="space-y-8">
      {/* HEADER */}
      <Section
        title="Supply Chain Dashboard"
        right={
          <div className="flex gap-3">
            <Input
              placeholder="Search SKU or product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              onChange={(e) => setFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
            >
              <option value="all">All Items</option>
              <option value="low">Low Stock</option>
            </select>

            <select
              onChange={(e) => setSort(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
            >
              <option value="reorder">Reorder Qty</option>
              <option value="revenue">Revenue</option>
              <option value="days">Days Left</option>
            </select>
          </div>
        }
      >
        <p className="text-sm text-gray-500">
          Real-time inventory and replenishment insights
        </p>
      </Section>

      {/* KPI GRID */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Revenue (90d)" value={formatUSD(totalRevenue)} />
        <StatCard label="Estimated Profit" value={formatUSD(profit)} />
        <StatCard
          label="Low Stock SKUs"
          value={lowStock}
          sub="Needs attention"
        />
        <StatCard label="Total SKUs" value={data.length} />
      </div>

      {/* ALERT */}
      {lowStock > 0 && (
        <Card className="p-4 flex justify-between items-center border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-600">
            ⚠️ {lowStock} SKUs need reordering soon
          </div>
          <Badge variant="danger">Action recommended</Badge>
        </Card>
      )}

      {/* TABLE */}
      <Section
        title="Replenishment Queue"
        right={
          <span className="text-sm text-gray-500">
            Showing {Math.min(filtered.length, 50)} of {filtered.length}
          </span>
        }
      >
        <Table
          columns={["SKU", "Product", "Stock", "Daily", "Days Left", "Reorder"]}
          data={filtered.slice(0, 50)}
          renderRow={(item) => {
            const days = item.days_of_stock || 0;

            return (
              <>
                <td className="p-3 font-medium text-gray-900">{item.sku}</td>
                <td className="p-3 text-gray-600">{item.title}</td>
                <td className="p-3 text-center">{item.inventory}</td>
                <td className="p-3 text-center">
                  {item.daily_sales?.toFixed(2)}
                </td>
                <td className="p-3 text-center">
                  <span
                    className={
                      days < 14
                        ? "text-red-600 font-semibold"
                        : "text-gray-600"
                    }
                  >
                    {Math.round(days)}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <Badge variant="info">
                    {Math.round(item.reorder_qty)}
                  </Badge>
                </td>
              </>
            );
          }}
        />
      </Section>
    </div>
  );
}
