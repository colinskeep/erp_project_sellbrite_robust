import { defineConfig } from "vite";
import tailwindcss from '@tailwindcss/vite'
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        replenishment: './src/pages/Replenishment.jsx',
        purchase_orders: './src/pages/PurchaseOrders.jsx',
        // ...
        // List all files you want in your build
      }
    }
  }
});