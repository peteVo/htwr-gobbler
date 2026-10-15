import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "gobbler-local-status",
      configureServer(server) {
        server.middlewares.use("/local-status", (req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.end("{}");
            return;
          }
          try {
            const status = JSON.parse(
              fs.readFileSync(
                new URL("./.wrangler/local/status.json", import.meta.url),
                "utf8",
              ),
            );
            res.end(
              JSON.stringify({
                heartbeat: status.heartbeat,
                last_check: status.last_check,
                check_failed: status.check_failed,
                last_backup: status.last_backup,
                backup_failed: status.backup_failed,
              }),
            );
          } catch {
            res.end("null");
          }
        });
      },
    },
  ],
  root: "apps/web",
  publicDir: "public",
  optimizeDeps: { include: ["pdfjs-dist"] },
  build: { outDir: "../../dist", emptyOutDir: true },
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
});
