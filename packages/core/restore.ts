import { z } from "zod";
import { actionInput, courseInput, itemInput } from "./index";

const id = z.string().min(1).max(100);
export type RestoreResult = {
  added: Record<"items" | "courses" | "actions" | "sources", number>;
  skipped: number;
};
export const restoreInput = z
  .object({
    courses: z.array(courseInput.extend({ id })).max(200),
    sources: z
      .array(z.object({ id, name: z.string().trim().min(1).max(150) }))
      .max(50)
      .default([]),
    items: z
      .array(
        itemInput.safeExtend({
          id,
          source_id: id.nullable().default(null),
          external_id: z.string().max(1000).nullable().optional(),
        }),
      )
      .max(2000),
    actions: z.array(actionInput.extend({ id })).max(500).default([]),
  })
  .superRefine((data, ctx) => {
    for (const field of ["courses", "sources", "items", "actions"] as const)
      if (new Set(data[field].map((v) => v.id)).size !== data[field].length)
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Duplicate record identifiers",
        });
    for (const value of [...data.items, ...data.actions])
      if (
        value.course_id &&
        !data.courses.some((c) => c.id === value.course_id)
      )
        ctx.addIssue({ code: "custom", message: "Missing course reference" });
    for (const item of data.items)
      if (item.source_id && !data.sources.some((s) => s.id === item.source_id))
        ctx.addIssue({ code: "custom", message: "Missing source reference" });
  });
