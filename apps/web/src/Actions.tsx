/* Hallmark · component critique: P4 H4 E4 S5 R5 V4 · existing workbench tokens */
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import type { Action, Course } from "../../../packages/core/index";

export function Actions({
  actions,
  courses,
  busy,
  save,
  initialAction,
}: {
  actions: Action[];
  courses: Course[];
  busy: boolean;
  initialAction?: Action;
  save: (
    method: "POST" | "PUT" | "DELETE",
    id: string,
    value?: unknown,
  ) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Action | "new" | null>(
    initialAction ?? null,
  );
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function mutate(
    method: "POST" | "PUT" | "DELETE",
    id: string,
    value?: unknown,
  ) {
    setError("");
    setNotice("");
    try {
      await save(method, id, value);
      setEditing(null);
      setNotice(
        method === "DELETE"
          ? "Action removed."
          : "Action saved. Completion here does not register or submit anything to the university.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const row = (action: Action) => (
    <div
      className={`task-row ${action.status === "done" ? "completed" : ""}`}
      key={action.id}
    >
      <button
        className="check-button"
        disabled={busy}
        aria-label={`${action.status === "done" ? "Reopen" : "Complete"} ${action.title}`}
        onClick={() =>
          void mutate("PUT", action.id, {
            ...action,
            status: action.status === "done" ? "open" : "done",
          })
        }
      >
        {action.status === "done" && <Check size={12} />}
      </button>
      <div className="task-content">
        <button
          className="task-content"
          disabled={busy}
          onClick={() => {
            setEditing(action);
            setError("");
            setNotice("");
          }}
        >
          <strong>{action.title}</strong>
        </button>
        <span className="course-label">
          {courses.find((c) => c.id === action.course_id)?.name ||
            "No module assigned"}{" "}
          · No date assigned
        </span>
        {action.notes && <p className="small muted">{action.notes}</p>}
        {action.source_url && (
          <a
            href={action.source_url}
            target="_blank"
            rel="noreferrer"
            className="small"
          >
            Open original instructions
          </a>
        )}
      </div>
    </div>
  );
  const value = editing && editing !== "new" ? editing : null;
  return (
    <section aria-label="Next actions" className="deadline-section">
      <div className="section-heading">
        <h2>Next actions</h2>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            setEditing("new");
            setError("");
            setNotice("");
          }}
        >
          <Plus size={14} />
          Add action
        </button>
      </div>
      <p className="small muted">
        Setup, registrations and course reviews without a known deadline. Dated
        obligations stay in Tasks. This checklist does not automatically check
        Moodle materials.
      </p>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="small muted">
          {notice}
        </p>
      )}
      {editing && (
        <form
          key={value?.id || "new"}
          onSubmit={(e) => {
            e.preventDefault();
            const fields = new FormData(e.currentTarget);
            void mutate(value ? "PUT" : "POST", value?.id || "", {
              title: fields.get("title"),
              course_id: fields.get("course_id") || null,
              notes: fields.get("notes"),
              source_url: fields.get("source_url"),
              status: value?.status || "open",
            });
          }}
        >
          <label>
            Action title
            <input
              name="title"
              autoFocus={Boolean(initialAction)}
              defaultValue={value?.title || ""}
              required
              maxLength={250}
            />
          </label>
          <label>
            Action module
            <select name="course_id" defaultValue={value?.course_id || ""}>
              <option value="">No module assigned</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Instructions and coverage notes
            <textarea
              name="notes"
              defaultValue={value?.notes || ""}
              maxLength={3000}
              rows={3}
            />
          </label>
          <label>
            Original instructions URL
            <input
              type="url"
              name="source_url"
              defaultValue={value?.source_url || ""}
            />
          </label>
          <div className="modal-actions">
            <button disabled={busy} className="primary">
              {busy ? "Saving…" : "Save action"}
            </button>
            <button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
            {value && (
              <button
                className="text-button"
                type="button"
                disabled={busy}
                onClick={() => void mutate("DELETE", value.id)}
              >
                Delete action
              </button>
            )}
          </div>
        </form>
      )}
      {actions.filter((a) => a.status === "open").map(row)}
      {!actions.some((a) => a.status === "open") && (
        <p className="small muted">
          No open next actions recorded. This does not establish complete course
          coverage.
        </p>
      )}
      {actions.some((a) => a.status === "done") && (
        <details>
          <summary>
            Completed actions (
            {actions.filter((a) => a.status === "done").length})
          </summary>
          {actions.filter((a) => a.status === "done").map(row)}
        </details>
      )}
    </section>
  );
}
