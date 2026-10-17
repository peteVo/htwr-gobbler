/* Hallmark · component critique: P5 H4 E4 S5 R5 V4 · existing Garden workbench tokens */
import { useEffect, useState } from "react";
import type { Course } from "../../../packages/core/index";
import type { DocumentPage } from "../../../packages/core/deadlines";
import type {
  CourseAnswer,
  MaterialSummary,
} from "../../../packages/core/materials";
import { useText } from "./text";

export function Assistant({
  courses,
  signedIn,
  language,
  request,
}: {
  courses: Course[];
  signedIn: boolean;
  language: string;
  request: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
}) {
  const tx = useText();
  const [course, setCourse] = useState(""),
    [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [ready, setReady] = useState(false),
    [checking, setChecking] = useState(false),
    [busy, setBusy] = useState("");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [question, setQuestion] = useState("");
  const [name, setName] = useState(""),
    [url, setUrl] = useState(""),
    [text, setText] = useState(""),
    [pages, setPages] = useState<DocumentPage[]>([]);
  const [answer, setAnswer] = useState<CourseAnswer | null>(null);
  async function refresh() {
    setMaterials(await request<MaterialSummary[]>("/materials"));
  }
  async function check() {
    setChecking(true);
    try {
      setReady((await request<{ ready: boolean }>("/assistant/status")).ready);
    } catch {
      setReady(false);
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    request<MaterialSummary[]>("/materials")
      .then((v) => {
        if (active) setMaterials(v);
      })
      .catch(() => {
        if (active) setError("Could not load course materials. Try again.");
      });
    void check();
    return () => {
      active = false;
    };
  }, [signedIn]);
  if (!signedIn)
    return (
      <p className="coverage-note">
        {tx("Sign in to save course material and use the local assistant.")}
      </p>
    );
  const selected = materials.filter((m) => m.course_id === course);
  return (
    <div className="assistant-layout">
      <section>
        <h2>{tx("Ask your course material")}</h2>
        <p className="muted">
          {tx(
            "Answers use selected excerpts from material you saved for this module. Check the quotations; the AI can still make mistakes. Moodle is not read automatically.",
          )}
        </p>
        <label>
          {tx("Module")}
          <select
            value={course}
            disabled={!!busy}
            onChange={(e) => {
              setCourse(e.target.value);
              setText("");
              setPages([]);
              setName("");
              setUrl("");
              setAnswer(null);
              setError("");
              setNotice("");
            }}
          >
            <option value="">{tx("Choose a module")}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <p role="status" className="small muted">
          {checking
            ? tx("Checking local AI…")
            : ready
              ? tx("Local AI is ready. Course text stays on this laptop.")
              : tx(
                  "Local AI is not ready. Start Ollama and install the configured model, then retry.",
                )}
        </p>
        <button
          className="text-button"
          disabled={checking || !!busy}
          onClick={() => void check()}
        >
          {tx("Check local AI")}
        </button>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy("asking");
            setAnswer(null);
            setError("");
            setNotice("");
            try {
              setAnswer(
                await request<CourseAnswer>("/assistant/ask", "POST", {
                  course_id: course,
                  question,
                  language,
                }),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy("");
            }
          }}
        >
          <label>
            {tx("Your question")}
            <textarea
              rows={4}
              required
              maxLength={2000}
              disabled={!!busy}
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setAnswer(null);
              }}
            />
          </label>
          <button
            className="primary"
            disabled={!!busy || !course || !selected.length || !ready}
          >
            {busy === "asking"
              ? tx("Reading your material…")
              : tx("Ask local AI")}
          </button>
        </form>
        {busy === "asking" && (
          <p role="status" className="small muted">
            {tx("The first answer may take a minute while the model loads.")}
          </p>
        )}
        {error && (
          <p role="alert" className="alert error">
            {tx(error)}
          </p>
        )}
        {notice && (
          <p role="status" className="small muted">
            {tx(notice)}
          </p>
        )}
        {answer && (
          <section
            aria-label={tx("Course answer")}
            className="assistant-answer"
            aria-live="polite"
          >
            <h3>{tx("Answer")}</h3>
            <p className="answer-text">
              {answer.supported
                ? answer.answer
                : tx(
                    "The supplied excerpts do not establish an answer. Add relevant material or ask a more specific question.",
                  )}
            </p>
            {answer.citations.map((c, i) => (
              <blockquote key={i}>
                <p>{c.quote}</p>
                <cite>
                  [{c.id}] {c.name}
                  {c.page ? tx(" · Page {0}", c.page) : tx(" · Pasted text")}
                </cite>
                {c.source_url && (
                  <p>
                    <a href={c.source_url} target="_blank" rel="noreferrer">
                      {tx("Open original source")}
                    </a>
                  </p>
                )}
              </blockquote>
            ))}
            <p className="small muted">
              {tx(
                "This answer does not change your tasks, deadlines or submissions. Answers are not saved between visits.",
              )}
            </p>
          </section>
        )}
      </section>
      <section>
        <h2>{tx("Course material")}</h2>
        {!course ? (
          <p className="muted">
            {tx("Choose a module to add or read its material.")}
          </p>
        ) : (
          <>
            {!selected.length && (
              <p className="coverage-note">
                {tx(
                  "No material saved for this module. Add a PDF or paste course text to ask questions.",
                )}
              </p>
            )}
            {selected.map((m) => (
              <article className="material-row" key={m.id}>
                <strong>{m.name}</strong>
                <button
                  className="text-button"
                  disabled={!!busy}
                  aria-label={tx("Remove material {0}", m.name)}
                  onClick={async () => {
                    setBusy("deleting");
                    setError("");
                    setAnswer(null);
                    try {
                      await request(
                        "/materials/" + encodeURIComponent(m.id),
                        "DELETE",
                      );
                      await refresh();
                      setNotice("Material removed from the assistant library.");
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  {tx("Remove")}
                </button>
              </article>
            ))}
            <details className="material-upload">
              <summary>{tx("Add course material")}</summary>
              <p className="small muted">
                {tx(
                  "PDF text is read on this device and saved in your local Gobbler account. Up to 200 pages, 10 MB and 500,000 text characters per document. Scanned images need OCR, which is not included.",
                )}
              </p>
              <label>
                {tx("Course PDF")}
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  disabled={!!busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setBusy("reading");
                    setError("");
                    setText("");
                    setPages([]);
                    try {
                      const read = await (
                        await import("./pdf")
                      ).readPdf(file, { pages: 200, characters: 500000 });
                      setPages(read);
                      setText(read.map((p) => p.text).join("\n\n"));
                      setName(file.name);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy("");
                    }
                  }}
                />
              </label>
              {busy === "reading" && (
                <p role="status">{tx("Reading PDF on this device…")}</p>
              )}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy("saving");
                  setError("");
                  setNotice("");
                  setAnswer(null);
                  try {
                    const result = await request<{ existing: boolean }>(
                      "/materials",
                      "POST",
                      {
                        course_id: course,
                        name,
                        source_url: url,
                        pages: pages.length ? pages : [{ page: null, text }],
                      },
                    );
                    await refresh();
                    setText("");
                    setPages([]);
                    setName("");
                    setUrl("");
                    setNotice(
                      result.existing
                        ? "This material was already saved. No duplicate was added."
                        : "Material saved for this module.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy("");
                  }
                }}
              >
                <label>
                  {tx("Material title")}
                  <input
                    required
                    maxLength={250}
                    value={name}
                    disabled={!!busy}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  {tx("Original document URL (optional)")}
                  <input
                    type="url"
                    maxLength={4000}
                    value={url}
                    disabled={!!busy}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </label>
                <label>
                  {tx("Review or paste course text")}
                  <textarea
                    required
                    rows={6}
                    maxLength={500000}
                    disabled={!!busy}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setPages([]);
                    }}
                  />
                </label>
                <p className="small muted">
                  {tx(
                    "Editing extracted text removes PDF page references. The original PDF file is not stored.",
                  )}
                </p>
                <button className="secondary" disabled={!!busy || !text.trim()}>
                  {busy === "saving" ? tx("Saving…") : tx("Save material")}
                </button>
              </form>
            </details>
          </>
        )}
      </section>
    </div>
  );
}
