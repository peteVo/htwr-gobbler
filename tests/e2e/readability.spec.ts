import { test, expect } from "@playwright/test";

for (const width of [320, 390, 768, 1440])
  test(`readability and primary content at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const fontSize = async (selector: string) =>
      page.locator(selector).first().evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      );

    await expect(
      page.getByRole("heading", { name: "Today", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".task-row .task-content > strong").first(),
    ).toBeVisible();
    await expect(page.locator(".task-meta").first()).toBeVisible();
    await expect(page.locator(".search input")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add item", exact: true }),
    ).toBeVisible();

    expect(await fontSize("body")).toBeGreaterThanOrEqual(17);
    expect(
      await fontSize(".task-row .task-content > strong"),
    ).toBeGreaterThanOrEqual(17);
    expect(await fontSize(".task-meta")).toBeGreaterThanOrEqual(14);
    expect(await fontSize(".search input")).toBeGreaterThanOrEqual(16);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    const addItem = await page
      .getByRole("button", { name: "Add item", exact: true })
      .boundingBox();
    expect(addItem).not.toBeNull();
    expect(addItem!.x).toBeGreaterThanOrEqual(0);
    expect(addItem!.y).toBeGreaterThanOrEqual(0);
    expect(addItem!.x + addItem!.width).toBeLessThanOrEqual(width);
    expect(addItem!.y + addItem!.height).toBeLessThanOrEqual(900);

    if (width === 1440) {
      const deadlineSection = await page
        .locator(".deadline-section")
        .first()
        .boundingBox();
      expect(deadlineSection).not.toBeNull();
      expect(deadlineSection!.y).toBeLessThan(900);
    }
  });
