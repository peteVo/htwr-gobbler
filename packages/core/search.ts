import type { Action, Course, Item, Snapshot, Source } from "./index";

export type SearchResult =
  | { type: "item"; record: Item }
  | { type: "action"; record: Action }
  | { type: "course"; record: Course }
  | { type: "source"; record: Source };

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll("ß", "ss")
    .replaceAll("đ", "d");

export function searchWorkspace(data: Snapshot, query: string): SearchResult[] {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const module = (id: string | null) => {
    const course = data.courses.find((c) => c.id === id);
    return course ? `${course.name} ${course.code}` : "";
  };
  const candidates: SearchResult[] = [
    ...data.items.map((record) => ({ type: "item" as const, record })),
    ...(data.actions ?? []).map((record) => ({
      type: "action" as const,
      record,
    })),
    ...data.courses.map((record) => ({ type: "course" as const, record })),
    ...data.sources.map((record) => ({ type: "source" as const, record })),
  ];
  return candidates
    .map((result) => {
      const record = result.record;
      const title = "title" in record ? record.title : record.name;
      let text = title;
      switch (result.type) {
        case "item": {
          const i = result.record;
          text += ` ${i.description} ${i.evidence} ${i.document_name ?? ""} ${i.kind} ${i.status} ${module(i.course_id)}`;
          break;
        }
        case "action": {
          const a = result.record;
          text += ` ${a.notes} ${a.status} ${module(a.course_id)}`;
          break;
        }
        case "course":
          text += ` ${result.record.code}`;
          break;
        case "source":
          text += ` ${result.record.kind} ${result.record.status}`;
          break;
      }
      return { result, text: normalize(text), title: normalize(title) };
    })
    .filter(({ text }) => terms.every((term) => text.includes(term)))
    .sort(
      (a, b) =>
        Number(terms.every((term) => b.title.includes(term))) -
        Number(terms.every((term) => a.title.includes(term))),
    )
    .map(({ result }) => result);
}
