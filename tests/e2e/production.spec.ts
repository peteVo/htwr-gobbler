import { test, expect } from "@playwright/test";

test("finished build serves app assets and the service worker without exposing checkout files", async ({
  request,
}) => {
  const response = await request.get("/");
  expect(response.headers()["x-gobbler-build"]).toBe("production");
  expect(response.headers()["cache-control"]).toBe("no-store");
  const html = await response.text();
  expect(html).not.toContain("/@vite/client");
  const script = html.match(/src="(\/assets\/[^\"]+\.js)"/)?.[1];
  expect(script).toBeTruthy();
  const asset = await request.get(script!);
  expect(asset.ok()).toBe(true);
  expect(asset.headers()["content-type"]).toContain("javascript");
  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBe(true);
  expect(worker.headers()["cache-control"]).toBe("no-store");
  for (const file of [
    "/.dev.vars",
    "/.wrangler/local/config.json",
    "/scripts/local.ts",
    "/@vite/client",
  ]) {
    const result = await request.get(file);
    expect(
      result.status() === 404 ||
        result.headers()["content-type"]?.includes("text/html"),
    ).toBe(true);
  }
  expect((await request.get("/api/auth/options")).ok()).toBe(true);
});
