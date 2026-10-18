import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createRequire } from "node:module";
import path from "node:path";
import { materialInput } from "../packages/core/materials";

const chunks: Buffer[] = [];
let bytes = 0;
for await (const chunk of process.stdin) {
  bytes += chunk.length;
  if (bytes > 10_000_000) throw new Error("PDF exceeds 10 MB");
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
  if (pdf.numPages > 200) throw new Error("PDF exceeds 200 pages");
  const pages = [];
  let length = 0;
  for (let page = 1; page <= pdf.numPages; page++) {
    const content = await (await pdf.getPage(page)).getTextContent();
    const text = content.items
      .map((item) =>
        "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
      )
      .join("");
    length += text.length;
    if (length > 500000) throw new Error("PDF exceeds text limit");
    pages.push({ page, text });
  }
  materialInput.parse({
    course_id: "local",
    name: "PDF",
    source_url: "",
    pages,
  });
  process.stdout.write(JSON.stringify(pages));
} finally {
  await task.destroy();
}
