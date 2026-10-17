import { expect, it } from "vitest";
import {
  defaultPreferences,
  itemInput,
  type Item,
  type Snapshot,
} from "../packages/core/index";
import { pendingReminders, reminderText } from "../packages/core/reminders";

const now = new Date("2026-10-17T12:00:00Z");
const item: Item = {
  ...itemInput.parse({
    title: "Routing sheet",
    kind: "assignment",
    starts_at: "2026-10-18T12:00:00Z",
    course_id: "c",
  }),
  id: "i",
  source_id: null,
  last_verified: null,
};
const workspace = (): Snapshot => ({
  preferences: { ...defaultPreferences, reminders: true },
  courses: [{ id: "c", name: "Networks", code: "NET", color: "sage" }],
  items: [item],
  sources: [],
  changes: [
    {
      id: "change",
      item_id: "i",
      title: item.title,
      kind: "deadline_earlier",
      created_at: "2026-10-17T11:00:00Z",
      previous_starts_at: "2026-10-19T12:00:00Z",
      next_starts_at: item.starts_at,
      previous_all_day: false,
      next_all_day: false,
    },
  ],
});

it("uses the chosen lead time and excludes completed, date-only, unverified, elapsed and non-assignment records", () => {
  const data = workspace();
  data.changes = [];
  data.preferences.reminder_hours = 6;
  expect(pendingReminders(data, now, 0)).toEqual([]);
  data.preferences.reminder_hours = 24;
  expect(pendingReminders(data, now, 0)).toHaveLength(1);
  for (const change of [
    { status: "done" },
    { status: "dismissed" },
    { all_day: true },
    { verification: "needs_review" },
    { kind: "exam" },
    { starts_at: now.toISOString() },
  ]) {
    data.items = [{ ...item, ...change } as Item];
    expect(pendingReminders(data, now, 0)).toEqual([]);
  }
});

it("respects Berlin quiet hours across DST and catches up eligible changes after quiet hours", () => {
  const data = workspace();
  expect(pendingReminders(data, new Date("2026-10-17T21:00:00Z"), 0)).toEqual(
    [],
  );
  expect(
    pendingReminders(data, new Date("2026-10-18T05:00:00Z"), 0).some(
      (r) => r.change,
    ),
  ).toBe(true);
  data.preferences.quiet_start = 7;
  data.preferences.quiet_end = 8;
  expect(pendingReminders(data, new Date("2026-10-18T05:30:00Z"), 0)).toEqual(
    [],
  );
  data.items = [{ ...item, starts_at: "2026-10-26T00:00:00Z" }];
  data.changes = [];
  expect(
    pendingReminders(data, new Date("2026-10-25T05:30:00Z"), 0),
  ).toHaveLength(1);
  expect(pendingReminders(data, new Date("2026-10-25T06:30:00Z"), 0)).toEqual(
    [],
  );
  data.preferences.quiet_start = data.preferences.quiet_end = 7;
  expect(pendingReminders(data, now, 0)).toEqual([]);
});

it("only alerts about recent current deadline changes after activation, with one latest change per item", () => {
  const data = workspace();
  expect(pendingReminders(data, now, now.getTime()).some((r) => r.change)).toBe(
    false,
  );
  expect(pendingReminders(data, now, 0).filter((r) => r.change)).toHaveLength(
    1,
  );
  data.changes.push({
    ...data.changes[0],
    id: "older",
    created_at: "2026-10-17T10:00:00Z",
  });
  expect(
    pendingReminders(data, now, 0)
      .filter((r) => r.change)
      .map((r) => r.key),
  ).toEqual(["change:change"]);
  data.preferences.deadline_changes = false;
  expect(pendingReminders(data, now, 0).some((r) => r.change)).toBe(false);
  data.preferences.deadline_changes = true;
  for (const change of [
    { next_starts_at: "2026-10-20T12:00:00Z" },
    { next_all_day: true },
    { created_at: "2026-10-01T00:00:00Z" },
    { created_at: "2026-10-18T00:00:00Z" },
    { kind: "added" },
  ]) {
    data.changes = [{ ...workspace().changes[0], ...change }];
    expect(pendingReminders(data, now, 0).some((r) => r.change)).toBe(false);
  }
  data.preferences.reminders = false;
  expect(pendingReminders(data, now, 0)).toEqual([]);
  data.preferences.reminders = true;
  data.items = [{ ...item, all_day: true, verification: "needs_review" }];
  data.changes = [{ ...workspace().changes[0], next_all_day: true }];
  expect(pendingReminders(data, now, 0).map((r) => r.key)).toEqual([
    "change:change",
  ]);
});

it("keeps old/new Berlin dates, module context, uncertainty and stale source warnings in localized alerts", () => {
  const data = workspace();
  const reminder = pendingReminders(data, now, 0)[0];
  let text = reminderText(reminder, data, now);
  expect(text.title).toContain("moved earlier");
  expect(text.body).toContain("Networks");
  expect(text.body).toContain("19 Oct 2026");
  expect(text.body).toContain("18 Oct 2026");
  expect(text.body).toContain("14:00");
  data.preferences.language = "de";
  expect(reminderText(reminder, data, now).title).toContain("vorgezogen");
  data.preferences.language = "vi";
  expect(reminderText(reminder, data, now).title).toContain("sớm hơn");
  data.preferences.language = "en";
  data.sources = [
    {
      id: "s",
      name: "Moodle",
      kind: "feed",
      status: "failed",
      last_attempt: null,
      last_success: null,
      error: "Failure",
      imported_count: 1,
    },
  ];
  const uncertain = {
    ...reminder,
    item: {
      ...item,
      all_day: true,
      verification: "needs_review" as const,
      source_id: "s",
    },
  };
  text = reminderText(uncertain, data, now);
  expect(text.body).toContain("Date only; verify cutoff");
  expect(text.body).toContain("Verify the original");
  expect(text.body).toContain("Source outdated");
});
