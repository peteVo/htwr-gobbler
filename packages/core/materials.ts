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
          page: z.number().int().min(1).max(2000).nullable(),
          text: z.string().max(500000),
          ocr: z.boolean().optional(),
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
  "(managed=0 OR EXISTS (SELECT 1 FROM material_files WHERE (material_id=materials.id OR EXISTS (SELECT 1 FROM json_each(material_files.material_ids) WHERE value=materials.id)) AND material_files.user_id=materials.user_id AND state='available'))";
export type SyncedMaterialSummary = MaterialSummary & {
  synced?: number;
  available?: number;
  ocr?: number;
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
  ocr?: boolean;
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
      .match(/\p{L}{3,}|\p{N}{3,}/gu) ?? [];
  const common = new Set(
    "the and for are with this that what when where which how does explain please about from your can you und der die das ein eine einer einem einen ist sind was wie warum bitte mit von den des dem bai cua cac cho mot nhung the nao tai sao gi hay toi".split(
      " ",
    ),
  );
  const terms = [...new Set(words(question))].filter((t) => !common.has(t));
  const passages: (Passage & { found: Set<string>; title: Set<string> })[] = [];
  for (const material of materials)
    for (const page of material.pages)
      for (let start = 0; start < page.text.length; start += 1200) {
        const text = page.text.slice(start, start + 1600);
        if (!text.trim()) continue;
        passages.push({
          id: "",
          material_id: material.id,
          name: material.name,
          source_url: material.source_url,
          page: page.page,
          ...(page.ocr ? { ocr: true } : {}),
          text,
          found: new Set(words(text)),
          title: new Set(words(material.name)),
        });
      }
  const weights = new Map(
    terms.map((term) => [
      term,
      Math.log(
        1 +
          passages.length /
            (1 + passages.filter((p) => p.found.has(term)).length),
      ),
    ]),
  );
  // shortcut: lexical ranking across EN/DE/VI, not cross-language semantic search; add embeddings when representative questions need it.
  return passages
    .map((p) => ({
      ...p,
      score: terms.reduce(
        (n, t) =>
          n +
          (weights.get(t) ?? 0) *
            ((p.found.has(t) ? 2 : 0) + (p.title.has(t) ? 1 : 0)),
        0,
      ),
    }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ score, found, title, ...p }, i) => ({ ...p, id: String(i + 1) }));
}
