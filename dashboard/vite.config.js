import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // Load .env from the root project directory (parent of dashboard/)
  envDir: path.resolve(__dirname, ".."),
  server: {
    port: 3000,
    strictPort: true,
    open: true,
  },
});
