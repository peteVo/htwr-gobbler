import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { DocumentPage } from "../../../packages/core/deadlines";
GlobalWorkerOptions.workerSrc = workerUrl;
export async function readPdf(file: File): Promise<DocumentPage[]> {
  if (file.size > 10_000_000) throw new Error("Choose a PDF under 10 MB.");
  const task = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    stopAtErrors: true,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 20)
      throw new Error(
        "Choose a PDF with at most 20 pages. Nothing has been analyzed.",
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
      if (length > 20000)
        throw new Error(
          "This PDF contains over 20,000 characters. Paste a relevant excerpt instead.",
        );
      pages.push({ page, text });
    }
    if (pages.every((p) => !p.text.trim()))
      throw new Error(
        "No readable text found. Scanned PDFs need OCR, which is not included. This document has not been checked.",
      );
    return pages;
  } finally {
    await task.destroy();
  }
}
