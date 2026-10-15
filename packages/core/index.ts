import ICAL from "ical.js";
import { z } from "zod";

export const courseInput = z.object({
  name: z.string().trim().min(1).max(150),
  code: z.string().trim().max(30).default(""),
  color: z.enum(["sage", "blue", "clay", "gold"]).default("sage"),
});
const instant = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());
export const itemInput = z
  .object({
    title: z.string().trim().min(1).max(250),
    description: z.string().max(10000).default(""),
    kind: z.enum([
      "assignment",
      "lecture",
      "tutorial",
      "exam",
      "study",
      "announcement",
      "material",
    ]),
    starts_at: instant,
    ends_at: instant.nullable().default(null),
    all_day: z.boolean().default(false),
    course_id: z.string().max(100).nullable().default(null),
    status: z.enum(["open", "done", "dismissed"]).default("open"),
    verification: z.enum(["confirmed", "needs_review"]).default("confirmed"),
    source_url: z
      .union([
        z.literal(""),
        z
          .url()
          .refine((v) => ["https:", "http:"].includes(new URL(v).protocol)),
      ])
      .default(""),
    evidence: z.string().max(3000).default(""),
    document_key: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable()
      .optional(),
    document_hash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable()
      .optional(),
    document_name: z.string().trim().min(1).max(250).nullable().optional(),
  })
  .refine(
    (v) => !v.ends_at || new Date(v.ends_at) >= new Date(v.starts_at),
    "End must follow start",
  )
  .refine(
    (v) =>
      !v.document_key || !!(v.document_hash && v.document_name && v.course_id),
    "Document dates need a module, document name and content fingerprint",
  );
