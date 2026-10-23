import { defineConfig } from "@playwright/test";
const port = Number(process.env.GOBBLER_TEST_PORT || 5173);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: process.env.REUSE_SERVER
    ? undefined
    : [
        {
          command: `pnpm db:migrate && pnpm build && pnpm exec wrangler dev --ip 127.0.0.1 --port 8787 --var APP_ORIGIN:${baseURL}`,
          url: "http://127.0.0.1:8787/api/auth/options",
          reuseExistingServer: false,
          timeout: 120000,
        },
        {
          command: "pnpm exec tsx scripts/local-server.ts",
          env: { GOBBLER_PORT: String(port) },
          url: baseURL,
          reuseExistingServer: false,
          timeout: 120000,
        },
      ],
});
