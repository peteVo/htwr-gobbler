import { test, expect } from "@playwright/test";
import { defaultPreferences } from "../../packages/core/index";
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
