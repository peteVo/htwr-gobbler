export type DocumentPage = { page: number | null; text: string; ocr?: boolean };
export type DeadlineCandidate = {
  title: string;
  deadline: string;
  evidence: string;
  page: number | null;
  document: string;
  all_day?: boolean;
  ocr?: boolean;
};

export function berlinInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  if (hour > 23 || minute > 59) return null;
  const expected = [year, month, day, hour, minute];
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  });
  const matches = [60, 120]
    .map(
      (offset) =>
        new Date(Date.UTC(year, month - 1, day, hour, minute) - offset * 60000),
    )
    .filter((date) => {
      const parts = Object.fromEntries(
        format.formatToParts(date).map((p) => [p.type, p.value]),
      );
      return [
        parts.year,
        parts.month,
        parts.day,
        parts.hour,
        parts.minute,
      ].every((v, i) => Number(v) === expected[i]);
    });
  return matches.length === 1 ? matches[0].toISOString() : null;
}
export function extractExplicitDeadlines(
  pages: DocumentPage[],
  document = "Pasted document",
): DeadlineCandidate[] {
  const results: DeadlineCandidate[] = [];
  for (const page of pages) {
    // shortcut: dates need an explicit year; relative dates and OCR require a separate review workflow.
    const pattern =
      /\b(\d{1,2})\.\s*(?:(\d{1,2})\.|(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember))\s*(\d{4})(?:\s*(?:(?:um|at|bis)\s*)?(\d{1,2}):(\d{2}))?\b/gi;
    for (const match of page.text.matchAll(pattern)) {
      const evidence = page.text
        .slice(
          Math.max(0, match.index! - 80),
          match.index! + match[0].length + 80,
        )
        .trim();
      if (
        !/abgabe|deadline|due|einreich|bis zum|anmeldeschluss|anmeldeende|anmeldung.{0,60}\bbis\b|hạn nộp/i.test(
          evidence.replace(/\s+/g, " "),
        )
      )
        continue;
      const months = [
        "januar",
        "februar",
        "märz",
        "april",
        "mai",
        "juni",
        "juli",
        "august",
        "september",
        "oktober",
        "november",
        "dezember",
      ];
      const month = match[2]
        ? Number(match[2])
        : months.indexOf(match[3].toLowerCase().replace("maerz", "märz")) + 1;
      const dateOnly = match[5] === undefined;
      const deadline = berlinInstant(
        Number(match[4]),
        month,
        Number(match[1]),
        dateOnly ? 12 : Number(match[5]),
        dateOnly ? 0 : Number(match[6]),
      );
      if (!deadline) continue;
      results.push({
        title: `Deadline candidate · ${document}`,
        deadline: dateOnly
          ? deadline.slice(0, 10) + "T00:00:00.000Z"
          : deadline,
        evidence,
        page: page.page,
        document,
        ...(page.ocr ? { ocr: true } : {}),
        ...(dateOnly ? { all_day: true } : {}),
      });
    }
  }
  return results;
}
