// ===============================
// AZFT ERP DESIGN SYSTEM
// Clean Component Library (Drop-in)
// ===============================

// Folder Structure Recommendation:
// /components/ui/
//   - Card.jsx
//   - Button.jsx
//   - Input.jsx
//   - Table.jsx
//   - Section.jsx
//   - Badge.jsx

// ===============================
// 🎨 DESIGN TOKENS (Tailwind Usage Guide)
// ===============================
// text-primary    -> text-gray-900
// text-secondary  -> text-gray-600
// text-muted      -> text-gray-500
// border-base     -> border border-gray-200
// border-soft     -> border border-gray-100
// bg-subtle       -> bg-gray-50
// accent          -> blue-600

// ===============================
// 🔷 CARD
// ===============================
export function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

// ===============================
// 🔷 BUTTON
// ===============================
export function Button({ children, variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-gray-600 hover:bg-gray-100",
  };

  return (
    <button
      {...props}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// ===============================
// 🔷 INPUT
// ===============================
export function Input(props) {
  return (
    <input
      {...props}
      className="border border-gray-300 bg-white text-gray-900 px-3 py-2 rounded-lg text-sm 
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />
  );
}

// ===============================
// 🔷 SECTION
// ===============================
export function Section({ title, right, children }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

// ===============================
// 🔷 BADGE
// ===============================
export function Badge({ children, variant = "default" }) {
  const styles = {
    default: "bg-gray-100 text-gray-600",
    success: "bg-green-100 text-green-600",
    warning: "bg-yellow-100 text-yellow-700",
    danger: "bg-red-100 text-red-600",
    info: "bg-blue-100 text-blue-600",
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
}

// ===============================
// 🔷 TABLE
// ===============================
export function Table({ columns, data, renderRow, emptyState, rowProps }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
          <tr>
            {columns.map((col) => (
              <th key={col} className="p-3 text-left font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
        {data.map((row, i) => (
            <tr
            key={row.id || i}
            {...(rowProps ? rowProps(row) : {})}
            >
            {renderRow(row)}
            </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}

// ===============================
// 🔷 STAT CARD (Dashboard)
// ===============================
export function StatCard({ label, value, sub }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </Card>
  );
}

// ===============================
// 🔷 EMPTY STATE
// ===============================
export function EmptyState({ title, description }) {
  return (
    <div className="text-center py-12 border border-gray-200 rounded-xl bg-white">
      <div className="text-gray-900 font-medium">{title}</div>
      <div className="text-gray-500 text-sm mt-1">{description}</div>
    </div>
  );
}

// ===============================
//  KPI
// ===============================

export default function KpiCard({ title, value, trend }) {
  const isUp = trend >= 0;

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="text-sm text-gray-500">{title}</div>

      <div className="text-2xl font-semibold mt-1">
        ${value.toLocaleString()}
      </div>

      {trend !== undefined && (
        <div
          className={`text-sm mt-2 ${
            isUp ? "text-green-500" : "text-red-500"
          }`}
        >
          {isUp ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

// ===============================
//  Sales Chart
// ===============================
import {
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function SalesChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <XAxis dataKey="date" />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="total"
          stroke="#6366f1"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ===============================
//  Simple Table
// ===============================

export function SimpleTable({ columns, data, renderRow }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-gray-500 text-xs uppercase">
          {columns.map((col, i) => (
            <th key={i} className="p-2 text-left">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className="border-t">
            {renderRow(row)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}


// ===============================
// 🔷 USAGE EXAMPLE
// ===============================

/*
import { Card, Button, Input, Section, Table, StatCard } from "@/components/ui";

<Section title="Dashboard">
  <div className="grid grid-cols-4 gap-4">
    <StatCard label="Revenue" value="$1.5M" />
    <StatCard label="Profit" value="$900K" />
  </div>
</Section>

<Card className="p-4">
  <Input placeholder="Search..." />
  <Button>Search</Button>
</Card>
*/
