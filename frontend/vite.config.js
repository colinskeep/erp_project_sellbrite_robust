import { defineConfig } from "vite";
import tailwindcss from '@tailwindcss/vite'
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: {

    "process.env.API_KEY": JSON.stringify(process.env.API_KEY),
    "process.env.API_URL": JSON.stringify(process.env.API_URL),
    "process.env.CLIENT_KEY_1": JSON.stringify(process.env.CLIENT_KEY_1)

  }
});

