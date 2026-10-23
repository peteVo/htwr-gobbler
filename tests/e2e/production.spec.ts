import { test, expect } from "@playwright/test";

test("finished build serves app assets and the service worker without exposing checkout files", async ({
  request,
}) => {
  const response = await request.get("/");
  expect(response.headers()["x-gobbler-build"]).toBe("production");
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
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

test("installed service worker reloads the offline shell without caching private API responses", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    navigator.serviceWorker.ready.then(() => undefined),
  );
  await page.reload();
  await expect(page.getByText("DEMO WORKSPACE", { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(
    true,
  );
  const cached = await page.evaluate(async () => {
    const stores = await Promise.all(
      (await caches.keys()).map((name) => caches.open(name)),
    );
    return (await Promise.all(stores.map((store) => store.keys())))
      .flat()
      .map((request) => new URL(request.url).pathname);
  });
  expect(cached.some((url) => url.startsWith("/assets/"))).toBe(true);
  expect(cached.some((url) => url.startsWith("/fonts/"))).toBe(true);
  expect(
    cached.some((url) => url.startsWith("/api/") || url === "/local-status"),
  ).toBe(false);
  try {
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByText("DEMO WORKSPACE", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("You’re offline.", { exact: false }),
    ).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
