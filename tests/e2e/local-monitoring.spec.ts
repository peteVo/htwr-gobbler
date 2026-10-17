import { test, expect } from "@playwright/test";
import { defaultPreferences } from "../../packages/core/index";

test("local monitoring reports backup failures and stale heartbeats; focus refreshes changed source health", async ({
  page,
}) => {
  let running = true,
    failed = false;
  await page.route("**/api/me", (r) =>
    r.fulfill({ json: { email: "monitor@test.invalid" } }),
  );
  await page.route("**/api/data", (r) =>
    r.fulfill({
      json: {
        courses: [],
        items: [],
        changes: [],
        preferences: defaultPreferences,
        sources: [
          {
            id: "s",
            name: "Moodle calendar",
            kind: "feed",
            status: failed ? "failed" : "connected",
            last_success: new Date().toISOString(),
            last_attempt: new Date().toISOString(),
            error: failed ? "Previous records retained" : null,
            imported_count: 1,
          },
        ],
      },
    }),
  );
  await page.route("**/local-status", (r) =>
    r.fulfill({
      json: {
        heartbeat: new Date(Date.now() - (running ? 0 : 300000)).toISOString(),
        last_check: new Date().toISOString(),
        check_failed: failed,
        last_backup: new Date().toISOString(),
        backup_failed: true,
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Sources", exact: true })
    .click();
  await expect(
    page.getByText("Automatic calendar checks are active", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Automatic backup failed.", { exact: false }),
  ).toBeVisible();
  failed = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByText("The last automatic check failed.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Previous records retained", { exact: false }),
  ).toBeVisible();
  running = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByText("Automatic local checks are not running.", { exact: false }),
  ).toBeVisible();
});
