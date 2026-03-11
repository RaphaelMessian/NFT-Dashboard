import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // Load .env from root (repo root locally, or dashboard/ on Vercel via env vars)
  envDir: process.env.VERCEL ? __dirname : path.resolve(__dirname, ".."),
  server: {
    port: 3000,
    strictPort: true,
    open: true,
  },
});
