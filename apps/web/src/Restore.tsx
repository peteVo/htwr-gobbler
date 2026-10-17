/* Hallmark · component critique: P4 H4 E4 S5 R5 V4 · existing settings controls */
import { useRef, useState } from "react";
import type { z } from "zod";
import {
  restoreInput,
  type RestoreResult,
} from "../../../packages/core/restore";
import { useText } from "./text";

export function Restore({
  busy,
  restore,
}: {
  busy: boolean;
  restore: (data: z.infer<typeof restoreInput>) => Promise<RestoreResult>;
}) {
  const tx = useText();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<z.infer<typeof restoreInput> | null>(
      null,
    ),
    [error, setError] = useState(""),
    [result, setResult] = useState<RestoreResult | null>(null);
  return (
    <section aria-label={tx("Restore records")}>
      <h3>{tx("Restore missing records")}</h3>
      <p className="small muted">
        {tx(
          "Choose a Gobbler JSON export. Existing records are kept unchanged. Missing dates return as needing review; disconnected calendars must be reconnected. Passwords, recovery keys and feed credentials are not restored.",
        )}
      </p>
      <label>
        {tx("Gobbler export file")}
        <input
          type="file"
          ref={fileInput}
          accept=".json,application/json"
          disabled={busy}
          onChange={async (e) => {
            setPreview(null);
            setError("");
            setResult(null);
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 2_000_000)
                throw new Error("Choose a file under 2 MB.");
              const text = await file.text();
              if (fileInput.current?.files?.[0] !== file) return;
              const parsed = restoreInput.safeParse(JSON.parse(text));
              if (!parsed.success)
                throw new Error(
                  "This is not a supported Gobbler export. No records were changed.",
                );
              setPreview(parsed.data);
            } catch (e) {
              setError(
                e instanceof SyntaxError
                  ? "This is not a supported Gobbler export. No records were changed."
                  : (e as Error).message,
              );
            }
          }}
        />
      </label>
      {preview && (
        <div>
          <p role="status">
            {tx(
              "Preview: {0} courses, {1} items, {2} actions and {3} calendar sources.",
              preview.courses.length,
              preview.items.length,
              preview.actions.length,
              preview.sources.length,
            )}
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setError("");
              setResult(null);
              try {
                const result = await restore(preview);
                setPreview(null);
                if (fileInput.current) fileInput.current.value = "";
                setResult(result);
              } catch {
                setError(
                  "Restore failed. Your existing records were retained. Try again after checking the file and connection.",
                );
              }
            }}
          >
            {busy ? tx("Saving…") : tx("Restore missing records")}
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              setPreview(null);
              if (fileInput.current) fileInput.current.value = "";
            }}
          >
            {tx("Cancel")}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="alert error">
          {tx(error)}
        </p>
      )}
      {result && (
        <p role="status">
          {tx(
            "Restored {0} courses, {1} items, {2} actions and {3} sources. Skipped {4} existing records.",
            result.added.courses,
            result.added.items,
            result.added.actions,
            result.added.sources,
            result.skipped,
          )}
        </p>
      )}
    </section>
  );
}
