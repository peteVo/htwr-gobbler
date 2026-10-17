import { quietHour, type Change, type Item, type Snapshot } from "./index";

export type Reminder = { key: string; item: Item; change?: Change };

export function pendingReminders(
  data: Snapshot,
  now: Date,
  changesSince: number,
): Reminder[] {
  const prefs = data.preferences;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Europe/Berlin",
    }).format(now),
  );
  if (!prefs.reminders || quietHour(hour, prefs.quiet_start, prefs.quiet_end))
    return [];
  const open = data.items.filter(
    (i) => i.kind === "assignment" && i.status === "open",
  );
  const reminders: Reminder[] = [];
  if (prefs.deadline_changes ?? true) {
    const changes = [...data.changes].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
    );
    for (const change of changes) {
      const item = open.find((i) => i.id === change.item_id);
      const created = Date.parse(change.created_at);
      if (
        item &&
        ["deadline_earlier", "deadline_later"].includes(change.kind) &&
        created > changesSince &&
        created <= now.getTime() &&
        now.getTime() - created <= 7 * 86400000 &&
        change.previous_starts_at &&
        change.next_starts_at === item.starts_at &&
        (change.next_all_day == null ||
          Boolean(change.next_all_day) === item.all_day) &&
        !reminders.some((r) => r.item.id === item.id)
      ) {
        reminders.push({ key: "change:" + change.id, item, change });
      }
    }
  }
  for (const item of open) {
    const until = Date.parse(item.starts_at) - now.getTime();
    if (
      item.verification === "confirmed" &&
      !item.all_day &&
      until > 0 &&
      until <= (prefs.reminder_hours ?? 24) * 3600000
    ) {
      reminders.push({ key: `${item.id}:${item.starts_at}`, item });
    }
  }
  return reminders;
}

export function reminderText(
  reminder: Reminder,
  data: Snapshot,
  now = new Date(),
) {
  const { item, change } = reminder;
  const language = data.preferences.language;
  const words = {
    en: {
      approaching: "Deadline approaching",
      earlier: "Deadline moved earlier",
      later: "Deadline moved later",
      review: "Verify the original",
      dateOnly: "Date only; verify cutoff",
      stale: "Source outdated",
    },
    de: {
      approaching: "Abgabefrist naht",
      earlier: "Frist vorgezogen",
      later: "Frist verschoben",
      review: "Original prüfen",
      dateOnly: "Nur Datum; Uhrzeit prüfen",
      stale: "Quelle veraltet",
    },
    vi: {
      approaching: "Sắp đến hạn nộp",
      earlier: "Hạn nộp chuyển sớm hơn",
      later: "Hạn nộp chuyển muộn hơn",
      review: "Kiểm tra nguồn gốc",
      dateOnly: "Chỉ có ngày; cần kiểm tra giờ",
      stale: "Nguồn chưa cập nhật",
    },
  }[language];
  const stamp = (date: string, allDay: boolean) =>
    new Intl.DateTimeFormat(
      { en: "en-GB", de: "de-DE", vi: "vi-VN" }[language],
      {
        timeZone: "Europe/Berlin",
        dateStyle: "medium",
        ...(!allDay && { timeStyle: "short" }),
      },
    ).format(new Date(date));
  const module = data.courses.find((c) => c.id === item.course_id)?.name;
  const source = data.sources.find((s) => s.id === item.source_id);
  const stale =
    source &&
    (source.status !== "connected" ||
      !source.last_success ||
      now.getTime() - Date.parse(source.last_success) >= 3600000);
  return {
    title:
      "htwr-gobbler · " +
      (change
        ? change.kind === "deadline_earlier"
          ? words.earlier
          : words.later
        : words.approaching),
    body: [
      module,
      item.title,
      (change
        ? `${stamp(change.previous_starts_at!, change.previous_all_day == null || Boolean(change.previous_all_day))} → ${stamp(item.starts_at, item.all_day)}`
        : stamp(item.starts_at, item.all_day)) + " (Europe/Berlin)",
      item.all_day && words.dateOnly,
      item.verification === "needs_review" && words.review,
      stale && words.stale,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}
