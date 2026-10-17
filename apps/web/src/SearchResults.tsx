import { useText } from "./text";
/* Hallmark · component critique: P4 H4 E4 S5 R5 V4 · existing workbench tokens */
import type { Snapshot } from "../../../packages/core/index";
import {
  searchWorkspace,
  type SearchResult,
} from "../../../packages/core/search";

export function SearchResults({
  data,
  query,
  stamp,
  open,
}: {
  data: Snapshot;
  query: string;
  stamp: (value: string, options?: Intl.DateTimeFormatOptions) => string;
  open: (result: SearchResult) => void;
}) {
  const tx = useText();
  const results = searchWorkspace(data, query);
  const groups = [
    ["item", tx("Tasks, events & saved materials")],
    ["action", tx("Next actions")],
    ["course", tx("Courses")],
    ["source", tx("Sources")],
  ] as const;
  return (
    <div className="workspace-search">
      <p className="small muted" role="status">
        {tx(
          results.length === 1
            ? "{0} matching record."
            : "{0} matching records.",
          results.length,
        )}{" "}
        {tx(
          "Includes completed and dismissed records, across all courses and types.",
        )}
      </p>
      <p className="small muted">
        {tx(
          "Search covers stored records and extracted date evidence. It does not search full PDF contents or check Moodle live.",
        )}
      </p>
      {!results.length && (
        <div className="empty">
          {tx(
            "No matching records. Try a title, module name or code, or words from saved notes.",
          )}
        </div>
      )}
      {groups.map(([type, label]) => {
        const matches = results.filter((r) => r.type === type);
        return (
          matches.length > 0 && (
            <section key={type} aria-label={label}>
              <div className="section-heading">
                <h2>{label}</h2>
                <span className="tiny-label">{matches.length}</span>
              </div>
              {matches.map((result) => {
                const r = result.record;
                const title = "title" in r ? r.title : r.name;
                const course =
                  "course_id" in r
                    ? data.courses.find((c) => c.id === r.course_id)
                    : null;
                const source =
                  result.type === "source"
                    ? result.record
                    : result.type === "item"
                      ? data.sources.find(
                          (s) => s.id === result.record.source_id,
                        )
                      : null;
                const outdated = Boolean(
                  source &&
                    (source.status !== "connected" ||
                      !source.last_success ||
                      Date.now() - Date.parse(source.last_success) >= 3600000),
                );
                const detail =
                  result.type === "item"
                    ? result.record.description || result.record.evidence
                    : result.type === "action"
                      ? result.record.notes
                      : "";
                return (
                  <button
                    key={r.id}
                    className="search-result"
                    onClick={() => open(result)}
                  >
                    <strong>{title}</strong>
                    <span className="course-label">
                      {course?.name && `${course.name} · `}
                      {result.type === "item"
                        ? `${tx(result.record.kind)} · ${tx(result.record.status)} · ${stamp(result.record.starts_at, result.record.all_day ? { dateStyle: "medium" } : undefined)}${result.record.all_day ? tx(" · date only") : ""} · ${outdated ? tx("Source outdated") : result.record.verification === "needs_review" ? tx("Needs review") : tx("Confirmed")}`
                        : result.type === "action"
                          ? tx(
                              "{0} · No date assigned",
                              tx(result.record.status),
                            )
                          : result.type === "course"
                            ? result.record.code || tx("No module code")
                            : `${tx(result.record.kind)} · ${outdated && result.record.status === "connected" ? tx("Check outdated") : tx(result.record.status)} · ${result.record.last_success ? tx("Last success {0}", stamp(result.record.last_success)) : tx("Never checked")}`}
                    </span>
                    {detail && <span className="search-excerpt">{detail}</span>}
                  </button>
                );
              })}
            </section>
          )
        );
      })}
    </div>
  );
}
