import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: process.env.REUSE_SERVER
    ? undefined
    : {
        command: "pnpm db:migrate && pnpm dev",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
