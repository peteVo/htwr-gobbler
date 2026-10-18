import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { z } from "zod";
import { materialInput } from "../packages/core/materials";
import type { DocumentPage } from "../packages/core/deadlines";

const root = path.resolve(import.meta.dirname, "..");
const cacheRoot = path.join(root, ".wrangler/local/pdf-cache");
const pageInput = materialInput.shape.pages.element;
const batchInput = z.object({
  total: z.number().int().min(1).max(2000),
  pages: z
    .array(pageInput.extend({ ocr_needed: z.boolean().optional() }))
    .min(1)
    .max(10),
});
const cacheInput = z
  .object({
    total: z.number().int().min(1).max(2000),
    pages: z.array(pageInput).max(2000),
  })
  .refine(
    (v) =>
      v.pages.length <= v.total &&
      v.pages.every((p, i) => p.page === i + 1) &&
      v.pages.reduce((n, p) => n + p.text.length, 0) <= 2_000_000,
  );

export class PdfPendingError extends Error {
  constructor(
    public done: number,
    public total: number,
  ) {
    super("PDF indexing is continuing");
  }
}
export class PdfReadError extends Error {
  constructor(
    public issue:
      | "unreadable"
      | "ocr_unavailable"
      | "renderer_unavailable"
      | "ocr_incomplete"
      | "limits"
      | "timeout"
      | "library_full",
  ) {
    super("Local PDF processing: " + issue);
  }
}
function run(
  command: string,
  args: string[],
  input: Buffer | string,
  timeout: number,
  maxBuffer = 3_000_000,
) {
  return new Promise<string>((resolve, reject) => {
    const child = execFile(
      command,
      args,
      { cwd: root, timeout, maxBuffer, windowsHide: true },
      (error, stdout) =>
        error
          ? reject(new PdfReadError(error.killed ? "timeout" : "unreadable"))
          : resolve(stdout),
    );
    child.stdin?.on("error", () => {});
    child.stdin?.end(input);
  });
}
export async function readLocalOcr(data: Buffer, pages: number[]) {
  if (process.platform !== "win32")
    throw new PdfReadError("renderer_unavailable");
  await fs.mkdir(cacheRoot, { recursive: true });
  const directory = await fs.mkdtemp(path.join(cacheRoot, "ocr-"));
  try {
    const file = path.join(directory, "input.pdf");
    await fs.writeFile(file, data);
    const script = await fs.readFile(
      path.join(root, "scripts/windows-pdf-render.ps1"),
      "utf8",
    );
    const stdout = await run(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      JSON.stringify({ path: file, pages }),
      30000,
      24_000_000,
    );
    const images = z
      .array(
        z.object({
          page: z.number().int(),
          image: z.string().min(1).max(11_000_000),
        }),
      )
      .max(2)
      .parse(JSON.parse(stdout));
    if (
      images.length !== pages.length ||
      images.some((p, i) => p.page !== pages[i])
    )
      throw new PdfReadError("unreadable");
    const result: DocumentPage[] = [];
    for (const image of images) {
      let response: Response;
      try {
        response = await fetch("http://127.0.0.1:11434/api/generate", {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(120000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "glm-ocr:latest",
            prompt: "Text Recognition:",
            images: [image.image],
            stream: false,
            keep_alive: 0,
            options: {
              temperature: 0,
              num_ctx: 8192,
              num_predict: 6000,
              repeat_penalty: 1.1,
            },
          }),
        });
      } catch {
        throw new PdfReadError("ocr_unavailable");
      }
      if (!response.ok) throw new PdfReadError("ocr_unavailable");
      const output = z
        .object({
          done: z.literal(true),
          done_reason: z.string().optional(),
          response: z.string().max(500000),
        })
        .parse(await response.json());
      if (output.done_reason === "length")
        throw new PdfReadError("ocr_incomplete");
      result.push({ page: image.page, text: output.response, ocr: true });
    }
    return result;
  } finally {
    // Only this call's generated directory is removed; original PDFs are never altered.
    if (!directory.startsWith(cacheRoot + path.sep))
      throw new Error("Unexpected OCR directory");
    await fs.rm(directory, { recursive: true, force: true });
  }
}

