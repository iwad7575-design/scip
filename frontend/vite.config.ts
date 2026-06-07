import * as path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const backendTarget = process.env.CHATKIT_API_BASE ?? "http://127.0.0.1:8000";

export default defineConfig({
  // Allow env files to live one level above the frontend directory
  envDir: path.resolve(__dirname, ".."),
  plugins: [react()],
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/chatkit": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/ask":          { target: backendTarget, changeOrigin: true },
      "/health":       { target: backendTarget, changeOrigin: true },
      "/ping":         { target: backendTarget, changeOrigin: true },
      "/referral":     { target: backendTarget, changeOrigin: true },
      "/plans":        { target: backendTarget, changeOrigin: true },
      "/subscription": { target: backendTarget, changeOrigin: true },
      "/payment":      { target: backendTarget, changeOrigin: true },
      "/student":      { target: backendTarget, changeOrigin: true },
      "/admin":        { target: backendTarget, changeOrigin: true },
      // Bypass HTML navigations so /share/:id serves the React app in dev
      "/share": {
        target: backendTarget,
        changeOrigin: true,
        bypass(req) {
          if (req.headers["accept"]?.includes("text/html")) return "/index.html";
        },
      },
    },
  },
});
