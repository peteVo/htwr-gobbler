import { test, expect } from "@playwright/test";
import { defaultPreferences } from "../../packages/core/index";

test("Today distinguishes overdue, date-only due-today and upcoming assignments with source warnings", async ({
  page,
}) => {
  const now = new Date("2026-10-18T12:00:00Z");
  await page.clock.install({ time: now });
  await page.route("**/api/me", (r) =>
    r.fulfill({ json: { email: "deadlines@test.invalid" } }),
  );
  await page.route("**/api/data", (r) =>
    r.fulfill({
      json: {
        preferences: defaultPreferences,
        courses: [{ id: "c", name: "Networks", code: "NET", color: "sage" }],
        changes: [],
        sources: [
          {
            id: "s",
            name: "Moodle",
            kind: "feed",
            status: "failed",
            last_success: "2026-10-17T12:00:00Z",
          },
        ],
        items: [
          ...Array.from({ length: 3 }, (_, i) => ({
            id: "older-" + i,
            title: "Older sheet " + i,
            starts_at: "2026-10-16T12:00:00Z",
            all_day: false,
            status: "open",
          })),
          {
            id: "old",
            title: "Late sheet",
            starts_at: "2026-10-17T12:00:00Z",
            all_day: false,
            status: "open",
          },
          {
            id: "today",
            title: "Date-only sheet",
            starts_at: "2026-10-18T00:00:00Z",
            all_day: true,
            status: "open",
          },
          {
            id: "next",
            title: "Next sheet",
            starts_at: "2026-10-20T12:00:00Z",
            all_day: false,
            status: "open",
          },
          {
            id: "done",
            title: "Finished sheet",
            starts_at: "2026-10-16T12:00:00Z",
            all_day: false,
            status: "done",
          },
        ].map((i) => ({
          ...i,
          course_id: "c",
          source_id: "s",
          kind: "assignment",
          verification: "confirmed",
          description: "",
          source_url: "",
          evidence: "",
          ends_at: null,
          last_verified: null,
        })),
      },
    }),
  );
  await page.goto("/");
  const tasks = page.locator(".deadline-section .task-row");
  await expect(tasks).toHaveCount(4);
  await expect(
    page.getByRole("heading", { name: "Overdue assignments (4)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Upcoming assignments", exact: true }),
  ).toBeVisible();
  await expect(tasks.nth(0)).toContainText("Overdue");
  await expect(tasks.nth(2)).toContainText("Due today");
  await expect(tasks.nth(2)).toContainText("date only; verify cutoff");
  await expect(tasks.nth(3)).toContainText("Due within 7 days");
  for (const row of await tasks.all()) {
    await expect(row).toContainText("Networks");
    await expect(row).toContainText("Source outdated");
  }
});
test("Today prioritizes a recent earlier deadline with its module and both dates", async ({
  page,
}) => {
  const now = new Date().toISOString();
  await page.route("**/api/me", (r) =>
    r.fulfill({ json: { email: "changes@example.test" } }),
  );
  await page.route("**/api/data", (r) =>
    r.fulfill({
      json: {
        preferences: defaultPreferences,
        sources: [],
        courses: [
          { id: "course", name: "Test Algorithms", code: "", color: "sage" },
        ],
        items: [
          {
            id: "task",
            course_id: "course",
            source_id: null,
            title: "Sheet 2",
            description: "",
            kind: "assignment",
            starts_at: "2026-10-19T14:00:00.000Z",
            ends_at: null,
            all_day: false,
            status: "open",
            verification: "confirmed",
            source_url: "",
            evidence: "",
            last_verified: now,
          },
        ],
        changes: [
          ...Array.from({ length: 4 }, (_, i) => ({
            id: "ordinary-" + i,
            item_id: null,
            title: "Lecture updated",
            kind: "updated",
            created_at: now,
          })),
          {
            id: "earlier",
            item_id: "task",
            title: "Sheet 2",
            kind: "deadline_earlier",
            created_at: now,
            previous_starts_at: "2026-10-20T14:00:00.000Z",
            next_starts_at: "2026-10-19T14:00:00.000Z",
          },
        ],
      },
    }),
  );
  await page.goto("/");
  const activity = page.locator(".activity-row").first();
  await expect(activity).toContainText("Deadline moved earlier");
  await expect(activity).toContainText("Test Algorithms");
  await expect(activity).toContainText("20 Oct 2026");
  await expect(activity).toContainText("19 Oct 2026");
});
