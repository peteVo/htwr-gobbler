/* Hallmark · component critique: P5 H5 E4 S5 R5 V4 · existing Garden workbench tokens */
import { useEffect, useState } from "react";
import {
  berlinDay,
  type Course,
  type Item,
} from "../../../packages/core/index";
import type { MaterialCandidate } from "../../../packages/core/materials";
import { useLocale, useText } from "./text";

export function MaterialDates({
  courses,
  items,
  course,
  request,
  review,
  disabled = false,
}: {
  courses: Course[];
  items: Item[];
  course?: string;
  request: <T>(path: string) => Promise<T>;
  review: (candidate: MaterialCandidate & { target_id?: string }) => void;
  disabled?: boolean;
}) {
  const tx = useText(),
    locale = useLocale();
  const [dates, setDates] = useState<MaterialCandidate[]>([]);
  const [error, setError] = useState(false);
  const [targets, setTargets] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (document.hidden) return;
      try {
        const dates = await request<MaterialCandidate[]>(
          "/materials/candidates",
        );
        if (!Array.isArray(dates)) throw new Error("Invalid date suggestions");
        if (active) {
          setDates(dates);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };
    void load();
    const timer = setInterval(load, 60000);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [request, items]);
  const selected = dates.filter(
    (d) => course === undefined || d.course_id === course,
  );
  if (error)
    return (
      <p role="alert" className="warning-text">
        {tx(
          "Could not refresh suggested dates. Return to this window to retry; saved tasks are unchanged.",
        )}
      </p>
    );
  if (!selected.length) return null;
  const today = berlinDay(new Date());
  selected.sort(
    (a, b) =>
      Number(berlinDay(a.deadline) < today) -
        Number(berlinDay(b.deadline) < today) ||
      a.deadline.localeCompare(b.deadline),
  );
  return (
    <section aria-label={tx("Dates to review")}>
      <details className="material-upload" open={course !== undefined}>
        <summary>{tx("Dates to review ({0})", selected.length)}</summary>
        <p className="small muted">
          {tx(
            "These PDF dates are suggestions. Check the wording and existing tasks before saving; they are not confirmed deadlines.",
          )}
        </p>
        {selected.map((d) => {
          const key = JSON.stringify([d.course_id, d.document_key]);
          const matches = items.filter(
            (i) =>
              i.course_id === d.course_id &&
              i.kind === "assignment" &&
              berlinDay(i.starts_at) === berlinDay(d.deadline),
          );
          return (
            <article key={key} className="assistant-answer">
              <strong>
                {courses.find((c) => c.id === d.course_id)?.name} ·{" "}
                {d.document_name}
              </strong>
              <p>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  ...(d.all_day ? {} : { timeStyle: "short" as const }),
                  timeZone: "Europe/Berlin",
                }).format(new Date(d.deadline))}
                {" · Europe/Berlin"}
                {d.page ? tx(" · Page {0}", d.page) : ""}
              </p>
              {d.all_day && (
                <p className="warning-text">
                  {tx("Date only · no exact time is recorded.")}
                </p>
              )}
              {berlinDay(d.deadline) < today && (
                <p className="warning-text">
                  {tx("Past date · check the semester before saving.")}
                </p>
              )}
              <blockquote>{d.evidence}</blockquote>
              {d.ocr && (
                <p className="warning-text">
                  {tx(
                    "OCR-derived date · compare the original page before saving.",
                  )}
                </p>
              )}
              {matches.length > 0 && (
                <label>
                  {tx("Tasks already saved for this module on this day")}
                  <select
                    disabled={disabled}
                    value={targets[key] || ""}
                    onChange={(e) =>
                      setTargets({ ...targets, [key]: e.target.value })
                    }
                  >
                    <option value="">
                      {tx(
                        "Create a separate task after checking for duplicates",
                      )}
                    </option>
                    {matches.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.title} · {tx(i.status)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                className="secondary"
                disabled={disabled}
                onClick={() =>
                  review({
                    ...d,
                    target_id: matches.some((i) => i.id === targets[key])
                      ? targets[key]
                      : undefined,
                  })
                }
              >
                {tx("Review date")}
              </button>
            </article>
          );
        })}
      </details>
    </section>
  );
}
