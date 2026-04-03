import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
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
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/replenishment" element={<ProtectedRoute><Replenishment /></ProtectedRoute>} />
      <Route path="/purchase-orders" element={<ProtectedRoute><PurchaseOrders /></ProtectedRoute>} />
      <Route path="/purchase-orders/:id" element={<ProtectedRoute><PurchaseOrderDetail /></ProtectedRoute>} />
    </Routes>
  </Layout>
  );
}

export default App;