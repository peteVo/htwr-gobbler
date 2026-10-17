import { test, expect } from "@playwright/test";
import {
  defaultPreferences,
  itemInput,
  type Snapshot,
} from "../../packages/core/index";

test("German and Vietnamese translate full workflows without changing stored values or course content", async ({
  page,
}) => {
  const data: Snapshot = {
    preferences: defaultPreferences,
    courses: [
      { id: "c", name: "Original course name", code: "ORIG", color: "sage" },
    ],
    items: [
      {
        ...itemInput.parse({
          title: "Original assignment title",
          kind: "assignment",
          course_id: "c",
          starts_at: "2099-10-22T12:00:00Z",
          evidence: "Original source quotation",
        }),
        id: "i",
        source_id: null,
        last_verified: null,
      },
    ],
    actions: [],
    changes: [],
    sources: [],
  };
  let saved: any;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/preferences" && route.request().method() === "PUT")
      data.preferences = route.request().postDataJSON();
    if (path === "/api/items/i" && route.request().method() === "PUT") {
      saved = route.request().postDataJSON();
      data.items[0] = { ...data.items[0], ...saved };
    }
    await route.fulfill({
      json: path === "/api/me" ? { email: "language@example.test" } : data,
    });
  });
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("de");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(
    page.getByRole("heading", { name: "Kontowiederherstellung" }),
  ).toBeVisible();
  await expect(page.getByLabel("Erinnerung vor einer Frist")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Aufgaben & Fristen" })
    .click();
  await page
    .getByRole("button", { name: /Original assignment title.*2099/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Titel", { exact: true })).toHaveValue(
    "Original assignment title",
  );
  await expect(dialog.getByLabel("Beleg / Quellenzitat")).toHaveValue(
    "Original source quotation",
  );
  await dialog
    .getByRole("combobox", { name: "Typ", exact: true })
    .selectOption("tutorial");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  expect(saved.kind).toBe("tutorial");
  expect(saved.title).toBe("Original assignment title");
  expect(saved.evidence).toBe("Original source quotation");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Einstellungen", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Sprache", exact: true })
    .selectOption("vi");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(
    page.getByRole("heading", { name: "Khôi phục tài khoản" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Gửi thông báo thử" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Hôm nay", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Thêm việc cần làm", exact: true })
    .click();
  await expect(
    page.getByLabel("Tên việc cần làm", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await page.getByRole("searchbox").fill("ORIG");
  await expect(
    page.getByRole("heading", { name: "Kết quả tìm kiếm" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".search-result")
      .filter({ hasText: "Original assignment title" }),
  ).toContainText("Buổi thực hành");
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
