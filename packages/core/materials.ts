import { z } from "zod";
import { itemInput } from "./index";

export const materialInput = z
  .object({
    course_id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(250),
    source_url: itemInput.shape.source_url.refine((v) => v.length <= 4000),
    pages: z
      .array(
        z.object({
          page: z.number().int().min(1).max(200).nullable(),
          text: z.string().max(500000),
        }),
      )
      .min(1)
      .max(200),
  })
  .refine(
    (v) =>
      v.pages.some((p) => p.text.trim()) &&
      v.pages.reduce((n, p) => n + p.text.length, 0) <= 500000,
    "Supply readable text under 500,000 characters",
  );
export type Material = z.infer<typeof materialInput> & {
  id: string;
  created_at: string;
};
export type MaterialSummary = Omit<Material, "pages">;
export const availableMaterial =
  "(managed=0 OR EXISTS (SELECT 1 FROM material_files WHERE material_id=materials.id AND material_files.user_id=materials.user_id AND state='available'))";
export type SyncedMaterialSummary = MaterialSummary & {
  synced?: number;
  available?: number;
};
export type MaterialCandidate = import("./deadlines").DeadlineCandidate & {
  course_id: string;
  source_url: string;
  document_name: string;
  document_hash: string;
  document_key: string;
};
export type Passage = {
  id: string;
  material_id: string;
  name: string;
  source_url: string;
  page: number | null;
  text: string;
};
export const answerInput = z.object({
  course_id: z.string().min(1).max(100),
  question: z.string().trim().min(1).max(2000),
  language: z.enum(["en", "de", "vi"]).default("en"),
});
export type CourseAnswer = {
  answer: string;
  supported: boolean;
  citations: (Passage & { quote: string })[];
  calendar?: import("./schedule").CalendarAnswer;
};

export function selectPassages(
  materials: Material[],
  question: string,
): Passage[] {
  const words = (v: string) =>
    v
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  const terms = [...new Set(words(question))];
  const passages: (Passage & { score: number })[] = [];
  for (const material of materials)
    for (const page of material.pages)
      for (let start = 0; start < page.text.length; start += 1200) {
        const text = page.text.slice(start, start + 1600);
        if (!text.trim()) continue;
        const found = new Set(words(material.name + " " + text));
        passages.push({
          id: "",
          material_id: material.id,
          name: material.name,
          source_url: material.source_url,
          page: page.page,
          text,
          score: terms.filter((t) => found.has(t)).length,
        });
      }
  // shortcut: lexical excerpts, not semantic retrieval; add embeddings when representative course questions need it.
  return passages
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ score, ...p }, i) => ({ ...p, id: String(i + 1) }));
}
