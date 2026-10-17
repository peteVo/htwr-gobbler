import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("personal workspace persists tasks, imports, completion and preferences", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("/");
  await expect(
    page.getByRole("searchbox", { name: "Search your academic space" }),
  ).toBeFocused();
  await expect(page.getByText("DEMO WORKSPACE", { exact: true })).toBeVisible();
  await page
    .locator(".demo-strip")
    .getByRole("button", { name: "Sign in" })
    .click();
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page
    .getByLabel("Email", { exact: true })
    .fill(`test-${Date.now()}@example.test`);
  await page
    .getByLabel("Password · at least 12 characters")
    .fill("a-local-test-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText("PERSONAL WORKSPACE", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "My courses" })
    .click();
  await page.getByRole("button", { name: "Add course", exact: true }).click();
  await page.getByLabel("Course name", { exact: true }).fill("Test Algorithms");
  await page.getByLabel("Course code", { exact: true }).fill("T-ALG");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Test Algorithms", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tasks & deadlines" })
    .click();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Persistent exercise");
  await page
    .getByRole("combobox", { name: "Course", exact: true })
    .selectOption({ label: "Test Algorithms" });
  await page
    .getByLabel("Date & time (this device’s timezone)", { exact: true })
    .fill("2026-10-20T16:00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Persistent exercise", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tasks & deadlines" })
    .click();
  await expect(
    page.getByText("Persistent exercise", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Complete Persistent exercise", exact: true })
    .click();
  await expect(
    page.getByText("Persistent exercise", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByText("Persistent exercise", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Sources", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import calendar", exact: true })
    .first()
    .click();
  await page.getByLabel("Calendar file", { exact: true }).setInputFiles({
    name: "fixture.ics",
    mimeType: "text/calendar",
    buffer: readFileSync("tests/fixtures/calendar.ics"),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Import calendar", exact: true })
    .click();
  await expect(
    page.getByText("Calendar imported. Check Sources for coverage.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("University calendar", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import calendar", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Source name", { exact: true })
    .fill("Same calendar with a different name");
  await page.getByLabel("Calendar file", { exact: true }).setInputFiles({
    name: "fixture-again.ics",
    mimeType: "text/calendar",
    buffer: readFileSync("tests/fixtures/calendar.ics"),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Import calendar", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const imported = await (await page.request.get("/api/data")).json();
  expect(imported.sources).toHaveLength(1);
  expect(imported.items).toHaveLength(3);
  expect(imported.changes).toHaveLength(4);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Appearance", exact: true })
    .selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Remind me before a deadline").selectOption("48");
  await expect(page.getByLabel("Remind me before a deadline")).toHaveValue(
    "48",
  );
  await page.getByLabel("Deadline-change alerts").selectOption("false");
  await expect(page.getByLabel("Deadline-change alerts")).toHaveValue("false");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const exported = await (await page.request.get("/api/data")).json();
  const savedPreferences = exported.preferences;
  expect(savedPreferences).toMatchObject({
    reminder_hours: 48,
    deadline_changes: false,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const restore = page.getByRole("region", {
    name: "Restore records",
    exact: true,
  });
  await restore
    .getByLabel("Gobbler export file")
    .setInputFiles({
      name: "saved-export.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(exported)),
    });
  await restore
    .getByRole("button", { name: "Restore missing records", exact: true })
    .click();
  await expect(restore.getByRole("status")).toContainText(
    "Restored 0 courses, 0 items",
  );
  const unchanged = await (await page.request.get("/api/data")).json();
  expect(unchanged.items).toEqual(exported.items);
});
for (const width of [320, 375, 414, 768, 1280])
  test(`demo layout and navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "A little clarity for your day." }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width <= 650)
      await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Calendar", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Calendar", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
