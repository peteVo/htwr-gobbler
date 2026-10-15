import { describe, it, expect } from "vitest";
import {
  berlinInstant,
  extractExplicitDeadlines,
} from "../packages/core/deadlines";
describe("evidenced local deadline candidates", () => {
  it("finds explicit German deadlines and retains page evidence", () => {
    const text = "Abgabe bis zum 20.10.2026 um 16:00 Uhr.";
    expect(
      extractExplicitDeadlines([{ page: 2, text }], "Sheet 3.pdf"),
    ).toEqual([
      {
        title: "Deadline candidate · Sheet 3.pdf",
        deadline: "2026-10-20T14:00:00.000Z",
        evidence: text,
        page: 2,
        document: "Sheet 3.pdf",
      },
    ]);
  });
  it("does not invent dates without a year, time or deadline context", () => {
    for (const text of [
      "Lecture 20.10.2026 um 16:00",
      "Abgabe 20.10. um 16:00",
      "Abgabe 20.10.2026",
      "Abgabe 31.02.2026 um 16:00",
    ])
      expect(extractExplicitDeadlines([{ page: 1, text }])).toEqual([]);
  });
  it("rejects impossible and ambiguous daylight saving times", () => {
    expect(berlinInstant(2026, 3, 29, 2, 30)).toBeNull();
    expect(berlinInstant(2026, 10, 25, 2, 30)).toBeNull();
    expect(berlinInstant(2026, 10, 26, 16, 0)).toBe("2026-10-26T15:00:00.000Z");
  });
});
