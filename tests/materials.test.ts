import { test, expect, vi, afterEach } from "vitest";
import {
  materialInput,
  selectPassages,
  type Material,
} from "../packages/core/materials";
import { answerCourse } from "../apps/api/assistant";
afterEach(() => vi.unstubAllGlobals());
const material: Material = {
  id: "m",
  course_id: "c",
  name: "TCP notes",
  source_url: "https://example.test/notes",
  created_at: "2026-10-17",
  pages: [
    {
      page: 3,
      text: "TCP uses acknowledgements and retransmission to provide reliable delivery.",
    },
  ],
};
test("material validation and retrieval retain page evidence and bound model context", () => {
  expect(
    materialInput.safeParse({ ...material, pages: [{ page: 1, text: " " }] })
      .success,
  ).toBe(false);
  expect(
    materialInput.safeParse({ ...material, source_url: "javascript:alert(1)" })
      .success,
  ).toBe(false);
  expect(
    materialInput.safeParse({
      ...material,
      pages: [{ page: 1, text: "x".repeat(500001) }],
    }).success,
  ).toBe(false);
  const passages = selectPassages(
    [
      {
        ...material,
        pages: [
          { page: 1, text: "Unrelated introduction. ".repeat(1000) },
          ...material.pages,
        ],
      },
    ],
    "How does TCP provide reliable delivery?",
  );
  expect(passages).toHaveLength(8);
  expect(passages[0]).toMatchObject({ id: "1", page: 3 });
  expect(passages.every((p) => p.text.length <= 1600)).toBe(true);
});
test("local assistant accepts only complete answers with matching quotations and references", async () => {
  const passages = selectPassages([material], "TCP");
  let result: unknown = {
    answer: "TCP uses retransmission [1].",
    supported: true,
    citations: [
      { id: "1", quote: "TCP uses acknowledgements and retransmission" },
    ],
  };
  let reason = "stop";
  const provider = vi.fn(async (url: string, init: RequestInit) => {
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    expect(init.redirect).toBe("manual");
    const body = JSON.parse(String(init.body));
    expect(body.stream).toBe(false);
    expect(body.model).toBe("test-local");
    return Response.json({
      done: true,
      done_reason: reason,
      message: { content: JSON.stringify(result) },
    });
  });
  vi.stubGlobal("fetch", provider);
  expect(
    (await answerCourse("test-local", "TCP?", "en", passages)).citations[0],
  ).toMatchObject({ page: 3, material_id: "m" });
  const spaced = [
    {
      ...passages[0],
      text: "TCP uses\n  acknowledgements and retransmission to provide reliable delivery.",
    },
  ];
  expect(
    (await answerCourse("test-local", "TCP?", "en", spaced)).citations[0].quote,
  ).toBe("TCP uses\n  acknowledgements and retransmission");
  result = {
    answer: "Invented [1]",
    supported: true,
    citations: [{ id: "1", quote: "This quotation is not in the document" }],
  };
  await expect(
    answerCourse("test-local", "TCP?", "en", passages),
  ).rejects.toThrow();
  result = {
    answer: "Unsupported [99]",
    supported: true,
    citations: [
      { id: "1", quote: "TCP uses acknowledgements and retransmission" },
    ],
  };
  await expect(
    answerCourse("test-local", "TCP?", "en", passages),
  ).rejects.toThrow();
  result = { answer: "Invented answer", supported: false, citations: [] };
  expect(await answerCourse("test-local", "Unknown?", "en", passages)).toEqual({
    answer: "",
    supported: false,
    citations: [],
  });
  reason = "length";
  await expect(
    answerCourse("test-local", "TCP?", "en", passages),
  ).rejects.toThrow();
  const calls = provider.mock.calls.length;
  expect(await answerCourse("test-local", "Unknown?", "en", [])).toEqual({
    answer: "",
    supported: false,
    citations: [],
  });
  expect(provider.mock.calls.length).toBe(calls);
});
