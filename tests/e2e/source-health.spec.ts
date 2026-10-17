import { test, expect } from "@playwright/test";
import { defaultPreferences } from "../../packages/core/index";

test("connecting a subscription can replace its uploaded calendar", async ({
  page,
}) => {
  await page.route("**/local-status", (route) => route.fulfill({ json: null }));
  await page.route("**/api/me", (route) =>
    route.fulfill({ json: { email: "feed@example.test" } }),
  );
  await page.route("**/api/data", (route) =>
    route.fulfill({
      json: {
        courses: [],
        items: [],
        changes: [],
        preferences: defaultPreferences,
        sources: [
          {
            id: "existing-file",
            name: "Uploaded Moodle",
            kind: "file",
            status: "connected",
            last_attempt: null,
            last_success: null,
            error: null,
            imported_count: 2,
          },
        ],
      },
    }),
  );
  let payload: any;
  await page.route("**/api/sources", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ json: { id: "existing-file" } });
  });
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Sources", exact: true })
    .click();
  await expect(
    page.getByText("Automatic local checks are not running.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Connect Moodle calendar", exact: true })
    .click();
  await page.getByLabel("Existing calendar").selectOption("existing-file");
  await page
    .getByLabel("Calendar export URL")
    .fill(
      "https://moodle.rwth-aachen.de/calendar/export_execute.php?token=test-only",
    );
  await page
    .getByRole("button", { name: "Connect calendar", exact: true })
    .click();
  await expect.poll(() => payload?.source_id).toBe("existing-file");
  expect(payload.url).toContain("test-only");
});
test("a failed manual check refreshes visible source health immediately", async ({
  page,
}) => {
  let failed = false;
  await page.route("**/api/me", (route) =>
    route.fulfill({ json: { email: "source-health@example.test" } }),
  );
  await page.route("**/api/data", (route) =>
    route.fulfill({
      json: {
        courses: [],
        items: [],
        changes: [],
        preferences: defaultPreferences,
        sources: [
          {
            id: "test-feed",
            name: "Test Moodle calendar",
            kind: "feed",
            status: failed ? "failed" : "connected",
            last_attempt: new Date().toISOString(),
            last_success: new Date().toISOString(),
            error: failed
              ? "Source unavailable. Previous records retained."
              : null,
            imported_count: 0,
          },
        ],
      },
    }),
  );
  await page.route("**/api/sources/test-feed/sync", async (route) => {
    failed = true;
    await route.fulfill({
      status: 502,
      json: {
        error: "Calendar check failed. Previous information may be outdated.",
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Sources", exact: true })
    .click();
  await expect(page.locator(".source-state")).toHaveText("Checked");
  await page.getByRole("button", { name: "Check now" }).click();
  await expect(page.locator(".source-state")).toHaveText("Check failed");
  await expect(
    page.getByText("0 of 1 sources checked within the last hour."),
  ).toBeVisible();
});
