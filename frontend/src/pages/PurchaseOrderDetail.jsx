import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Spinner from "../components/Spinner";
import { Card, Button, Section, Table, Badge} from "../components/ui";

const API_KEY = process.env.API_KEY;
const token = localStorage.getItem("token");

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [receiveInputs, setReceiveInputs] = useState({});
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
    } finally {
      setLoading(false);
    }
  };

  const handleQuantitySave = async (sku, value) => {
    const quantity = Number(value) || 0;

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
      items: prev.items.map((i) =>
        i.sku === sku ? { ...i, quantity } : i
      ),
    }));
  };

  const receiveItem = async (sku) => {
    const qty = Number(receiveInputs[sku]) || 0;
    if (qty <= 0) return;

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
  };

  const toggleSubmit = async () => {
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
  };

  const deletePO = async () => {
    if (!window.confirm("Delete this PO?")) return;
    await axios.delete(
      `https://erp-project-sellbrite-robust.onrender.com/purchase-orders/${po.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-api-key": API_KEY,
        },
      }
    );
  };

  const searchProducts = async () => {
    if (!search) return;

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
  };

  const addItem = async (product) => {
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
  };

  if (loading) return <Spinner />;
  if (!po) return <p className="text-gray-500">PO not found</p>;

  const totalCost = po.items.reduce((sum, item) => {
    return sum + item.quantity * item.cost;
  }, 0);

  const isEditable = po.status === "draft";

  const getStatusVariant = (status) => {
    if (status === "submitted") return "info";
    if (status === "received") return "success";
    return "default";
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <Section
        title={`PO #${po.id}`}
        right={
          <div className="flex gap-2">
            {po.status !== "received" && (
              <Button onClick={toggleSubmit}>
                {po.status === "draft" ? "Submit" : "Revert"}
              </Button>
            )}

            <Button onClick={() => window.open(`#`)}>
              PDF
            </Button>

            {isEditable && (
              <Button variant="destructive" onClick={deletePO}>
                Delete
              </Button>
            )}
          </div>
        }
      >
        <div className="text-sm text-gray-500 space-y-1">
          <div>Vendor: {po.supplier || "—"}</div>
          <div>
            Date: {new Date(po.created_at).toLocaleDateString()}
          </div>
          <Badge variant={getStatusVariant(po.status)}>
            {po.status?.toUpperCase()}
          </Badge>
        </div>
      </Section>

      {/* ADD PRODUCT */}
      {isEditable && (
        <Card className="p-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product..."
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64"
            />
            <Button onClick={searchProducts}>Search</Button>
          </div>

          {results.length > 0 && (
            <div className="border border-gray-200 rounded-lg divide-y">
              {results.map((p) => (
                <div
                  key={p.sku}
                  className="flex justify-between items-center p-3 text-sm hover:bg-gray-50"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {p.sku}
                    </div>
                    <div className="text-gray-500 text-xs">
                      {p.title}
                    </div>
                  </div>

                  <Button size="sm" onClick={() => addItem(p)}>
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TABLE */}
      <Section title="Line Items">
        <Table
          columns={[
            "",
            "SKU",
            "Title",
            "Ordered",
            "Received",
            "Remaining",
            "Cost",
            "Total",
            "Receive",
          ]}
          data={po.items}
          renderRow={(item) => {
            const qty = Number(item.quantity) || 0;
            const received = Number(item.received_quantity) || 0;
            const remaining = qty - received;
            const cost = Number(item.cost) || 0;

            return (
              <>
                <td className="p-3 text-center">
                  {isEditable && (
                    <button
                      onClick={() => removeItem(item.sku)}
                      className="text-red-500 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </td>

                <td className="p-3 font-medium text-gray-900">
                  {item.sku}
                </td>

                <td className="p-3 text-gray-600">{item.title}</td>

                <td className="p-3 text-center">
                  {isEditable ? (
                    <input
                      value={quantityInputs[item.sku] ?? ""}
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
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-center"
                    />
                  ) : (
                    qty
                  )}
                </td>

                <td className="p-3 text-center">{received}</td>

                <td className="p-3 text-center">
                  <span
                    className={
                      remaining === 0
                        ? "text-green-600"
                        : "text-gray-600"
                    }
                  >
                    {remaining}
                  </span>
                </td>

                <td className="p-3 text-right">${cost.toFixed(2)}</td>

                <td className="p-3 text-right font-medium text-gray-900">
                  ${(qty * cost).toFixed(2)}
                </td>

                <td className="p-3 text-center">
                  {remaining > 0 ? (
                    <div className="flex justify-center gap-2">
                      <input
                        value={receiveInputs[item.sku] ?? ""}
                        onChange={(e) =>
                          setReceiveInputs((prev) => ({
                            ...prev,
                            [item.sku]: e.target.value,
                          }))
                        }
                        className="w-16 border border-gray-300 rounded px-2 py-1 text-center"
                      />
                      <Button size="sm" onClick={() => receiveItem(item.sku)}>
                        ✓
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="success">Complete</Badge>
                  )}
                </td>
              </>
            );
          }}
        />

        <div className="flex justify-end mt-4 text-lg font-semibold text-gray-900">
          Total: ${totalCost.toFixed(2)}
        </div>
      </Section>
    </div>
  );
}