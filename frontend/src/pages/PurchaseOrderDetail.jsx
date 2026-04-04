import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Spinner from "../components/Spinner";

const API_KEY = process.env.API_KEY;
const token = localStorage.getItem("token");

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingItem, setUpdatingItem] = useState(null);
  const [receiveInputs, setReceiveInputs] = useState({});
  const [receivingItem, setReceivingItem] = useState(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [quantityInputs, setQuantityInputs] = useState({});
  const [saveTimeouts, setSaveTimeouts] = useState({});

  useEffect(() => {
    fetchPO();
  }, [id]);

  const fetchPO = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `https://erp-project-sellbrite-robust.onrender.com/purchase-orders/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-api-key": API_KEY,
          },
        }
      );

      setPo(res.data);

      const qtyMap = {};
      const receiveMap = {};

      res.data.items.forEach((item) => {
        qtyMap[item.sku] = item.quantity;

        const remaining =
          (Number(item.quantity) || 0) -
          (Number(item.received_quantity) || 0);

        receiveMap[item.sku] = remaining > 0 ? remaining : "";
      });

      setQuantityInputs(qtyMap);
      setReceiveInputs(receiveMap);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch purchase order");
    } finally {
      setLoading(false);
    }
  };

  const handleQuantitySave = async (sku, valueOverride = null) => {
    const quantity =
      Number(
        valueOverride !== null ? valueOverride : quantityInputs[sku]
      ) || 0;

    setUpdatingItem(sku);
    try {
      await axios.put(
        `https://erp-project-sellbrite-robust.onrender.com/purchase-orders/${id}/items/${sku}`,
        { quantity },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-api-key": API_KEY,
          },
        }
      );

      setPo((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.sku === sku ? { ...item, quantity } : item
        ),
      }));
    } catch (err) {
      console.error(err);
      alert("Failed to update quantity");
    } finally {
      setUpdatingItem(null);
    }
  };

  const receiveItem = async (sku) => {
    const qty = Number(receiveInputs[sku]) || 0;
    if (qty <= 0) return;

    setReceivingItem(sku);
    try {
      const res = await axios.post(
        `https://erp-project-sellbrite-robust.onrender.com/purchase-orders/${po.id}/items/${sku}/receive`,
        { quantity: qty },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-api-key": API_KEY,
          },
        }
      );

      setReceiveInputs((prev) => ({ ...prev, [sku]: "" }));
      setPo(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to receive item");
    } finally {
      setReceivingItem(null);
    }
  };

  const toggleSubmit = async () => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-api-key": API_KEY,
        },
      };

      if (po.status === "draft") {
        await axios.post(
          `https://erp-project-sellbrite-robust.onrender.com/purchase-orders/${po.id}/submit`,
          {},
          config
        );
      } else if (po.status === "submitted") {
        await axios.post(
          `https://erp-project-sellbrite-robust.onrender.com/purchase-orders/${po.id}/revert`,
          {},
          config
        );
      }

      fetchPO();
    } catch (err) {
      console.error(err);
      alert("Failed to update PO status");
    }
  };

  const deletePO = async () => {
    if (!window.confirm("Delete this PO?")) return;
    try {
      await axios.delete(
        `https://erp-project-sellbrite-robust.onrender.com/purchase-orders/${po.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-api-key": API_KEY,
          },
        }
      );
    } catch (err) {
      console.error(err);
      alert("Failed to delete PO");
    }
  };

  const downloadPO = () => {
    window.open(
      `https://erp-project-sellbrite-robust.onrender.com/purchase-orders/${po.id}/download`
    );
  };

  const removeItem = async (sku) => {
    if (!window.confirm("Remove this item?")) return;
    try {
      await axios.delete(
        `https://erp-project-sellbrite-robust.onrender.com/purchase-orders/${po.id}/items/${sku}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-api-key": API_KEY,
          },
        }
      );
      fetchPO();
    } catch (err) {
      console.error(err);
      alert("Failed to remove item");
    }
  };

  const searchProducts = async () => {
    if (!search) return;

    try {
      const res = await axios.get(
        "https://erp-project-sellbrite-robust.onrender.com/products/search",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-api-key": API_KEY,
          },
          params: { q: search },
        }
      );

      setResults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const addItem = async (product) => {
    try {
      await axios.post(
        `https://erp-project-sellbrite-robust.onrender.com/purchase-orders/${po.id}/items`,
        {
          sku: product.sku,
          title: product.title,
          quantity: 1,
          cost: product.cost || 0,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-api-key": API_KEY,
          },
        }
      );

      setResults([]);
      setSearch("");
      fetchPO();
    } catch (err) {
      console.error(err);
      alert("Failed to add item");
    }
  };

  if (loading) return <Spinner />;
  if (!po) return <p className="text-gray-400">PO not found</p>;

  const totalCost = po.items.reduce((sum, item) => {
    return (
      sum +
      (Number(item.quantity) || 0) * (Number(item.cost) || 0)
    );
  }, 0);

  const statusColors = {
    draft: "bg-white/10 text-gray-300",
    submitted: "bg-blue-500/20 text-blue-300",
    received: "bg-green-500/20 text-green-300",
  };

  const isEditable = po.status === "draft";

  return (
    <div className="space-y-6">

      {/* 🔷 HEADER */}
      <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-lg flex justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            PO #{po.id}
          </h1>
          <div className="text-sm text-gray-400 mt-2 space-y-1">
            <div>Vendor: {po.supplier || "—"}</div>
            <div>
              Date:{" "}
              {new Date(po.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[po.status]}`}
          >
            {po.status?.toUpperCase()}
          </span>

          <div className="flex gap-2">
            {po.status !== "received" && (
              <button
                onClick={toggleSubmit}
                className={`px-4 py-2 rounded-lg text-sm text-white transition ${
                  po.status === "draft"
                    ? "bg-green-500 hover:bg-green-600"
                    : "bg-yellow-500 hover:bg-yellow-600"
                }`}
              >
                {po.status === "draft"
                  ? "Submit"
                  : "Revert"}
              </button>
            )}

            <button
              onClick={downloadPO}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm"
            >
              PDF
            </button>

            {isEditable && (
              <button
                onClick={deletePO}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 🔷 ADD PRODUCT */}
      {isEditable && (
        <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-md">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search SKU or product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white/10 border border-white/10 text-gray-200 px-3 py-2 rounded-lg text-sm w-64"
            />
            <button
              onClick={searchProducts}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm"
            >
              Search
            </button>
          </div>

          {results.length > 0 && (
            <div className="mt-3 border border-white/10 rounded-lg overflow-hidden">
              {results.map((p) => (
                <div
                  key={p.sku}
                  className="flex justify-between items-center px-3 py-2 border-b border-white/5 text-sm hover:bg-white/5"
                >
                  <div>
                    <div className="text-white font-medium">
                      {p.sku}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {p.title}
                    </div>
                  </div>

                  <button
                    onClick={() => addItem(p)}
                    className="px-2 py-1 bg-indigo-500 text-white rounded text-xs"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 🔷 TABLE */}
      <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-gray-400 border-b border-white/10">
            <tr>
              <th className="p-3"></th>
              <th className="p-3 text-left">SKU</th>
              <th className="p-3 text-left">Title</th>
              <th className="p-3 text-center">Ordered</th>
              <th className="p-3 text-center">Received</th>
              <th className="p-3 text-center">Remaining</th>
              <th className="p-3 text-right">Cost</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-center">Receive</th>
            </tr>
          </thead>

          <tbody>
            {po.items.map((item) => {
              const qty = Number(item.quantity) || 0;
              const received =
                Number(item.received_quantity) || 0;
              const remaining = qty - received;
              const cost = Number(item.cost) || 0;

              return (
                <tr
                  key={item.sku}
                  className="border-t border-white/5 hover:bg-white/5 transition"
                >
                  <td className="p-3 text-center">
                    {isEditable && (
                      <button
                        onClick={() => removeItem(item.sku)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </td>

                  <td className="p-3 text-white font-medium">
                    {item.sku}
                  </td>

                  <td className="p-3 text-gray-300">
                    {item.title}
                  </td>

                  <td className="p-3 text-center">
                    {isEditable ? (
                      <input
                        type="number"
                        value={quantityInputs[item.sku] ?? ""}
                        className="bg-white/10 border border-white/10 rounded px-2 py-1 w-20 text-center text-white"
                        onChange={(e) => {
                          const value = e.target.value;

                          setQuantityInputs((prev) => ({
                            ...prev,
                            [item.sku]: value,
                          }));

                          if (saveTimeouts[item.sku]) {
                            clearTimeout(saveTimeouts[item.sku]);
                          }

                          const timeout = setTimeout(() => {
                            handleQuantitySave(item.sku, value);
                          }, 500);

                          setSaveTimeouts((prev) => ({
                            ...prev,
                            [item.sku]: timeout,
                          }));
                        }}
                      />
                    ) : (
                      qty
                    )}
                  </td>

                  <td className="p-3 text-center text-gray-300">
                    {received}
                  </td>

                  <td className="p-3 text-center">
                    <span
                      className={
                        remaining === 0
                          ? "text-green-400"
                          : "text-gray-300"
                      }
                    >
                      {remaining}
                    </span>
                  </td>

                  <td className="p-3 text-right text-gray-300">
                    ${cost.toFixed(2)}
                  </td>

                  <td className="p-3 text-right text-white font-medium">
                    ${(qty * cost).toFixed(2)}
                  </td>

                  <td className="p-3 text-center">
                    {remaining > 0 ? (
                      <div className="flex justify-center gap-2">
                        <input
                          type="number"
                          value={receiveInputs[item.sku] ?? ""}
                          onChange={(e) =>
                            setReceiveInputs((prev) => ({
                              ...prev,
                              [item.sku]: e.target.value,
                            }))
                          }
                          className="w-16 bg-white/10 border border-white/10 rounded px-2 py-1 text-center text-white"
                        />
                        <button
                          onClick={() => receiveItem(item.sku)}
                          className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <span className="text-green-400 text-xs">
                        Complete
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="border-t border-white/10 text-white font-semibold">
              <td colSpan="8" className="p-3 text-right">
                Total
              </td>
              <td className="p-3 text-center">
                ${totalCost.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}