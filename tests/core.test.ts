import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  parseCalendar,
  validateFeed,
  berlinDay,
  briefing,
  quietHour,
  itemInput,
  calendarDates,
  shiftCalendarPeriod,
} from "../packages/core/index";
import { crypt, passwordHash, equal } from "../apps/api/security";
const fixture = readFileSync(
  new URL("./fixtures/calendar.ics", import.meta.url),
  "utf8",
);
describe("calendar trust boundary", () => {
  it("extracts explicit Moodle modules and distinguishes due dates from sessions and openings", () => {
    const events = parseCalendar(
      readFileSync("tests/fixtures/moodle.ics", "utf8"),
    );
    expect(events.map((e) => e.kind)).toEqual([
      "assignment",
      "assignment",
      "tutorial",
      "announcement",
    ]);
    expect(
      events.every((e) => e.course_name === "Foundations of Testing"),
    ).toBe(true);
    expect(events[0].starts_at).toBe("2026-11-03T17:30:00.000Z");
    const source = readFileSync("tests/fixtures/moodle.ics", "utf8");
    expect(
      parseCalendar(
        source.replace(
          "Exam poll (deadline November 1) opens",
          "Open Source Systems",
        ),
      )[3].kind,
    ).toBe("lecture");
  });
  it("does not guess a module from non-Moodle categories or multiple categories", () => {
    const calendar = readFileSync("tests/fixtures/moodle.ics", "utf8");
    expect(
      parseCalendar(
        calendar
          .replace("Moodle Pty Ltd", "Another exporter")
          .replace("Moodle Test Calendar", "Academic Calendar"),
      )[0].course_name,
    ).toBeNull();
    expect(
      parseCalendar(
        calendar.replaceAll(
          "CATEGORIES:(VO) Foundations of Testing",
          "CATEGORIES:Work,Personal",
        ),
      )[0].course_name,
    ).toBeNull();
  });
  it("normalizes API offsets to one UTC representation", () =>
    expect(
      itemInput.parse({
        title: "Test",
        kind: "assignment",
        starts_at: "2026-10-20T16:00:00+02:00",
      }).starts_at,
    ).toBe("2026-10-20T14:00:00.000Z"));
  it("parses UTC events with provenance and classifies deadlines", () => {
    const events = parseCalendar(fixture);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      external_id: "exercise-03@test.invalid",
      starts_at: "2026-10-20T14:00:00.000Z",
      kind: "assignment",
      source_url: "https://moodle.rwth-aachen.de/calendar/view.php",
    });
  });
  it("rejects recurrence atomically instead of giving incomplete coverage", () =>
    expect(() =>
      parseCalendar(
        fixture.replace(
          "DTSTART:20261020T140000Z",
          "RRULE:FREQ=WEEKLY\nDTSTART:20261020T140000Z",
        ),
      ),
    ).toThrow("Recurring"));
  it("rejects floating times and duplicate UIDs", () => {
    expect(() =>
      parseCalendar(fixture.replaceAll("T140000Z", "T140000")),
    ).toThrow("UTC");
    expect(() =>
      parseCalendar(
        fixture.replace("lecture@test.invalid", "exercise-03@test.invalid"),
      ),
    ).toThrow("duplicate");
  });
  it("rejects HTML login responses and oversized files", () => {
    expect(() => parseCalendar("<html>login</html>")).toThrow();
    expect(() => parseCalendar("x".repeat(2_000_001))).toThrow();
  });
  it("keeps all-day date semantics", () => {
    const event = parseCalendar(
      fixture
        .replace("DTSTART:20261020T140000Z", "DTSTART;VALUE=DATE:20261020")
        .replace("DTEND:20261020T140000Z", "DTEND;VALUE=DATE:20261021"),
    )[0];
    expect(event.all_day).toBe(true);
    expect(berlinDay(event.starts_at)).toBe("2026-10-20");
  });
  it("handles Berlin DST boundary for display", () => {
    expect(berlinDay("2026-10-24T22:30:00Z")).toBe("2026-10-25");
    expect(berlinDay("2026-10-25T22:30:00Z")).toBe("2026-10-25");
  });
  it("includes all six rows in months that need them", () => {
    const dates = calendarDates(new Date("2026-03-15T12:00Z"), "month");
    expect(dates).toHaveLength(42);
    expect(dates.map(berlinDay)).toContain("2026-03-31");
  });
  it("moves January 31 to February without skipping the month", () =>
    expect(
      berlinDay(shiftCalendarPeriod(new Date("2026-01-31T12:00Z"), "month", 1)),
    ).toBe("2026-02-01"));
  it.each([
    "http://moodle.rwth-aachen.de/calendar/export_execute.php",
    "https://moodle.rwth-aachen.de.evil.test/calendar/export_execute.php",
    "https://127.0.0.1/calendar/export_execute.php",
    "https://moodle.rwth-aachen.de:444/calendar/export_execute.php",
    "https://x@moodle.rwth-aachen.de/calendar/export_execute.php",
    "https://moodle.rwth-aachen.de/admin",
  ])("blocks unsafe feed URL %s", (url) =>
    expect(() => validateFeed(url)).toThrow(),
  );
  it("accepts only the official export endpoint", () =>
    expect(
      validateFeed(
        "https://moodle.rwth-aachen.de/calendar/export_execute.php?token=example",
      ),
    ).toContain("export_execute.php"));
  it("does not call an unchecked workspace healthy", () =>
    expect(briefing([], [])).toMatchObject({ healthy: 0, total: 0 }));
  it("handles quiet hours spanning midnight", () => {
    expect(quietHour(23, 22, 7)).toBe(true);
    expect(quietHour(6, 22, 7)).toBe(true);
    expect(quietHour(12, 22, 7)).toBe(false);
    expect(quietHour(12, 7, 7)).toBe(true);
  });
  it("rejects script URLs at the API boundary", () =>
    expect(
      itemInput.safeParse({
        title: "test",
        kind: "assignment",
        starts_at: "2026-10-20T14:00:00Z",
        source_url: "javascript:alert(1)",
      }).success,
    ).toBe(false));
});
describe("secrets", () => {
  it("encrypts feeds with random nonces and detects tampering", async () => {
    const secret = "test-secret-32-characters-or-more",
      url = "https://example.test/?secret=private";
    const a = await crypt(url, secret),
      b = await crypt(url, secret);
    expect(a).not.toBe(b);
    expect(a).not.toContain("private");
    expect(await crypt(a, secret, true)).toBe(url);
    await expect(crypt(a, "wrong", true)).rejects.toThrow();
  });
  it("salts password derivation and compares safely", async () => {
    const a = await passwordHash("test-password-12", "salt");
    expect(a).toHaveLength(64);
    expect(await passwordHash("test-password-12", "other")).not.toBe(a);
    expect(equal(a, a)).toBe(true);
    expect(equal(a, a + "0")).toBe(false);
  });
});
