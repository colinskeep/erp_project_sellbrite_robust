import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Spinner from "../components/Spinner";

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
    const res = await axios.get(`http://0.0.0.0:8000/purchase-orders/${id}`);
    setPo(res.data);

    const qtyMap = {};
    res.data.items.forEach((item) => {
      qtyMap[item.sku] = item.quantity;
    });
    setQuantityInputs(qtyMap);

    const receiveMap = {};
    res.data.items.forEach((item) => {
      const remaining =
        (Number(item.quantity) || 0) -
        (Number(item.received_quantity) || 0);

      receiveMap[item.sku] = remaining > 0 ? remaining : "";
    });

    setReceiveInputs(receiveMap);

  } catch (err) {
    console.error(err);
    alert("Failed to fetch purchase order");
  } finally {
    setLoading(false);
  }
};

const handleQuantitySave = async (sku, valueOverride = null) => {
  const quantity = Number(
    valueOverride !== null ? valueOverride : quantityInputs[sku]
  ) || 0;

  setUpdatingItem(sku);
  try {
    await axios.put(
      `http://0.0.0.0:8000/purchase-orders/${id}/items/${sku}`,
      { quantity }
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
        `http://0.0.0.0:8000/purchase-orders/${po.id}/items/${sku}/receive`,
        { quantity: qty }
      );

      setReceiveInputs((prev) => ({ ...prev, [sku]: "" }));
      setPo(res.data);
    } catch (err) {
      console.error("Receive failed", err);
      alert("Failed to receive item");
    } finally {
      setReceivingItem(null);
    }
  };

  // ✅ Toggle submit / revert draft
  const toggleSubmit = async () => {
    try {
      if (po.status === "draft") {
        await axios.post(
          `http://0.0.0.0:8000/purchase-orders/${po.id}/submit`
        );
      } else if (po.status === "submitted") {
        await axios.post(
          `http://0.0.0.0:8000/purchase-orders/${po.id}/revert`
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
      await axios.delete(`http://0.0.0.0:8000/purchase-orders/${po.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to delete PO");
    }
  };

  const downloadPO = () => {
    window.open(`http://0.0.0.0:8000/purchase-orders/${po.id}/download`);
  };

  const removeItem = async (sku) => {
    if (!window.confirm("Remove this item?")) return;
    try {
      await axios.delete(
        `http://0.0.0.0:8000/purchase-orders/${po.id}/items/${sku}`
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
        "http://0.0.0.0:8000/products/search",
        { params: { q: search } }
      );

      setResults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const addItem = async (product) => {
    try {
      await axios.post(
        `http://0.0.0.0:8000/purchase-orders/${po.id}/items`,
        {
          sku: product.sku,
          title: product.title,
          quantity: 1,
          cost: product.cost || 0,
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
  if (!po) return <p>PO not found</p>;

  const totalCost = po.items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const cost = Number(item.cost) || 0;
    return sum + qty * cost;
  }, 0);

  // 🎨 Status badge styling
  const statusColors = {
    draft: "bg-gray-200 text-gray-700",
    submitted: "bg-blue-100 text-blue-700",
    received: "bg-green-100 text-green-700",
  };

  const isEditable = po.status === "draft";

  return (
    <div className="p-6 space-y-6">
      
      {/* 🔷 HEADER CARD */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">
            Purchase Order #{po.id}
          </h1>

          <div className="mt-2 text-sm text-gray-500 space-y-1">
            <div><strong>Vendor:</strong> {po.supplier || "—"}</div>
            <div><strong>Date:</strong> {po.created_at || "—"}</div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              statusColors[po.status] || "bg-gray-100"
            }`}
          >
            {po.status?.toUpperCase()}
          </span>

          {/* 🔘 Action Buttons */}
          <div className="flex gap-2">
            {po.status !== "received" && (
              <button
                onClick={toggleSubmit}
                className={`px-4 py-2 text-white rounded-lg text-sm transition ${
                  po.status === "draft"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-yellow-500 hover:bg-yellow-600"
                }`}
              >
                {po.status === "draft" ? "Submit PO" : "Revert to Draft"}
              </button>
            )}

            <button
              onClick={downloadPO}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
            >
              PDF
            </button>

            {isEditable && (
              <button
                onClick={deletePO}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* 🔷 TABLE CARD */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* ➕ ADD PRODUCT */}
        {isEditable && (
          <div className="bg-white border rounded-xl p-4 mb-4">
            <h2 className="text-sm font-semibold mb-2">Add Product</h2>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search SKU or product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border px-3 py-2 rounded-lg text-sm w-64"
              />

              <button
                onClick={searchProducts}
                className="px-3 py-2 bg-gray-800 text-white rounded-lg text-sm"
              >
                Search
              </button>
            </div>

            {results.length > 0 && (
              <div className="mt-3 border rounded-lg">
                {results.map((p) => (
                  <div
                    key={p.sku}
                    className="flex justify-between items-center p-2 border-b text-sm"
                  >
                    <div>
                      <div className="font-medium">{p.sku}</div>
                      <div className="text-gray-500">{p.title}</div>
                    </div>

                    <button
                      onClick={() => addItem(p)}
                      className="px-2 py-1 bg-indigo-600 text-white rounded text-xs"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ➖ ITEM TABLE */}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3"></th>
              <th className="p-3 text-left">SKU</th>
              <th className="p-3 text-left">Title</th>
              <th className="p-3">Ordered</th>
              <th className="p-3">Received</th>
              <th className="p-3">Remaining</th>
              <th className="p-3">Unit Cost</th>
              <th className="p-3">Line Total</th>
              <th className="p-3">Receive</th>
            </tr>
          </thead>

          <tbody>
            {po.items.map((item) => {
              const qty = Number(item.quantity) || 0;
              const received = Number(item.received_quantity) || 0;
              const remaining = qty - received;
              const cost = Number(item.cost) || 0;

              return (
                <tr key={item.sku} className="border-t hover:bg-gray-50">
                  <td className="p-3 text-center">
                    {isEditable && (
                      <button
                        onClick={() => removeItem(item.sku)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        X
                      </button>
                    )}
                  </td>
                  <td className="p-3 font-medium">{item.sku}</td>
                  <td className="p-3">{item.title}</td>

                  <td className="p-3 text-center">
                  {isEditable ? (
                    <input
                      type="number"
                      value={quantityInputs[item.sku] ?? ""}
                      min={0}
                      disabled={updatingItem === item.sku}
                      onChange={(e) => {
                        const value = e.target.value;

                        // update UI instantly
                        setQuantityInputs((prev) => ({
                          ...prev,
                          [item.sku]: value,
                        }));

                        // clear existing timeout
                        if (saveTimeouts[item.sku]) {
                          clearTimeout(saveTimeouts[item.sku]);
                        }

                        // set new debounce save
                        const timeout = setTimeout(() => {
                          handleQuantitySave(item.sku, value);
                        }, 500);

                        setSaveTimeouts((prev) => ({
                          ...prev,
                          [item.sku]: timeout,
                        }));
                      }}
                      onBlur={() => handleQuantitySave(item.sku)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.target.blur();
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      className="border rounded px-2 py-1 w-20 text-center"
                    />
                  ) : (
                    <span className="px-2 py-1 w-20 text-center block">{item.quantity}</span>
                  )}
                  </td>

                  <td className="p-3 text-center">{received}</td>

                  <td className="p-3 text-center">
                    <span
                      className={
                        remaining === 0
                          ? "text-green-600 font-medium"
                          : "text-gray-700"
                      }
                    >
                      {remaining}
                    </span>
                  </td>

                  <td className="p-3 text-right">${cost.toFixed(2)}</td>
                  <td className="p-3 text-right font-medium">
                    ${(qty * cost).toFixed(2)}
                  </td>

                  <td className="p-3">
                    {remaining > 0 ? (
                      <div className="flex gap-2 justify-center">
                        <input
                          type="number"
                          min="1"
                          max={remaining}
                          value={receiveInputs[item.sku] ?? ""}
                          onChange={(e) =>
                            setReceiveInputs((prev) => ({
                              ...prev,
                              [item.sku]: e.target.value,
                            }))
                          }
                          disabled={receivingItem === item.sku}
                          className="w-16 border rounded px-2 py-1 text-center"
                        />
                        <button
                          onClick={() => receiveItem(item.sku)}
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                        >
                          Receive
                        </button>
                      </div>
                    ) : (
                      <span className="text-green-600 text-xs font-medium">
                        Complete
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="border-t bg-gray-50 font-semibold">
              <td colSpan="8" className="p-3 text-right">
                Total:
              </td>
              <td className="p-3">
                ${totalCost.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}