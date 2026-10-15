export type DocumentPage = { page: number | null; text: string };
export type DeadlineCandidate = {
  title: string;
  deadline: string;
  evidence: string;
  page: number | null;
  document: string;
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
    // shortcut: local extraction recognizes explicit numeric dates with a year and time; add locale-specific parsers only with fixtures.
    const pattern =
      /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\s*(?:(?:um|at|bis)\s*)?(\d{1,2}):(\d{2})\b/g;
    for (const match of page.text.matchAll(pattern)) {
      const evidence = page.text
        .slice(
          Math.max(0, match.index! - 80),
          match.index! + match[0].length + 80,
        )
        .trim();
      if (!/abgabe|deadline|due|einreich|bis zum|hạn nộp/i.test(evidence))
        continue;
      const deadline = berlinInstant(
        Number(match[3]),
        Number(match[2]),
        Number(match[1]),
        Number(match[4]),
        Number(match[5]),
      );
      if (!deadline) continue;
      results.push({
        title: `Deadline candidate · ${document}`,
        deadline,
        evidence,
        page: page.page,
        document,
      });
    }
  }
  return results;
}
