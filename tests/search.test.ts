import { expect, it } from "vitest";
import { searchWorkspace } from "../packages/core/search";
import {
  defaultPreferences,
  itemInput,
  type Snapshot,
} from "../packages/core/index";

const data: Snapshot = {
  preferences: defaultPreferences,
  changes: [],
  courses: [
    {
      id: "c",
      name: "Einführung in Rechnernetze",
      code: "NET26",
      color: "sage",
    },
  ],
  items: [
    {
      ...itemInput.parse({
        title: "Übung Übersicht",
        description: "Routing protocols",
        evidence: "Abgabe Freitag",
        kind: "material",
        status: "dismissed",
        starts_at: "2026-10-22T00:00:00Z",
        course_id: "c",
        document_name: "network-notes.pdf",
      }),
      id: "i",
      source_id: null,
      last_verified: null,
    },
  ],
  actions: [
    {
      id: "a",
      title: "Review Straße examples",
      notes: "Đăng ký nhóm",
      course_id: "c",
      status: "done",
      source_url: "https://example.test/private-token",
      created_at: "2026-10-17T00:00:00Z",
    },
  ],
  sources: [
    {
      id: "s",
      name: "Moodle calendar",
      kind: "feed",
      status: "failed",
      last_attempt: null,
      last_success: null,
      error: "Connection failed",
      imported_count: 1,
    },
  ],
};

it("finds all record types and completed/dismissed work across module codes, notes and evidence", () => {
  expect(searchWorkspace(data, "NET26").map((r) => r.type)).toEqual([
    "item",
    "action",
    "course",
  ]);
  expect(searchWorkspace(data, "Rechnernetze")[0].type).toBe("course");
  for (const query of [
    "ubung",
    "network-notes",
    "routing NET26",
    "abgabe freitag",
  ]) {
    expect(searchWorkspace(data, query).map((r) => r.record.id)).toEqual(["i"]);
  }
  expect(searchWorkspace(data, "  DANG   KY ").map((r) => r.record.id)).toEqual(
    ["a"],
  );
  expect(searchWorkspace(data, "strasse").map((r) => r.record.id)).toEqual([
    "a",
  ]);
  expect(
    searchWorkspace(data, "Moodle failed").map((r) => r.record.id),
  ).toEqual(["s"]);
});

it("uses literal words, excludes identifiers and URLs, and handles older snapshots without actions", () => {
  expect(searchWorkspace(data, "private-token")).toEqual([]);
  expect(searchWorkspace(data, "[.*")).toEqual([]);
  expect(searchWorkspace(data, "NET26 missing")).toEqual([]);
  expect(searchWorkspace({ ...data, actions: undefined }, "")).toHaveLength(3);
  expect(data.items[0].status).toBe("dismissed");
});
