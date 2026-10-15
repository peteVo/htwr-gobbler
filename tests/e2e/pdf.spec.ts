import { test, expect } from "@playwright/test";
test("PDF dates are read locally with page evidence and saved as needing review", async ({
  page,
  request,
}) => {
  const email = `pdf-${Date.now()}@example.test`,
    password = "a-local-test-password-123";
  await request.post("/api/auth/register", {
    headers: { Origin: "http://127.0.0.1:5173" },
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
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Review document text" }).click();
  let aiRequests = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/ai/")) aiRequests++;
  });
  await page
    .getByLabel("Exercise PDF · up to 20 pages, 10 MB")
    .setInputFiles("tests/fixtures/exercise.pdf");
  await expect(
    page.getByRole("textbox", { name: "Document text", exact: true }),
  ).toHaveValue(/Abgabe bis zum 20.10.2026/, { timeout: 20000 });
  await page
    .getByRole("button", { name: "Find explicit dates locally" })
    .click();
  await expect(page.getByText(/Needs review · Page 1/)).toBeVisible();
  expect(aiRequests).toBe(0);
  await page.getByRole("button", { name: "Review and save" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tasks & deadlines" })
    .click();
  await expect(
    page.getByText("Deadline candidate · exercise.pdf", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".verification.review")).toContainText(
    "Needs review",
  );
});
