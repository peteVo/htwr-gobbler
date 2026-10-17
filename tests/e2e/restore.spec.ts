import { test, expect } from "@playwright/test";
import { defaultPreferences } from "../../packages/core/index";

test("record restore validates and previews a file, waits for confirmation, and reports the result", async ({
  page,
}) => {
  let writes = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/restore") {
      writes++;
      await route.fulfill({
        json: {
          added: { courses: 1, items: 1, actions: 0, sources: 0 },
          skipped: 0,
        },
      });
      return;
    }
    await route.fulfill({
      json:
        path === "/api/me"
          ? { email: "restore@example.test" }
          : {
              courses: [],
              items: [],
              sources: [],
              actions: [],
              changes: [],
              preferences: defaultPreferences,
            },
    });
  });
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const section = page.getByRole("region", {
    name: "Restore records",
    exact: true,
  });
  const file = section.getByLabel("Gobbler export file");
  await file.setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("not JSON"),
  });
  await expect(section.getByRole("alert")).toContainText(
    "No records were changed",
  );
  expect(writes).toBe(0);
  const upload = {
    name: "gobbler-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        courses: [{ id: "c", name: "Saved module" }],
        items: [
          {
            id: "i",
            course_id: "c",
            title: "Saved task",
            kind: "assignment",
            starts_at: "2099-10-22T12:00:00Z",
          },
        ],
      }),
    ),
  };
  await file.setInputFiles(upload);
  await expect(section.getByRole("status")).toContainText("1 courses, 1 items");
  expect(writes).toBe(0);
  await section.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(file).toHaveValue("");
  await file.setInputFiles(upload);
  await section
    .getByRole("button", { name: "Restore missing records", exact: true })
    .click();
  await expect(section.getByRole("status")).toContainText(
    "Restored 1 courses, 1 items",
  );
  expect(writes).toBe(1);
  await expect(file).toHaveValue("");
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
