import type { Item } from "./index";

export function scheduleKind(question: string) {
  // shortcut: explicit next-event timing phrases; broader calendar reasoning needs its own source checks.
  const text = question.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (
    !/\b(next|nachst\w*|tiep theo)\b/.test(text) ||
    !/\b(when|wann|bao gio|khi nao)\b/.test(text)
  )
    return null;
  const kinds = (
    [
      ["lecture", /\b(lectures?|vorlesung\w*|bai giang|buoi hoc)\b/],
      ["tutorial", /\b(tutorials?|ubung\w*|buoi bai tap)\b/],
      ["exam", /\b(exams?|klausur\w*|prufung\w*|ky thi)\b/],
      [
        "assignment",
        /\b(deadlines?|assignments?|abgabe\w*|frist\w*|han nop)\b/,
      ],
    ] as const
  ).filter(([, pattern]) => pattern.test(text));
  return kinds.length === 1 ? kinds[0][0] : null;
}
export type CalendarAnswer = {
  kind: NonNullable<ReturnType<typeof scheduleKind>>;
  item: Pick<
    Item,
    | "id"
    | "title"
    | "starts_at"
    | "ends_at"
    | "all_day"
    | "verification"
    | "source_url"
  > | null;
  last_checked: string | null;
  source_current: boolean;
};
