import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendTarget = process.env.VITE_DEV_PROXY_TARGET ?? "http://localhost:4000";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 8000,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      ".trycloudflare.com",
    ],
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/socket.io": {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  plugins: [react()],
});
