import { test, expect, vi, afterEach } from "vitest";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  readLocalPdf,
  readLocalOcr,
  PdfPendingError,
  splitMaterialPages,
} from "../scripts/pdf-reader";
import { selectPassages, materialInput } from "../packages/core/materials";
afterEach(() => vi.unstubAllGlobals());

test("PDF extraction resumes at the next original page and bounded parts retain OCR provenance", async () => {
  const data = await fs.readFile("tests/fixtures/batched.pdf");
  const file =
    ".wrangler/local/pdf-cache/" +
    createHash("sha256").update("gobbler-pdf-v2:").update(data).digest("hex") +
    ".json";
  await fs.rm(file, { force: true });
  try {
    await expect(readLocalPdf(data)).rejects.toMatchObject({
      done: 10,
      total: 11,
    });
    const pages = await readLocalPdf(data);
    expect(pages.map((p) => p.page)).toEqual(
      Array.from({ length: 11 }, (_, i) => i + 1),
    );
    expect(await readLocalPdf(data)).toEqual(pages);
    const noOcr = vi.fn(() => {
      throw new Error("A genuinely blank page must not call OCR");
    });
    vi.stubGlobal("fetch", noOcr);
    const blank = await readLocalPdf(
      await fs.readFile("tests/fixtures/blank-page.pdf"),
    );
    expect(blank).toHaveLength(2);
    expect(blank[1]).toMatchObject({ page: 2, text: "" });
    expect(noOcr).not.toHaveBeenCalled();
    const original = Array.from({ length: 201 }, (_, i) => ({
      page: i + 1,
      text: "Lecture text " + i,
      ...(i === 200 ? { ocr: true } : {}),
    }));
    const parts = splitMaterialPages(original);
    expect(parts.map((p) => p.length)).toEqual([200, 1]);
    expect(parts[1][0]).toEqual({
      page: 201,
      text: "Lecture text 200",
      ocr: true,
    });
    expect(
      materialInput.safeParse({
        course_id: "c",
        name: "Part 2",
        source_url: "",
        pages: parts[1],
      }).success,
    ).toBe(true);
    const passages = selectPassages(
      [
        {
          id: "m",
          course_id: "c",
          name: "Part 2",
          source_url: "",
          created_at: "now",
          pages: parts[1],
        },
      ],
      "Lecture",
    );
    expect(passages[0]).toMatchObject({ page: 201, ocr: true });
    expect(() =>
      splitMaterialPages([{ page: 1, text: "x".repeat(500001) }]),
    ).toThrow();
  } finally {
    await fs.rm(file, { force: true });
  }
}, 30000);

test.skipIf(process.platform !== "win32")(
  "local OCR renders a scan, uses only loopback inference and rejects truncated output",
  async () => {
    const data = await fs.readFile("tests/fixtures/scanned.pdf");
    let complete = true;
    const provider = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("http://127.0.0.1:11434/api/generate");
      expect(init.redirect).toBe("error");
      const body = JSON.parse(String(init.body));
      expect(body.model).toBe("glm-ocr:latest");
      expect(body.prompt).toBe("Text Recognition:");
      expect(body.images).toHaveLength(1);
      expect(
        Buffer.from(body.images[0], "base64").subarray(1, 4).toString(),
      ).toBe("PNG");
      return Response.json({
        done: complete,
        done_reason: complete ? "stop" : "length",
        response: "Gobbler OCR test\nLocal document processing.",
      });
    });
    vi.stubGlobal("fetch", provider);
    expect((await readLocalOcr(data, [1]))[0]).toMatchObject({
      page: 1,
      ocr: true,
      text: expect.stringContaining("Gobbler OCR test"),
    });
    complete = false;
    await expect(readLocalOcr(data, [1])).rejects.toThrow();
  },
  30000,
);

test.skipIf(process.platform === "win32")(
  "unsupported native rendering reports a local OCR requirement",
  async () => {
    await expect(readLocalOcr(Buffer.from("scan"), [1])).rejects.toMatchObject({
      issue: "renderer_unavailable",
    });
  },
);