export const preferencesInput = z.object({
  language: z.enum(["en", "de", "vi"]),
  theme: z.enum(["light", "dark", "system"]),
  reminders: z.boolean(),
  quiet_start: z.number().int().min(0).max(23),
  quiet_end: z.number().int().min(0).max(23),
});
export type Course = z.infer<typeof courseInput> & { id: string };
export type Item = z.infer<typeof itemInput> & {
  id: string;
  source_id: string | null;
  last_verified: string | null;
  external_id?: string;
};
export type Source = {
  id: string;
  name: string;
  kind: string;
  status: string;
  last_attempt: string | null;
  last_success: string | null;
  error: string | null;
  imported_count: number;
};
export type Preferences = z.infer<typeof preferencesInput>;
export type Change = {
  id: string;
  item_id: string | null;
  title: string;
  kind: string;
  created_at: string;
  previous_starts_at?: string | null;
  next_starts_at?: string | null;
  previous_all_day?: boolean | number | null;
  next_all_day?: boolean | number | null;
};
export type Snapshot = {
  courses: Course[];
  items: Item[];
  sources: Source[];
  changes: Change[];
  preferences: Preferences;
};
export function itemChangeKind(
  previous: { starts_at: string } | null | undefined,
  next: { starts_at: string; kind: string },
) {
  if (!previous) return "added";
  if (next.kind === "assignment" && previous.starts_at !== next.starts_at)
    return next.starts_at < previous.starts_at
      ? "deadline_earlier"
      : "deadline_later";
  return "updated";
}
export const defaultPreferences: Preferences = {
  language: "en",
  theme: "system",
  reminders: false,
  quiet_start: 22,
  quiet_end: 7,
};
export const berlinDay = (date: Date | string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
export type CalendarView = "day" | "week" | "month";
export function shiftCalendarPeriod(
  anchor: Date,
  view: CalendarView,
  direction: number,
) {
  const date = new Date(berlinDay(anchor) + "T12:00:00Z");
  if (view === "month") {
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + direction);
  } else
    date.setUTCDate(date.getUTCDate() + direction * (view === "week" ? 7 : 1));
  return date;
}
export function calendarDates(anchor: Date, view: CalendarView) {
  const start = new Date(berlinDay(anchor) + "T12:00:00Z");
  let count = view === "day" ? 1 : 7;
  if (view === "month") {
    start.setUTCDate(1);
    const days = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
    ).getUTCDate();
    count = Math.ceil((days + ((start.getUTCDay() + 6) % 7)) / 7) * 7;
  }
  if (view !== "day")
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return Array.from(
    { length: count },
    (_, index) => new Date(start.getTime() + index * 86400000),
  );
}
export function quietHour(hour: number, start: number, end: number) {
  return (
    start === end ||
    (start < end ? hour >= start && hour < end : hour >= start || hour < end)
  );
}
export function briefing(items: Item[], sources: Source[], now = new Date()) {
  const pending = items.filter(
    (i) => i.kind === "assignment" && i.status === "open",
  );
  const week = pending.filter(
    (i) =>
      !isPastDue(i, now) &&
      new Date(i.starts_at).getTime() <= now.getTime() + 7 * 86400000,
  );
  const overdue = pending.filter((i) => isPastDue(i, now));
  const healthy = sources.filter(
    (s) =>
      s.status === "connected" &&
      s.last_success &&
      now.getTime() - new Date(s.last_success).getTime() < 3600000,
  ).length;
  return {
    week: week.length,
    overdue: overdue.length,
    today: items.filter(
      (i) => berlinDay(i.starts_at) === berlinDay(now) && i.status === "open",
    ).length,
    healthy,
    total: sources.length,
  };
}
export function isPastDue(
  item: Pick<Item, "starts_at" | "all_day">,
  now = new Date(),
) {
  return item.all_day
    ? berlinDay(item.starts_at) < berlinDay(now)
    : Date.parse(item.starts_at) < now.getTime();
}
export type ImportedEvent = {
  external_id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  kind: "assignment" | "lecture" | "exam" | "tutorial" | "announcement";
  course_name: string | null;
  source_url: string;
  cancelled: boolean;
};
export function parseCalendar(text: string): ImportedEvent[] {
  if (
    text.length > 2_000_000 ||
    !text.trimStart().startsWith("BEGIN:VCALENDAR")
  )
    throw new Error("Choose an iCalendar file under 2 MB.");
  ICAL.TimezoneService.reset();
  const root = new ICAL.Component(ICAL.parse(text));
  const moodle = /moodle/i.test(
    String(root.getFirstPropertyValue("prodid") || ""),
  );
  if (root.getAllSubcomponents("vtodo").length)
    throw new Error(
      "Task calendars (VTODO) are not supported. Export an event calendar instead.",
    );
  // shortcut: recurrence is rejected; add bounded expansion with timezone fixtures before accepting recurring timetables.
  if (
    root
      .getAllSubcomponents("vevent")
      .some((c) => c.hasProperty("rrule") || c.hasProperty("recurrence-id"))
  )
    throw new Error(
      "Recurring calendars are not supported yet. Export individual events. Nothing was imported.",
    );
  for (const zone of root.getAllSubcomponents("vtimezone"))
    ICAL.TimezoneService.register(new ICAL.Timezone(zone));
  const seen = new Set<string>();
  const events = root.getAllSubcomponents("vevent");
  if (events.length > 500)
    throw new Error("Import at most 500 events at a time.");
  return events.map((c) => {
    const e = new ICAL.Event(c);
    if (!e.uid || seen.has(e.uid))
      throw new Error(
        "Calendar contains missing or duplicate event identifiers.",
      );
    seen.add(e.uid);
    const start = e.startDate;
    if (!start) throw new Error("Every event needs a start date.");
    if (!start.isDate && start.zone.tzid === "floating")
      throw new Error("Timed events need UTC or an embedded VTIMEZONE.");
    if (
      !start.isDate &&
      start.zone.tzid !== "UTC" &&
      !ICAL.TimezoneService.has(start.zone.tzid)
    )
      throw new Error(
        "Unknown calendar timezone. Include VTIMEZONE or export UTC.",
      );
    const url = String(c.getFirstPropertyValue("url") || "");
    const title = e.summary || "Untitled event";
    const categories = [
      ...new Set(
        c
          .getAllProperties("categories")
          .flatMap((property) => property.getValues())
          .map((value) => String(value).trim())
          .filter(Boolean),
      ),
    ];
    const course_name =
      moodle && categories.length === 1
        ? categories[0]
            .replace(/^\((?:VO|VU|UE|Ü|SE|PR)\)\s*/u, "")
            .slice(0, 150)
        : null;
    const starts_at = start.isDate
      ? `${start.toString()}T00:00:00.000Z`
      : start.toJSDate().toISOString();
    return {
      external_id: e.uid,
      course_name: course_name || null,
      title: title.slice(0, 250),
      description: (e.description || "").slice(0, 10000),
      starts_at,
      ends_at: e.endDate ? e.endDate.toJSDate().toISOString() : null,
      all_day: start.isDate,
      kind: /\bopens\b|öffnet|wird geöffnet/i.test(title)
        ? "announcement"
        : /deadline|abgabe|assignment|\bdue\b|fällig|faellig|anmeldeschluss|\bcloses\b/i.test(
              title,
            )
          ? "assignment"
          : /exam|klausur|prüfung/i.test(title)
            ? "exam"
            : /übung|uebung|tutorial|exercise|tutorium/i.test(title)
              ? "tutorial"
              : "lecture",
      source_url: /^https?:\/\//i.test(url) ? url : "",
      cancelled: c.getFirstPropertyValue("status") === "CANCELLED",
    };
  });
}
export function validateFeed(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "moodle.rwth-aachen.de" ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/calendar/export_execute.php"
  )
    throw new Error("Use the official HTTPS RWTHmoodle calendar export URL.");
  return url.toString();
}
