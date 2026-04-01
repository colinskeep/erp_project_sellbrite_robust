import { useState } from "react";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Replenishment from "./pages/Replenishment";
import PurchaseOrders from "./pages/PurchaseOrders";
import PurchaseOrderDetail from "./pages/PurchaseOrderDetail";
import { Routes, Route } from "react-router-dom";


function App() {
  return (
  <Layout>
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/replenishment" element={<Replenishment />} />
      <Route path="/purchase-orders" element={<PurchaseOrders />} />
      <Route path="/purchase-orders/:id" element={<PurchaseOrderDetail />} />
    </Routes>
  </Layout>
  );
}

export default App;