export async function readLocalPdf(data: Buffer): Promise<DocumentPage[]> {
  if (data.length > 50_000_000) throw new PdfReadError("limits");
  await fs.mkdir(cacheRoot, { recursive: true });
  const key = createHash("sha256")
    .update("gobbler-pdf-v2:")
    .update(data)
    .digest("hex");
  const file = path.join(cacheRoot, key + ".json");
  let cached: z.infer<typeof cacheInput> | undefined;
  try {
    if ((await fs.stat(file)).size <= 6_000_000)
      cached = cacheInput.parse(JSON.parse(await fs.readFile(file, "utf8")));
  } catch {
    /* Rebuild absent or damaged extraction cache from the original PDF. */
  }
  if (!cached || cached.pages.length < cached.total) {
    const start = (cached?.pages.length ?? 0) + 1;
    const stdout = await run(
      process.execPath,
      [
        "--max-old-space-size=256",
        "--import",
        "tsx",
        path.join(root, "scripts/material-pdf.ts"),
        String(start),
      ],
      data,
      30000,
    );
    const batch = batchInput.parse(JSON.parse(stdout));
    if (
      batch.pages.some((p, i) => p.page !== start + i) ||
      start + batch.pages.length - 1 > batch.total ||
      (cached && cached.total !== batch.total)
    )
      throw new PdfReadError("unreadable");
    const empty = batch.pages.filter((p) => p.ocr_needed).map((p) => p.page!);
    if (empty.length > 2)
      batch.pages = batch.pages.filter((p) => p.page! < empty[2]);
    const blank = empty.slice(0, 2);
    if (blank.length) {
      const ocr = await readLocalOcr(data, blank);
      batch.pages = batch.pages.map(
        (p) => ocr.find((o) => o.page === p.page) ?? p,
      );
    }
    cached = {
      total: batch.total,
      pages: [
        ...(cached?.pages ?? []),
        ...batch.pages.map(({ ocr_needed, ...p }) => p),
      ],
    };
    if (!cacheInput.safeParse(cached).success) throw new PdfReadError("limits");
    await fs.writeFile(file + ".tmp", JSON.stringify(cached));
    await fs.rename(file + ".tmp", file);
    // Derived cache is disposable and bounded; backups retain imported text and page evidence.
    const entries = await Promise.all(
      (await fs.readdir(cacheRoot))
        .filter((n) => /^[a-f0-9]{64}\.json$/.test(n))
        .map(async (n) => ({
          name: n,
          mtime: (await fs.stat(path.join(cacheRoot, n))).mtimeMs,
        })),
    );
    for (const entry of entries.sort((a, b) => b.mtime - a.mtime).slice(64))
      await fs.unlink(path.join(cacheRoot, entry.name));
  }
  if (cached.pages.length < cached.total)
    throw new PdfPendingError(cached.pages.length, cached.total);
  if (!cached.pages.some((p) => p.text.trim()))
    throw new PdfReadError("unreadable");
  return cached.pages;
}

export function splitMaterialPages(pages: DocumentPage[]) {
  const parts: DocumentPage[][] = [];
  let part: DocumentPage[] = [],
    length = 0;
  for (const page of pages) {
    if (page.text.length > 500000) throw new PdfReadError("limits");
    if (
      part.length &&
      (part.length >= 200 || length + page.text.length > 500000)
    ) {
      if (part.some((p) => p.text.trim())) parts.push(part);
      part = [];
      length = 0;
    }
    part.push(page);
    length += page.text.length;
  }
  if (part.some((p) => p.text.trim())) parts.push(part);
  if (!parts.length) throw new PdfReadError("unreadable");
  return parts;
}
