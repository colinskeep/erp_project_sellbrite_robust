import { useEffect, useState } from "react";
import axios from "axios";
import Spinner from "../components/Spinner";
import Skeleton from "../components/Skeleton";
import { Card, Button, Section, Table, StatCard, Badge } from "../components/ui";

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
    if (selected.length === 0) return alert("No items selected");

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
        { supplier, items: grouped[supplier] },
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
      <div className="space-y-4">
        <Spinner />
        <Card className="p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full mb-2" />
          ))}
        </Card>
      </div>
    );
  }

  const actionableItems = data.filter((item) => item.needed > 0);

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <Section
        title="Replenishment"
        right={
          <div className="flex items-center gap-3">
            <select
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
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

            <Button
              onClick={createPO}
              disabled={selected.length === 0}
            >
              Create PO ({selected.length})
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-500">
          Identify low-stock items and generate purchase orders
        </p>
      </Section>

      {/* SUMMARY */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Items needing reorder"
          value={actionableItems.length}
        />
        <StatCard label="Selected" value={selected.length} />
      </div>

      {/* TABLE */}
      <Section title="Replenishment Queue">
        <Table
          columns={["", "SKU", "Vendor", "Title", "Stock", "On Order", "Needed"]}
          data={actionableItems}
          renderRow={(item) => {
            const isSelected = selected.find((i) => i.sku === item.sku);

            return (
              <>
                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={!!isSelected}
                    onChange={() => toggleItem(item)}
                    className="accent-blue-600"
                  />
                </td>

                <td className="p-3 font-medium text-gray-900">{item.sku}</td>
                <td className="p-3 text-gray-600">{item.vendor}</td>
                <td className="p-3 text-gray-600">{item.title}</td>

                <td className="p-3 text-center">{item.inventory}</td>
                <td className="p-3 text-center">{item.on_order}</td>

                <td className="p-3 text-center">
                  <Badge variant="warning">
                    {Math.ceil(item.needed)}
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