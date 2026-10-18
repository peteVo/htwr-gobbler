import { test, expect } from "@playwright/test";
import { defaultPreferences } from "../../packages/core/index";

test("course assistant saves PDF pages, cites material, handles missing evidence and engine outages", async ({
  page,
}) => {
  let materials: any[] = [],
    ready = true,
    unsupported = false;
  await page.route("**/api/me", (r) =>
    r.fulfill({ json: { email: "assistant@test.invalid" } }),
  );
  await page.route("**/api/data", (r) =>
    r.fulfill({
      json: {
        courses: [{ id: "c", name: "Networks", code: "NET", color: "sage" }],
        items: [],
        actions: [],
        sources: [],
        changes: [],
        preferences: defaultPreferences,
      },
    }),
  );
  await page.route("**/api/materials", async (r) => {
    if (r.request().method() === "POST") {
      const body = r.request().postDataJSON();
      materials.push({ ...body, id: "m", created_at: "2026-10-17" });
      await r.fulfill({ json: { id: "m", existing: false } });
    } else await r.fulfill({ json: materials.map(({ pages, ...m }) => m) });
  });
  await page.route("**/api/materials/candidates", (r) =>
    r.fulfill({ json: [] }),
  );
  await page.route("**/api/materials/issues", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/assistant/status", (r) =>
    r.fulfill({ json: { ready } }),
  );
  await page.route("**/api/assistant/ask", (r) => {
    expect(r.request().postDataJSON().course_id).toBe("c");
    return r.fulfill({
      json: unsupported
        ? { answer: "", supported: false, citations: [] }
        : {
            answer: "The exercise is described on page 1 [1].",
            supported: true,
            citations: [
              {
                id: "1",
                name: materials[0].name,
                page: 1,
                quote: materials[0].pages[0].text.slice(0, 80),
                source_url: "",
                material_id: "m",
                text: "",
                ocr: true,
              },
            ],
          },
    });
  });
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Assistant", exact: true })
    .click();
  await page.getByLabel("Module", { exact: true }).selectOption("c");
  await expect(
    page.getByRole("button", { name: "Ask local AI", exact: true }),
  ).toBeDisabled();
  await page.getByText("Add course material", { exact: true }).click();
  await page
    .getByLabel("Course PDF", { exact: true })
    .setInputFiles("tests/fixtures/exercise.pdf");
  await expect(page.getByLabel("Material title")).toHaveValue("exercise.pdf");
  await page
    .getByRole("button", { name: "Save material", exact: true })
    .click();
  await expect(
    page.getByText("Material saved for this module.", { exact: true }),
  ).toBeVisible();
  expect(materials[0].pages[0].page).toBe(1);
  await page.getByLabel("Your question").fill("What does the exercise say?");
  await page.getByRole("button", { name: "Ask local AI", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Course answer" }),
  ).toContainText("exercise.pdf · Page 1");
  await expect(
    page.getByText("OCR-derived text · check the original page", {
      exact: false,
    }),
  ).toBeVisible();
  unsupported = true;
  await page.getByLabel("Your question").fill("What is not in the material?");
  await page.getByRole("button", { name: "Ask local AI", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Course answer" }),
  ).toContainText("do not establish an answer");
  ready = false;
  await page.getByRole("button", { name: "Check local AI" }).click();
  await expect(
    page.getByRole("button", { name: "Ask local AI", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Local AI is not ready.", { exact: false }),
  ).toBeVisible();
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Assistant", exact: true })
    .click();
  await page.getByLabel("Module", { exact: true }).selectOption("c");
  await expect(page.getByText("exercise.pdf", { exact: true })).toBeVisible();
});

test("automatic material shows availability and reviews a suggested date without silently adding a task", async ({
  page,
}) => {
  await page.route("**/api/me", (r) =>
    r.fulfill({ json: { email: "local@test.invalid" } }),
  );
  const candidate = {
    course_id: "c",
    title: "Deadline candidate · Sheet.pdf",
    deadline: "2026-10-22T12:00:00.000Z",
    evidence: "Abgabe bis zum 22.10.2026 um 14:00",
    page: 2,
    document: "Sheet.pdf",
    source_url: "",
    document_name: "Sheet.pdf",
    document_hash: "a".repeat(64),
    document_key: "b".repeat(64),
    ocr: true,
  };
  await page.route("**/api/data", (r) =>
    r.fulfill({
      json: {
        courses: [{ id: "c", name: "Networks", code: "NET", color: "sage" }],
        items: [
          {
            id: "existing",
            course_id: "c",
            title: "Sheet already saved",
            kind: "assignment",
            starts_at: candidate.deadline,
            ends_at: null,
            all_day: false,
            status: "open",
            verification: "confirmed",
            description: "",
            evidence: "",
            source_url: "",
          },
        ],
        actions: [],
        sources: [],
        changes: [],
        preferences: defaultPreferences,
      },
    }),
  );
  await page.route("**/api/materials", (r) =>
    r.fulfill({
      json: [
        {
          id: "m",
          course_id: "c",
          name: "Sheet.pdf",
          source_url: "",
          created_at: "2026-10-18",
          synced: 1,
          available: 0,
          ocr: 1,
        },
      ],
    }),
  );
  await page.route("**/api/materials/candidates", (r) =>
    r.fulfill({ json: [candidate] }),
  );
  await page.route("**/api/materials/issues", (r) =>
    r.fulfill({
      json: [
        {
          source_name: "Local files · Networks",
          relative_path: "scanned.pdf",
          state: "unreadable",
          issue: "ocr_incomplete",
        },
        {
          source_name: "Local files · Networks",
          relative_path: "Long scan.pdf",
          state: "unreadable",
          issue: "indexing",
          pages_done: 10,
          pages_total: 201,
        },
        {
          source_name: "Local files · Networks",
          relative_path: "Queued scan.pdf",
          state: "unreadable",
          issue: "indexing",
          pages_done: 0,
          pages_total: 0,
        },
      ],
    }),
  );
  await page.route("**/api/assistant/status", (r) =>
    r.fulfill({ json: { ready: true } }),
  );
  let writes = 0;
  await page.route("**/api/items", (r) => {
    writes++;
    return r.fulfill({ json: { id: "i" } });
  });
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Assistant", exact: true })
    .click();
  await page.getByLabel("Module", { exact: true }).selectOption("c");
  await expect(
    page.getByText("Local PDF unavailable · excluded from answers"),
  ).toBeVisible();
  await page.getByText("PDFs needing attention (1)", { exact: true }).click();
  await expect(page.getByText("scanned.pdf", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Partial text was rejected", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "PDF import progress" }),
  ).toContainText("Pages processed: 10 of 201");
  await expect(
    page.getByRole("region", { name: "PDF import progress" }),
  ).toContainText("Waiting for the next import pass.");
  await expect(
    page.getByText("Contains OCR-derived text", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("OCR-derived date", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("0 readable documents for this module", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Missing file: run Sync-my-L2P", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ask local AI", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Remove material Sheet.pdf" }),
  ).toHaveCount(0);
  const sameDay = page.getByLabel(
    "Tasks already saved for this module on this day",
  );
  await expect(sameDay).toContainText("Sheet already saved");
  await sameDay.selectOption("existing");
  await page.getByRole("button", { name: "Review date", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(candidate.evidence);
  await expect(
    page.getByRole("dialog").getByLabel("Title", { exact: true }),
  ).toHaveValue("Sheet already saved");
  expect(writes).toBe(0);
});

test("returning to Assistant refreshes material coverage and local AI readiness without a reload", async ({
  page,
}) => {
  let resumed = false;
  await page.route("**/api/**", (r) => {
    const path = new URL(r.request().url()).pathname;
    const json =
      path === "/api/me"
        ? { email: "resume@test.invalid" }
        : path === "/api/data"
          ? {
              courses: [{ id: "c", name: "Vision", code: "CV", color: "sage" }],
              items: [],
              sources: [],
              changes: [],
              preferences: defaultPreferences,
            }
          : path === "/api/assistant/status"
            ? { ready: resumed }
            : path === "/api/materials" && resumed
              ? [
                  {
                    id: "m",
                    course_id: "c",
                    name: "New lecture.pdf",
                    synced: 1,
                    available: 1,
                  },
                ]
              : [];
    return r.fulfill({ json });
  });
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Assistant", exact: true })
    .click();
  await page.getByLabel("Module", { exact: true }).selectOption("c");
  await page.getByLabel("Your question").fill("Explain segmentation");
  const ask = page.getByRole("button", { name: "Ask local AI", exact: true });
  await expect(ask).toBeDisabled();
  await expect(
    page.getByText("0 readable documents for this module", { exact: true }),
  ).toBeVisible();
  resumed = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(ask).toBeEnabled();
  await expect(
    page.getByText("1 readable documents for this module", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("New lecture.pdf", { exact: true }),
  ).toBeVisible();
  await page.getByText("Material coverage by module", { exact: true }).click();
  await expect(
    page.getByText("Vision · 1 readable documents", { exact: true }),
  ).toBeVisible();
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("a module without PDFs can check its saved calendar even when the AI is offline, and missing dates stay explicit", async ({
  page,
}) => {
  let missing = false;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const json =
      path === "/api/me"
        ? { email: "calendar@test.invalid" }
        : path === "/api/data"
          ? {
              courses: [
                { id: "c", name: "Computer Vision", code: "CV", color: "sage" },
              ],
              items: [],
              actions: [],
              sources: [],
              changes: [],
              preferences: defaultPreferences,
            }
          : path === "/api/assistant/status"
            ? { ready: false }
            : path === "/api/assistant/ask"
              ? {
                  answer: "",
                  supported: !missing,
                  citations: [],
                  calendar: {
                    kind: "lecture",
                    item: missing
                      ? null
                      : {
                          id: "i",
                          title: "Vision lecture",
                          starts_at: "2026-10-21T08:30:00.000Z",
                          ends_at: null,
                          all_day: false,
                          verification: "confirmed",
                          source_url: "",
                        },
                    last_checked: null,
                    source_current: false,
                  },
                }
              : [];
    return route.fulfill({ json });
  });
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Assistant", exact: true })
    .click();
  await page.getByLabel("Module", { exact: true }).selectOption("c");
  await page.getByLabel("Your question").fill("When's the next lecture?");
  const check = page.getByRole("button", {
    name: "Check saved calendar",
    exact: true,
  });
  await expect(check).toBeEnabled();
  await check.click();
  await expect(
    page.getByRole("region", { name: "Course answer" }),
  ).toContainText("Vision lecture");
  await expect(
    page.getByRole("region", { name: "Course answer" }),
  ).toContainText("10:30");
  await expect(
    page.getByRole("region", { name: "Course answer" }),
  ).toContainText("Verify this date");
  missing = true;
  await check.click();
  await expect(
    page.getByRole("region", { name: "Course answer" }),
  ).toContainText("No upcoming entry");
  await expect(
    page.getByRole("region", { name: "Course answer" }),
  ).not.toContainText("Vision lecture");
});

test("keyboard users can skip navigation, identify dialogs and dismiss mobile navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page
    .locator(".demo-strip")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Your academic space" }),
  ).toBeVisible();
  for (const theme of ["light", "dark"]) {
    const contrast = await page
      .getByLabel("Email", { exact: true })
      .evaluate((input, theme) => {
        document.documentElement.dataset.theme = theme;
        const style = getComputedStyle(input);
        const lum = (color: string) => {
          const rgb = color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((v) => {
              const s = v / 255;
              return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
            });
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        };
        const a = lum(style.borderTopColor),
          b = lum(style.backgroundColor);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }, theme);
    expect(contrast).toBeGreaterThanOrEqual(3);
  }
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.setViewportSize({ width: 375, height: 900 });
  const toggle = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("button", { name: "Close navigation", exact: true })
    .focus();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("Today surfaces evidenced dates, flags old dates and retries failed refreshes without writing tasks", async ({
  page,
}) => {
  let failed = false,
    writes = 0;
  const future = {
    course_id: "c",
    document_key: "a".repeat(64),
    document_hash: "b".repeat(64),
    document_name: "Sheet.pdf",
    document: "Sheet.pdf",
    deadline: "2099-10-22T00:00:00.000Z",
    all_day: true,
    evidence: "Abgabe 22.10.2099",
    page: 2,
    source_url: "",
    title: "Date",
  };
  await page.route("**/api/**", (r) => {
    const path = new URL(r.request().url()).pathname;
    if (r.request().method() !== "GET") writes++;
    if (path === "/api/materials/candidates" && failed)
      return r.fulfill({ status: 503, json: { error: "Unavailable" } });
    const json =
      path === "/api/me"
        ? { email: "dates@test.invalid" }
        : path === "/api/data"
          ? {
              courses: [
                { id: "c", name: "Networks", code: "NET", color: "sage" },
              ],
              items: [],
              actions: [],
              changes: [],
              sources: [],
              preferences: defaultPreferences,
            }
          : path === "/api/materials/candidates"
            ? [
                {
                  ...future,
                  document_key: "c".repeat(64),
                  deadline: "2020-01-01T00:00:00.000Z",
                  evidence: "Abgabe 01.01.2020",
                },
                future,
              ]
            : [];
    return r.fulfill({ json });
  });
  await page.goto("/");
  await page.getByText("Dates to review (2)", { exact: true }).click();
  const region = page.getByRole("region", { name: "Dates to review" });
  await expect(region.locator("article").first()).toContainText(
    future.evidence,
  );
  await expect(region).toContainText("Networks · Sheet.pdf");
  await expect(region).toContainText("Date only · no exact time is recorded.");
  await expect(region).toContainText(
    "Past date · check the semester before saving.",
  );
  expect(writes).toBe(0);
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  failed = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("alert")).toContainText(
    "Could not refresh suggested dates",
  );
  failed = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByText("Dates to review (2)", { exact: true }),
  ).toBeVisible();
  expect(writes).toBe(0);
});
