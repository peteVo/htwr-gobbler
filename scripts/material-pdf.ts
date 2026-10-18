import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createRequire } from "node:module";
import path from "node:path";

const chunks: Buffer[] = [];
let bytes = 0;
for await (const chunk of process.stdin) {
  bytes += chunk.length;
  if (bytes > 50_000_000) throw new Error("PDF exceeds 50 MB");
  chunks.push(chunk);
}
const task = getDocument({
  data: new Uint8Array(Buffer.concat(chunks)),
  stopAtErrors: true,
  useSystemFonts: false,
  disableFontFace: true,
  verbosity: 0,
  standardFontDataUrl:
    path
      .join(
        path.dirname(
          createRequire(import.meta.url).resolve("pdfjs-dist/package.json"),
        ),
        "standard_fonts",
      )
      .replaceAll("\\", "/") + "/",
});
try {
  const pdf = await task.promise;
  if (pdf.numPages > 2000) throw new Error("PDF exceeds 2000 pages");
  const start = Number(process.argv[2] ?? 1);
  if (!Number.isInteger(start) || start < 1 || start > pdf.numPages)
    throw new Error("Invalid PDF batch");
  const pages = [];
  let length = 0;
  for (let page = start; page <= Math.min(start + 9, pdf.numPages); page++) {
    const pdfPage = await pdf.getPage(page);
    const content = await pdfPage.getTextContent();
    const text = content.items
      .map((item) =>
        "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
      )
      .join("");
    length += text.length;
    if (length > 500000) throw new Error("PDF exceeds text limit");
    const ocr_needed =
      !text.trim() &&
      (await pdfPage.getOperatorList()).fnArray.some((fn) =>
        [
          OPS.paintImageXObject,
          OPS.paintInlineImageXObject,
          OPS.paintImageMaskXObject,
        ].includes(fn),
      );
    pages.push({ page, text, ...(ocr_needed ? { ocr_needed: true } : {}) });
  }
  process.stdout.write(JSON.stringify({ total: pdf.numPages, pages }));
} finally {
  await task.destroy();
}
