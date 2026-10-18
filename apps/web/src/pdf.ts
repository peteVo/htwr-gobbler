import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { DocumentPage } from "../../../packages/core/deadlines";
GlobalWorkerOptions.workerSrc = workerUrl;
export async function readPdf(
  file: File,
  limits = { pages: 20, characters: 20000 },
): Promise<DocumentPage[]> {
  if (file.size > 10_000_000) throw new Error("Choose a PDF under 10 MB.");
  const task = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    stopAtErrors: true,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > limits.pages)
      throw new Error(
        limits.pages === 20
          ? "Choose a PDF with at most 20 pages. Nothing has been analyzed."
          : "Choose a PDF with at most 200 pages. Nothing has been analyzed.",
      );
    const pages: DocumentPage[] = [];
    let length = 0;
    for (let page = 1; page <= pdf.numPages; page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      const text = content.items
        .map((item) =>
          "str" in item
            ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
            : "",
        )
        .join("");
      length += text.length;
      if (length > limits.characters)
        throw new Error(
          limits.characters === 20000
            ? "This PDF contains over 20,000 characters. Paste a relevant excerpt instead."
            : "This PDF contains over 500,000 characters. Choose a smaller document.",
        );
      pages.push({ page, text });
    }
    if (pages.every((p) => !p.text.trim()))
      throw new Error(
        "No readable text found in this upload. Automatic OCR runs through connected local folders. This document has not been checked.",
      );
    return pages;
  } finally {
    await task.destroy();
  }
}
