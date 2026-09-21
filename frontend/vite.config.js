import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, /api is proxied to uvicorn so the browser sees one origin and no CORS.
// In prod, FastAPI serves the built files itself, so /api is already same-origin.
// Point VITE_API_TARGET somewhere else if your backend is not on :8000.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // A GitHub project site is served from /<repo>/, not the domain root, so the
  // asset paths have to be prefixed. The deploy workflow sets this; local
  // builds and same-origin serving from FastAPI keep the default "/".
  base: process.env.VITE_BASE || "/",
  build: {
    // FastAPI mounts this directory as static files.
    outDir: "dist",
    sourcemap: mode !== "production",
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
}));
