import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localStatus } from "./scripts/local-server";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "gobbler-local-status",
      configureServer(server) {
        server.middlewares.use("/local-status", localStatus);
      },
    },
  ],
  root: "apps/web",
  publicDir: "public",
  optimizeDeps: { include: ["pdfjs-dist"] },
  build: { outDir: "../../dist", emptyOutDir: true },
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
});
