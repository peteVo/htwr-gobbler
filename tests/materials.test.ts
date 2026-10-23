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

test("retrieval declines unrelated questions and retains original OCR page evidence", () => {
  for (const question of [
    "Where is the chemistry laboratory?",
    "Wo ist das Chemielabor?",
    "Phong thi nghiem hoa hoc o dau?",
    "What is this?",
  ])
    expect(selectPassages([material], question)).toEqual([]);
  const passages = selectPassages(
    [{ ...material, pages: [{ ...material.pages[0], ocr: true }] }],
    "How does TCP work?",
  );
  expect(passages).toEqual([
    expect.objectContaining({
      page: 3,
      ocr: true,
      text: material.pages[0].text,
      material_id: "m",
    }),
  ]);
});
test("retrieval favors topic evidence over common question words and repeated filename matches", () => {
  const library = [
    {
      ...material,
      name: "Segmentation.pdf",
      pages: [
        {
          page: 1,
          text: "What does this explain about your course? ".repeat(100),
        },
      ],
    },
    {
      ...material,
      id: "evidence",
      name: "Lecture notes.pdf",
      pages: [
        {
          page: 7,
          text: "Segmentation partitions an image into meaningful regions.",
        },
      ],
    },
  ];
  for (const question of [
    "What does this explain about segmentation?",
    "Was ist Segmentation?",
    "Hay giai thich segmentation la gi?",
  ]) {
    const result = selectPassages(library, question);
    expect(result[0]).toMatchObject({ material_id: "evidence", page: 7 });
    expect(result.every((p) => !("found" in p) && !("score" in p))).toBe(true);
  }
});

test("retrieval recognizes numbered lecture filenames and ranks topic pages above outlines", () => {
  const library = [
    {
      ...material,
      id: "outline",
      name: "intro.pdf",
      pages: Array.from({ length: 12 }, (_, i) => ({
        page: i + 1,
        text: "Image segmentation is on the course outline.",
      })),
    },
    {
      ...material,
      id: "topic",
      name: "cv26-part05-segmentation1-6on1.pdf",
      pages: [
        {
          page: 4,
          text: "Image segmentation partitions an image into regions sharing a property.",
        },
      ],
    },
  ];
  expect(
    selectPassages(library, "What is image segmentation?")[0],
  ).toMatchObject({ material_id: "topic", page: 4 });
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
    expect(body.format.properties.citations.items.properties.id.enum).toEqual([
      "1",
    ]);
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
  result = {
    answer: "TCP uses retransmission [1].",
    supported: true,
    citations: [{ id: "1" }],
  };
  expect(
    (await answerCourse("test-local", "TCP?", "en", passages)).citations[0]
      .quote,
  ).toBe(passages[0].text);
  result = {
    answer: "TCP uses retransmission [1].",
    supported: true,
    citations: [
      { id: "1", quote: "TCP uses acknowledgements and retransmission" },
    ],
  };
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
