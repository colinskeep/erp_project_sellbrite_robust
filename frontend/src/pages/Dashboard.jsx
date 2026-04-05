import { useEffect, useState } from "react";
import axios from "axios";
import {
  Card,
  Section,
  Table,
  SalesChart,
  SimpleTable,
  KPI,
} from "../components/ui";

const API_KEY = process.env.API_KEY;
const token = localStorage.getItem("token");

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await axios.get(
        "https://erp-project-sellbrite-robust.onrender.com/dashboard",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-api-key": API_KEY,
          },
        }
      );
      setData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!data) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-8">

      {/* 🔷 KPI CARDS */}
      <Section title="Overview">
        <div className="grid grid-cols-4 gap-6">
          <KPI label="Today" value={data.revenue_today} />
          <KPI label="Last 7 Days" value={data.revenue_7d} />
          <KPI label="Last 30 Days" value={data.revenue_30d} />
          <KPI label="Avg Order" value={data.avg_order_value} />
        </div>
      </Section>

      {/* 🔷 MAIN GRID */}
      <div className="grid grid-cols-3 gap-6">

        {/* SALES CHART */}
        <Card className="p-4 col-span-2">
          <h3 className="text-sm font-medium text-gray-600 mb-4">
            Sales (Last 7 Days)
          </h3>
          <SalesChart data={data.sales_7d} />
        </Card>

        {/* TOP SKUS */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-4">
            Top SKUs
          </h3>
          <SimpleTable
            columns={["SKU", "Qty", "Revenue"]}
            data={data.top_skus}
            renderRow={(row) => (
              <>
                <td className="p-2">{row.sku}</td>
                <td className="p-2 text-right">{row.qty}</td>
                <td className="p-2 text-right">${row.revenue.toFixed(2)}</td>
              </>
            )}
          />
        </Card>

        {/* TOP VENDORS */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-4">
            Top Vendors
          </h3>
          <SimpleTable
            columns={["Vendor", "Spend"]}
            data={data.top_vendors}
            renderRow={(row) => (
              <>
                <td className="p-2">{row.vendor}</td>
                <td className="p-2 text-right">${row.spend}</td>
              </>
            )}
          />
        </Card>

      </div>

      {/* 🔷 RECENT ORDERS */}
      <Section title="Recent Orders">
        <Table
          columns={["Order #", "Date", "Revenue"]}
          data={data.recent_orders}
          renderRow={(order) => (
            <>
              <td className="p-3 font-medium">#{order.id}</td>
              <td className="p-3 text-gray-600">
                {new Date(order.date).toLocaleDateString()}
              </td>
              <td className="p-3 text-right font-medium">
                ${order.total}
              </td>
            </>
          )}
        />
      </Section>

    </div>
  );
}