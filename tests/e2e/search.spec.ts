import { test, expect } from "@playwright/test";
import {
  defaultPreferences,
  itemInput,
  type Snapshot,
} from "../../packages/core/index";

test("workspace search opens hidden work, actions, modules and sources without changing records", async ({
  page,
}) => {
  const data: Snapshot = {
    preferences: defaultPreferences,
    changes: [],
    courses: [
      { id: "c", name: "Netzwerke und Systeme", code: "NET26", color: "sage" },
    ],
    items: [
      {
        ...itemInput.parse({
          title: "Übung protocols",
          description: "Saved routing instructions",
          kind: "material",
          status: "dismissed",
          starts_at: "2026-10-22T00:00:00Z",
          all_day: true,
          course_id: "c",
        }),
        id: "i",
        source_id: "s",
        last_verified: null,
      },
    ],
    actions: [
      {
        id: "a",
        title: "Review network setup",
        notes: "Đăng ký nhóm",
        course_id: "c",
        status: "done",
        source_url: "",
        created_at: "2026-10-17T00:00:00Z",
      },
    ],
    sources: [
      {
        id: "s",
        name: "Network Moodle calendar",
        kind: "feed",
        status: "connected",
        last_attempt: "2020-01-01T00:00:00Z",
        last_success: "2020-01-01T00:00:00Z",
        error: null,
        imported_count: 1,
      },
    ],
  };
  const writes: string[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/materials/candidates")
      return route.fulfill({ json: [] });
    if (route.request().method() !== "GET") writes.push(url.pathname);
    await route.fulfill({
      json:
        url.pathname === "/api/me" ? { email: "search@example.test" } : data,
    });
  });
  await page.goto("/");
  await expect(
    page.getByText("PERSONAL WORKSPACE", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tasks & deadlines" })
    .click();
  await expect(page.locator(".task-row")).toHaveCount(0);
  await page.keyboard.press("/");
  const search = page.getByRole("searchbox");
  await expect(search).toBeFocused();
  await search.fill("routing NET26");
  await expect(
    page.getByRole("heading", { name: "Search results" }),
  ).toBeVisible();
  const result = page.locator(".search-result");
  await expect(result).toContainText("dismissed");
  await expect(result).toContainText("Source outdated");
  await expect(result).toContainText("date only");
  await result.click();
  await expect(
    page.getByRole("dialog").getByLabel("Title", { exact: true }),
  ).toHaveValue("Übung protocols");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(search).toHaveValue("routing NET26");
  await search.fill("dang ky");
  await expect(result).toContainText("done · No date assigned");
  await result.click();
  await expect(page.getByLabel("Action title", { exact: true })).toHaveValue(
    "Review network setup",
  );
  await expect(page.getByLabel("Action title", { exact: true })).toBeFocused();
  await page
    .getByRole("region", { name: "Next actions" })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await search.fill("NET26");
  await page
    .getByRole("region", { name: "Courses", exact: true })
    .getByRole("button")
    .click();
  await expect(page.getByRole("combobox", { name: "Filter type" })).toHaveValue(
    "",
  );
  await expect(
    page.getByRole("combobox", { name: "Filter course" }),
  ).toHaveValue("c");
  await expect(page.locator(".task-row")).toHaveCount(1);
  await search.fill("Network Moodle");
  await result.click();
  await expect(page.locator("#source-s")).toBeFocused();
  await search.fill("no such record");
  await expect(
    page.getByText("No matching records.", { exact: false }),
  ).toBeVisible();
  await search.press("Escape");
  await expect(search).toHaveValue("");
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    await search.fill("NET26");
    await expect(result).toHaveCount(3);
    expect(
      await result.evaluateAll((rows) =>
        rows.every((row) => row.scrollWidth <= row.clientWidth),
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(writes).toEqual([]);
});
