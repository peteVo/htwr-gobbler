import { test, expect, type Page } from "@playwright/test";
import {
  defaultPreferences,
  itemInput,
  type Snapshot,
} from "../../packages/core/index";

const now = new Date("2026-10-17T12:00:00Z");
async function setup(
  page: Page,
  {
    enabled = false,
    serviceWorker = true,
    denied = false,
    failDelivery = false,
  }: {
    enabled?: boolean;
    serviceWorker?: boolean;
    denied?: boolean;
    failDelivery?: boolean;
  } = {},
) {
  const data: Snapshot = {
    preferences: { ...defaultPreferences, reminders: enabled },
    courses: [
      { id: "c", name: "Networks test module", code: "NET", color: "sage" },
    ],
    items: [
      {
        ...itemInput.parse({
          title: "Routing sheet",
          kind: "assignment",
          starts_at: "2026-10-17T14:00:00.000Z",
          course_id: "c",
        }),
        id: "i",
        source_id: null,
        last_verified: null,
      },
    ],
    changes: [],
    sources: [],
  };
  const writes: unknown[] = [];
  await page.clock.install({ time: now });
  await page.context().addInitScript(
    ({ serviceWorker, denied, failDelivery }) => {
      const w = window as any;
      w.sent = [];
      w.failDelivery = failDelivery;
      const send = (title: string, options: unknown) => {
        if (w.failDelivery) throw new Error("Device refused notification");
        w.sent.push({ title, options });
      };
      class TestNotification {
        static permission = denied ? "denied" : "granted";
        static async requestPermission() {
          return this.permission;
        }
        onclick: (() => void) | null = null;
        close() {}
        constructor(title: string, options: unknown) {
          send(title, options);
          w.lastNotification = this;
        }
      }
      Object.defineProperty(window, "Notification", {
        value: TestNotification,
        configurable: true,
      });
      Object.defineProperty(navigator.serviceWorker, "getRegistration", {
        value: async () =>
          serviceWorker
            ? {
                active: {},
                showNotification: async (title: string, options: unknown) =>
                  send(title, options),
              }
            : undefined,
      });
    },
    { serviceWorker, denied, failDelivery },
  );
  await page.context().route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/materials/candidates")
      return route.fulfill({ json: [] });
    if (
      url.pathname === "/api/preferences" &&
      route.request().method() === "PUT"
    ) {
      data.preferences = route.request().postDataJSON();
      writes.push(data.preferences);
    }
    await route.fulfill({
      json:
        url.pathname === "/api/me" ? { email: "reminder@example.test" } : data,
    });
  });
  return { data, writes };
}
const sent = (page: Page) => page.evaluate(() => (window as any).sent);
const settings = async (page: Page) => {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  return page.getByRole("region", { name: "Reminder settings", exact: true });
};

test("reminder settings save lead time and alert choices; new changes deliver once and open the correct item", async ({
  page,
}) => {
  const { data, writes } = await setup(page);
  data.changes = [
    {
      id: "old",
      item_id: "i",
      title: "Old change",
      kind: "deadline_earlier",
      created_at: "2026-10-17T11:00:00Z",
      previous_starts_at: "2026-10-18T14:00:00.000Z",
      next_starts_at: data.items[0].starts_at,
    },
  ];
  await page.goto("/");
  const section = await settings(page);
  await section.getByLabel("Remind me before a deadline").selectOption("6");
  await expect(section.getByLabel("Remind me before a deadline")).toHaveValue(
    "6",
  );
  await section
    .getByRole("button", { name: "Enable foreground reminders" })
    .click();
  await expect.poll(async () => (await sent(page)).length).toBe(1);
  expect((await sent(page))[0].title).toContain("Deadline approaching");
  expect((await sent(page))[0].options.body).toContain("Networks test module");
  expect((await sent(page))[0].options.data.itemId).toBe("i");
  await page.clock.fastForward(120000);
  data.changes = [
    {
      ...data.changes[0],
      id: "new",
      created_at: "2026-10-17T12:01:00Z",
      previous_starts_at: data.items[0].starts_at,
      next_starts_at: "2026-10-17T13:00:00.000Z",
    },
  ];
  data.items[0].starts_at = data.changes[0].next_starts_at!;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(async () => (await sent(page)).length).toBe(2);
  expect((await sent(page))[1].title).toContain("Deadline moved earlier");
  await page.clock.fastForward(60000);
  expect(await sent(page)).toHaveLength(2);
  await section.getByRole("button", { name: "Send test notification" }).click();
  await expect(
    section.getByText("Test accepted by the browser.", { exact: false }),
  ).toBeVisible();
  expect(await sent(page)).toHaveLength(3);
  await section.getByLabel("Deadline-change alerts").selectOption("false");
  expect(data.preferences.deadline_changes).toBe(false);
  expect(writes.length).toBeGreaterThanOrEqual(3);
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.reload();
  await expect(
    page.getByText("PERSONAL WORKSPACE", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(60000);
  expect(await sent(page)).toHaveLength(0);
  await page.goto("/#item/i");
  await expect(
    page.getByRole("dialog").getByLabel("Title", { exact: true }),
  ).toHaveValue("Routing sheet");
});

test("blocked permission stays explicit and cannot enable reminders or send a test", async ({
  page,
}) => {
  const { data, writes } = await setup(page, { denied: true });
  await page.goto("/");
  const section = await settings(page);
  await expect(
    section.getByText("Notifications are blocked", { exact: false }),
  ).toBeVisible();
  await section
    .getByRole("button", { name: "Enable foreground reminders" })
    .click();
  await expect(section.getByRole("alert")).toContainText("not granted");
  await expect(
    section.getByRole("button", { name: "Send test notification" }),
  ).toBeDisabled();
  expect(data.preferences.reminders).toBe(false);
  expect(writes).toEqual([]);
  expect(await sent(page)).toEqual([]);
  data.preferences.reminders = true;
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "this browser cannot send them",
  );
  await settings(page);
  await section.getByRole("button", { name: "Disable reminders" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(data.preferences.reminders).toBe(false);
});

test("failed native delivery is retried without marking an alert sent, and its click opens the item", async ({
  page,
}) => {
  await setup(page, {
    enabled: true,
    serviceWorker: false,
    failDelivery: true,
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "could not be sent or recorded",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "reminded:reminder@example.test:i:2026-10-17T14:00:00.000Z",
      ),
    ),
  ).toBeNull();
  await page.evaluate(() => {
    (window as any).failDelivery = false;
  });
  await page.clock.fastForward(60000);
  await expect.poll(async () => (await sent(page)).length).toBe(1);
  await page.evaluate(() => (window as any).lastNotification.onclick());
  await expect(
    page.getByRole("dialog").getByLabel("Title", { exact: true }),
  ).toHaveValue("Routing sheet");
});

test("two open tabs coordinate automatic delivery and Berlin quiet hours defer alerts", async ({
  page,
}) => {
  const { data } = await setup(page, { enabled: true });
  data.preferences.quiet_start = 13;
  data.preferences.quiet_end = 15;
  await page.goto("/");
  await expect(
    page.getByText("PERSONAL WORKSPACE", { exact: true }),
  ).toBeVisible();
  expect(await sent(page)).toEqual([]);
  data.preferences.quiet_start = 22;
  data.preferences.quiet_end = 7;
  const other = await page.context().newPage();
  await other.clock.install({ time: now });
  await Promise.all([page.reload(), other.goto("/")]);
  await expect
    .poll(async () => (await sent(page)).length + (await sent(other)).length)
    .toBe(1);
});
