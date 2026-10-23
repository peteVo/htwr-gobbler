import { useEffect, useState } from "react";
import type { Course } from "../../../packages/core/index";
import type { DocumentPage } from "../../../packages/core/deadlines";
import type {
  CourseAnswer,
  SyncedMaterialSummary,
  MaterialCandidate,
} from "../../../packages/core/materials";
import { useText } from "./text";
import { MaterialDates } from "./MaterialDates";
import type { Item } from "../../../packages/core/index";
import { scheduleKind } from "../../../packages/core/schedule";
type FileIssue = {
  source_name: string;
  relative_path: string;
  state: string;
  issue?: string;
  pages_done?: number;
  pages_total?: number;
};

export function Assistant({
  courses,
  items,
  signedIn,
  language,
  request,
  review,
  showSources,
}: {
  courses: Course[];
  items: Item[];
  signedIn: boolean;
  language: string;
  request: <T>(path: string, method?: string, body?: unknown) => Promise<T>;
  review: (candidate: MaterialCandidate & { target_id?: string }) => void;
  showSources: () => void;
}) {
  const tx = useText();
  const [course, setCourse] = useState(""),
    [materials, setMaterials] = useState<SyncedMaterialSummary[]>([]);
  const [issues, setIssues] = useState<FileIssue[]>([]);
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
    const [library, files] = await Promise.all([
      request<SyncedMaterialSummary[]>("/materials"),
      request<FileIssue[]>("/materials/issues"),
    ]);
    setMaterials(library);
    setIssues(files);
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
    const load = () =>
      Promise.all([
        request<SyncedMaterialSummary[]>("/materials"),
        request<FileIssue[]>("/materials/issues"),
      ])
        .then(([v, files]) => {
          if (active) {
            setMaterials(v);
            setIssues(files);
          }
        })
        .catch(() => {
          if (active) setError("Could not load course materials. Try again.");
        });
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60000);
    void check();
    const resume = () => {
      if (document.hidden) return;
      void load();
      void check();
    };
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [signedIn]);
  if (!signedIn)
    return (
      <p className="coverage-note">
        {tx("Sign in to save course material and use the local assistant.")}
      </p>
    );
  const selected = materials.filter((m) => m.course_id === course);
  const readable = selected.filter((m) => m.available !== 0);
  const pending = issues.filter(
    (f) => f.state === "unreadable" && f.issue === "indexing",
  );
  const attention = issues.filter((f) => !pending.includes(f));
  const calendarQuestion = scheduleKind(question);
  return (
    <div className="assistant-layout">
      <section className="assistant-workspace">
        <h2>{tx("Ask about your course")}</h2>
        <p className="muted">
          {tx(
            "Answers use selected excerpts from this module's available material. Connected local folders update automatically. Check the quotations; the AI can still make mistakes.",
          )}
        </p>
        <div className="assistant-context">
          <div>
            <label htmlFor="assistant-module">{tx("Module")}</label>
            <select
              id="assistant-module"
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
          </div>
          <div className="assistant-engine">
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
          </div>
        </div>
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
            disabled={
              !!busy ||
              !course ||
              !question.trim() ||
              (!calendarQuestion && !ready)
            }
          >
            {busy === "asking"
              ? tx(
                  calendarQuestion
                    ? "Checking saved calendar…"
                    : "Reading your material…",
                )
              : tx(calendarQuestion ? "Check saved calendar" : "Ask local AI")}
          </button>
        </form>
        {busy === "asking" && !calendarQuestion && (
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
            {answer.calendar ? (
              <div className="answer-text">
                <p>
                  {tx("Saved calendar result · {0}", tx(answer.calendar.kind))}
                </p>
                {answer.calendar.item ? (
                  <>
                    <strong>{answer.calendar.item.title}</strong>
                    <p>
                      {new Intl.DateTimeFormat(language, {
                        dateStyle: "full",
                        ...(answer.calendar.item.all_day
                          ? {}
                          : { timeStyle: "short" as const }),
                        timeZone: "Europe/Berlin",
                      }).format(new Date(answer.calendar.item.starts_at))}
                      {" · Europe/Berlin"}
                    </p>
                    {answer.calendar.item.all_day && (
                      <p>{tx("Date only · no exact time is recorded.")}</p>
                    )}
                    {answer.calendar.item.verification !== "confirmed" && (
                      <p className="warning-text">
                        {tx("This date still needs review.")}
                      </p>
                    )}
                    {!answer.calendar.source_current && (
                      <p className="warning-text">
                        {tx(
                          "The source has not been checked successfully within the last hour. Verify this date before relying on it.",
                        )}
                      </p>
                    )}
                    {answer.calendar.last_checked && (
                      <p className="small muted">
                        {tx(
                          "Last successful calendar check: {0}",
                          new Intl.DateTimeFormat(language, {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Europe/Berlin",
                          }).format(new Date(answer.calendar.last_checked)),
                        )}
                      </p>
                    )}
                    {answer.calendar.item.source_url && (
                      <a
                        href={answer.calendar.item.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {tx("Open original source")}
                      </a>
                    )}
                  </>
                ) : (
                  <p>
                    {tx(
                      "No upcoming entry of this type is saved for this module. This does not mean the class or deadline does not exist.",
                    )}
                  </p>
                )}
                <p className="small muted">
                  {tx(
                    "This checks your saved calendar, without using AI or requiring PDFs. Check the university source for changes and missing events.",
                  )}
                </p>
              </div>
            ) : (
              <p className="answer-text">
                {answer.supported
                  ? answer.answer
                  : tx(
                      "The supplied excerpts do not establish an answer. Try a specific topic or document name, and check material availability below.",
                    )}
              </p>
            )}
            {answer.citations.map((c, i) => (
              <blockquote key={i}>
                <p>{c.quote}</p>
                <cite>
                  [{c.id}] {c.name}
                  {c.page ? tx(" · Page {0}", c.page) : tx(" · Pasted text")}
                </cite>
                {c.ocr && (
                  <p className="warning-text">
                    {tx(
                      "OCR-derived text · check the original page, especially formulas and handwriting.",
                    )}
                  </p>
                )}
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
      <section className="assistant-library">
        <h2>{tx("Course material")}</h2>
        <MaterialDates
          courses={courses}
          items={items}
          course={course || undefined}
          request={request}
          review={review}
          disabled={!!busy}
        />
        <details className="material-upload small muted">
          <summary>{tx("Material coverage by module")}</summary>
          <ul>
            {courses.map((c) => (
              <li key={c.id}>
                {c.name}
                {" · "}
                {tx(
                  "{0} readable documents",
                  materials.filter(
                    (m) => m.course_id === c.id && m.available !== 0,
                  ).length,
                )}
              </li>
            ))}
          </ul>
          <p>
            {tx(
              "Counts cover imported text, not every Moodle resource. Zero means content questions have no readable material yet.",
            )}
          </p>
        </details>
        {pending.length > 0 && (
          <section
            aria-label={tx("PDF import progress")}
            className="material-upload small muted"
          >
            <h3>{tx("PDFs importing ({0})", pending.length)}</h3>
            {pending.map((f) => (
              <p key={f.source_name + f.relative_path}>
                <strong>{f.source_name}</strong>
                {" · "}
                {f.relative_path}
                {" · "}
                {f.pages_total
                  ? tx(
                      "Pages processed: {0} of {1}",
                      f.pages_done ?? 0,
                      f.pages_total,
                    )
                  : tx("Waiting for the next import pass.")}
              </p>
            ))}
            <p>
              {tx(
                "Importing continues automatically while this laptop is awake. Unfinished files are excluded from answers.",
              )}
            </p>
          </section>
        )}
        {attention.length > 0 && (
          <details className="material-upload small muted">
            <summary>
              {tx("PDFs needing attention ({0})", attention.length)}
            </summary>
            <p>
              {tx(
                "These local files are excluded from answers. Missing files need downloading again. Local imports support up to 50 MB and 2,000 pages per PDF; extraction and library limits still apply.",
              )}
            </p>
            <ul>
              {attention.map((f) => (
                <li key={f.source_name + f.relative_path}>
                  <strong>{f.source_name}</strong>
                  <p>{f.relative_path}</p>
                  <span>
                    {tx(
                      f.state === "missing"
                        ? "Missing local file"
                        : "Local PDF unavailable",
                    )}
                  </span>
                  {f.issue === "ocr_unavailable" && (
                    <p>
                      {tx(
                        "Local OCR is unavailable. Start Ollama and install glm-ocr:latest, then let Gobbler retry.",
                      )}
                    </p>
                  )}
                  {f.issue === "renderer_unavailable" && (
                    <p>
                      {tx(
                        "Automatic scanned-PDF rendering currently requires Windows. Text-based PDFs still import locally.",
                      )}
                    </p>
                  )}
                  {f.issue === "ocr_incomplete" && (
                    <p>
                      {tx(
                        "Local OCR could not finish this page. Partial text was rejected; the original is retained and Gobbler will retry.",
                      )}
                    </p>
                  )}
                  {f.issue === "limits" && (
                    <p>
                      {tx(
                        "This PDF exceeds a local processing limit. Use a smaller copy; original files are retained.",
                      )}
                    </p>
                  )}
                  {f.issue === "library_full" && (
                    <p>
                      {tx(
                        "The material library is full. Free space in the library before retrying this PDF.",
                      )}
                    </p>
                  )}
                  {f.issue === "timeout" && (
                    <p>
                      {tx(
                        "This PDF took too long to process. Gobbler will retry; check local OCR availability.",
                      )}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p>
              {tx(
                "Missing file: run Sync-my-L2P to download it again. Scanned pages use local OCR automatically. If processing fails, Gobbler retries later and keeps the original file untouched.",
              )}
            </p>
            <button className="text-button" onClick={showSources}>
              {tx("Check connected sources")}
            </button>
          </details>
        )}
        <p className="small muted">
          {tx(
            "Connected folders are checked automatically while this laptop is awake. Scanned pages may take longer; progress is shown here. Sync-my-L2P downloads Moodle changes separately.",
          )}
        </p>
        <button
          className="text-button"
          disabled={!!busy}
          onClick={() => {
            setError("");
            void refresh().catch(() =>
              setError("Could not load course materials. Try again."),
            );
          }}
        >
          {tx("Refresh material library")}
        </button>
        {!course ? (
          <p className="muted">
            {tx("Choose a module to add or read its material.")}
          </p>
        ) : (
          <>
            <p role="status" className="small muted">
              {tx("{0} readable documents for this module", readable.length)}
            </p>
            {!readable.length && (
              <p className="coverage-note">
                {tx(
                  "No PDFs imported for this module. You can ask about its saved calendar now; course-content answers need readable material from a connected folder.",
                )}
              </p>
            )}
            {selected.map((m) => (
              <article className="material-row" key={m.id}>
                <strong>{m.name}</strong>
                {!!m.ocr && (
                  <span className="warning-text small">
                    {tx(
                      "Contains OCR-derived text · verify formulas and handwriting.",
                    )}
                  </span>
                )}
                {m.synced ? (
                  <span className="small muted">
                    {tx(
                      m.available === 0
                        ? "Local PDF unavailable · excluded from answers"
                        : "From connected local folder",
                    )}
                  </span>
                ) : (
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
                        setNotice(
                          "Material removed from the assistant library.",
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy("");
                      }
                    }}
                  >
                    {tx("Remove")}
                  </button>
                )}
              </article>
            ))}
            <details className="material-upload">
              <summary>{tx("Add course material")}</summary>
              <p className="small muted">
                {tx(
                  "Manual PDF uploads read existing text: up to 200 pages, 10 MB and 500,000 characters. Automatic OCR and larger PDF imports run through connected local folders.",
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
