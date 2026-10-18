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
  };
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
    page.getByRole("button", { name: "Ask local AI", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Remove material Sheet.pdf" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Review date", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(candidate.evidence);
  expect(writes).toBe(0);
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
