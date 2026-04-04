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
  const [quantityInputs, setQuantityInputs] = useState({});
  const [receiveInputs, setReceiveInputs] = useState({});
  const [saveTimeouts, setSaveTimeouts] = useState({});
  const [receivingItem, setReceivingItem] = useState(null);
  const [recentlyReceived, setRecentlyReceived] = useState({});
  const [receivingMode, setReceivingMode] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  const handleQuantitySave = (sku, value) => {
    if (saveTimeouts[sku]) clearTimeout(saveTimeouts[sku]);

    const timeout = setTimeout(async () => {
      try {
        await axios.put(
          `https://erp-project-sellbrite-robust.onrender.com/purchase-orders/${id}/items/${sku}`,
          { quantity: Number(value) || 0 },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "x-api-key": API_KEY,
            },
          }
        );
      } catch (err) {
        console.error(err);
      }
    }, 400);

    setSaveTimeouts((prev) => ({ ...prev, [sku]: timeout }));
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

      setPo(res.data);
      setReceiveInputs((prev) => ({ ...prev, [sku]: "" }));

      // ✨ success flash
      setRecentlyReceived((prev) => ({ ...prev, [sku]: true }));
      setTimeout(() => {
        setRecentlyReceived((prev) => ({ ...prev, [sku]: false }));
      }, 1200);
    } catch (err) {
      console.error(err);
    } finally {
      setReceivingItem(null);
    }
  };

  if (loading) return <Spinner />;
  if (!po) return <p className="text-gray-400">Not found</p>;

  const totalCost = po.items.reduce((sum, item) => {
    return (
      sum +
      (Number(item.quantity) || 0) * (Number(item.cost) || 0)
    );
  }, 0);

  const isEditable = po.status === "draft";

  return (
    <div className="space-y-6">

      {/* 🔷 STICKY HEADER */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-black/30 border-b border-white/10 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-white">
            PO #{po.id}
          </h1>
          <div className="text-xs text-gray-400">
            {po.supplier} •{" "}
            {new Date(po.created_at).toLocaleDateString()}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setReceivingMode(!receivingMode)}
            className={`px-3 py-1 rounded-lg text-xs ${
              receivingMode
                ? "bg-green-500 text-white"
                : "bg-white/10 text-gray-300"
            }`}
          >
            Receiving Mode
          </button>

          <div className="text-white font-semibold text-sm">
            ${totalCost.toFixed(2)}
          </div>
        </div>
      </div>

      {/* 🔷 TABLE */}
      <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-400 border-b border-white/10">
            <tr>
              <th className="p-3 text-left">SKU</th>
              <th className="p-3 text-left">Title</th>
              <th className="p-3 text-center">Qty</th>
              <th className="p-3 text-center">Received</th>
              <th className="p-3 text-center">Remaining</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>

          <tbody>
            {po.items.map((item) => {
              const qty = Number(item.quantity) || 0;
              const received =
                Number(item.received_quantity) || 0;
              const remaining = qty - received;
              const total = qty * (Number(item.cost) || 0);

              return (
                <tr
                  key={item.sku}
                  className={`border-t border-white/5 transition ${
                    recentlyReceived[item.sku]
                      ? "bg-green-500/20"
                      : "hover:bg-white/5"
                  }`}
                >
                  <td className="p-3 text-white font-medium">
                    {item.sku}
                  </td>

                  <td className="p-3 text-gray-300">
                    {item.title}
                  </td>

                  <td className="p-3 text-center">
                    {isEditable ? (
                      <input
                        value={quantityInputs[item.sku]}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuantityInputs((prev) => ({
                            ...prev,
                            [item.sku]: val,
                          }));
                          handleQuantitySave(item.sku, val);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.target.blur();
                        }}
                        className="w-16 text-center bg-white/10 border border-white/10 rounded text-white"
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

                  <td className="p-3 text-right text-white font-medium">
                    ${total.toFixed(2)}
                  </td>

                  <td className="p-3 text-center">
                    {remaining > 0 && receivingMode ? (
                      <button
                        onClick={() => receiveItem(item.sku)}
                        disabled={receivingItem === item.sku}
                        className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs"
                      >
                        Receive All
                      </button>
                    ) : remaining > 0 ? (
                      <div className="flex justify-center gap-1">
                        <input
                          value={receiveInputs[item.sku] ?? ""}
                          onChange={(e) =>
                            setReceiveInputs((prev) => ({
                              ...prev,
                              [item.sku]: e.target.value,
                            }))
                          }
                          className="w-14 text-center bg-white/10 border border-white/10 rounded text-white text-xs"
                        />
                        <button
                          onClick={() => receiveItem(item.sku)}
                          className="px-2 bg-green-500 text-white rounded text-xs"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <span className="text-green-400 text-xs">
                        ✓ Done
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 🔷 STICKY FOOTER TOTAL */}
        <div className="sticky bottom-0 bg-black/40 backdrop-blur-xl border-t border-white/10 px-6 py-3 flex justify-between text-white font-semibold">
          <span>Total</span>
          <span>${totalCost.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}