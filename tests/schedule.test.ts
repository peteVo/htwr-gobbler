import { test, expect } from "vitest";
import { scheduleKind } from "../packages/core/schedule";

test("recognizes explicit next-event timing questions without treating content or ambiguous questions as dates", () => {
  expect(scheduleKind("When's the next lecture")).toBe("lecture");
  expect(scheduleKind("Wann ist die nächste Vorlesung?")).toBe("lecture");
  expect(scheduleKind("Khi nào có buổi học tiếp theo?")).toBe("lecture");
  expect(scheduleKind("When is my next deadline?")).toBe("assignment");
  expect(scheduleKind("When is the next exam?")).toBe("exam");
  expect(scheduleKind("Explain the next lecture's topic")).toBeNull();
  expect(scheduleKind("When is the next lecture or tutorial?")).toBeNull();
});
