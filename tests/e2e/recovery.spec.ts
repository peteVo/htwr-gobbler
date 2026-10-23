import { test, expect } from "@playwright/test";
test("a saved recovery key restores the workspace through the sign-in screen", async ({
  page,
  request,
  baseURL,
}) => {
  const email = `recovery-${Date.now()}@example.test`,
    password = "a-local-test-password-123",
    next = "a-recovered-password-456";
  await request.post("/api/auth/register", {
    headers: { Origin: new URL(baseURL!).origin },
    data: { email, password },
  });
  await page.goto("/");
  await page
    .locator(".demo-strip")
    .getByRole("button", { name: "Sign in" })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password · at least 12 characters").fill(password);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByText("PERSONAL WORKSPACE", { exact: true }),
  ).toBeVisible();
  await page.request.post("/api/items", {
    headers: { Origin: new URL(baseURL!).origin },
    data: {
      title: "Keep this assignment",
      kind: "assignment",
      starts_at: "2026-11-03T17:30:00.000Z",
    },
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByLabel("Current password", { exact: true }).fill(password);
  const generated = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/recovery-key") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Generate recovery key", exact: true })
    .click();
  expect((await generated).status()).toBe(200);
  await expect(
    page.getByLabel("Your recovery key", { exact: true }),
  ).not.toHaveValue("");
  const key = await page
    .getByLabel("Your recovery key", { exact: true })
    .inputValue();
  await page.getByRole("button", { name: "I saved my key · hide it" }).click();
  await expect(
    page.getByLabel("Your recovery key", { exact: true }),
  ).toHaveCount(0);
  const logout = await page.request.post("/api/logout", {
    headers: { Origin: new URL(baseURL!).origin },
  });
  expect(logout.status()).toBe(200);
  await page.reload();
  await page
    .locator(".demo-strip")
    .getByRole("button", { name: "Sign in" })
    .click();
  await page
    .getByRole("button", { name: "Recover account", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password · at least 12 characters").fill(next);
  await page.getByLabel("Recovery key", { exact: true }).fill(key);
  await page
    .getByRole("button", { name: "Reset password and sign in" })
    .click();
  await expect(
    page.getByText("PERSONAL WORKSPACE", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tasks & deadlines" })
    .click();
  await expect(
    page.getByText("Keep this assignment", { exact: true }),
  ).toBeVisible();
});
