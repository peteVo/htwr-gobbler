import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("Moodle assignments show their module and ordinary exercise sessions stay out of the default task list", async ({
  page,
  baseURL,
}) => {
  const headers = { Origin: new URL(baseURL!).origin };
  await page.request.post("/api/auth/register", {
    headers,
    data: {
      email: `modules-${Date.now()}@example.test`,
      password: "a-local-test-password-123",
    },
  });
  await page.request.post("/api/import", {
    headers,
    data: {
      name: "Moodle module fixture",
      text: readFileSync("tests/fixtures/moodle.ics", "utf8"),
    },
  });
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tasks & deadlines" })
    .click();
  await expect(page.getByRole("combobox", { name: "Filter type" })).toHaveValue(
    "assignment",
  );
  await expect(page.locator(".task-row")).toHaveCount(2);
  await expect(
    page
      .locator(".task-row")
      .filter({ hasText: "Übung 1 ist fällig." })
      .locator(".course-label"),
  ).toHaveText("Foundations of Testing");
  await expect(
    page.getByRole("button", {
      name: "Foundations of Testing Übung",
      exact: true,
    }),
  ).not.toBeVisible();
  await page.getByRole("combobox", { name: "Filter type" }).selectOption("");
  await expect(page.locator(".task-row")).toHaveCount(4);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "My courses" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Foundations of Testing", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("2 open assignments", { exact: true }),
  ).toBeVisible();
});
