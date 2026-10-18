# Local course assistant

The Assistant view answers questions using material saved or automatically imported for a selected module. It runs through a local Ollama model, with no AI API key or per-request service charge. Downloading/installing the engine and model requires internet access; inference uses the fixed loopback endpoint `http://127.0.0.1:11434/api/chat`. It does not fall back to a cloud model or provider.

## Saved calendar questions

Explicit timing questions such as “When’s the next lecture?” check the selected module’s saved calendar directly, including when there are no PDFs or the local AI is offline. EN/DE/VI next-lecture, tutorial, exam and assignment timing phrases are recognized. Results use the earliest future open entry of the requested type, exclude completed/dismissed records, preserve date-only and review uncertainty, and display stale-source warnings. A missing entry means the local calendar has no matching record; it does not establish cancellation or the absence of a real class/deadline. This path does not call a model or fabricate dates from course PDFs. Broader course-content questions still use readable material and the local model.

## Use

1. Use the official [RWTH SyncMyMoodle app](https://app.rwth-aachen.de/syncmymoodle/) (Windows name: Sync-my-L2P) to download enrolled-course files. Complete university sign-in in that app; Gobbler never reads its credentials or tokens.
2. Connect each downloaded course directory once using `pnpm local --connect-material-folder <module-id> "<course-directory>"`. Start Gobbler before connecting a folder. The operator stores mappings in ignored `.wrangler/local/config.json`; no browser endpoint accepts filesystem paths. Select each course directory, not the shared semester root.
3. Open Assistant, select a module and ask a specific question. Compare the quotations, document names and page references. The library refreshes every minute while visible; Refresh material library checks immediately. Manual PDF/paste entry remains optional.
4. Check suggested explicit PDF dates in Dates to review. Opening a suggestion starts the existing task editor; saving remains explicit. Check existing calendar/manual tasks first. Identical reviewed document keys reuse tasks; changed documents produce new suggestions rather than guessing which previous task to overwrite.

The local runner reads mapped directories while awake, repeating a minute after each pass, following no directory links and bounding walks to 3,000 entries/20 levels. It waits for stable files and extracts at most three new/changed PDFs per course per pass. Extraction runs in a separate process with a 30-second timeout and 256 MB JavaScript heap. Unchanged unreadable PDFs retry after ten minutes so they cannot block later downloads. File hashes avoid repeated parsing; identical text within one module is stored once, including renamed files. Revisions replace active text bindings. Missing/unreadable files are excluded from answers and date suggestions unless another available file references the same text. Previously manually saved text remains independently available. Pending/failed local reads appear in Sources; Assistant lists individual missing/unreadable paths under PDFs needing attention. Limits: 50 suggestions per document and 100 returned per review request.

Disconnecting a local source stops its imports without removing original files or saved tasks. Reconnect explicitly with the same command; retained configuration does not silently reconnect it. Synced library entries are managed through their source instead of a Remove button. Full local backups include bindings and extracted text; retain original download directories and runner configuration separately.

Local file reads do not establish remote freshness. For automatic Windows downloads, enable the official app's **Save**, **Login on program startup**, **Synchronization on startup**, and **Close after synchronization**, then exit it to save settings. Run `./scripts/windows-material-sync.ps1 -AppPath "<installed Sync-my-L2P.exe>"` once. This schedules the official executable at Windows sign-in and every 30 minutes, using its own saved options. It reads no tokens, runs only while the user is signed in, does not wake the laptop and does not duplicate an existing scheduled instance. Expired university authentication or downloader prompts require attention in that app; Gobbler does not claim those remote checks succeeded. Remove with `./scripts/windows-material-sync.ps1 -Remove`. Linux/macOS can supply folders from the official downloader, but this Windows scheduling script does not configure their startup.

PDFs are read on the device. The library saves extracted text, not original PDF binaries, in the local account database. Limits are 200 pages, 10 MB and 500,000 characters per document, 500 documents and 5 million serialized characters per account. PDFs containing only scanned images require OCR, which is not included. Editing extracted text removes page references. Re-uploading unchanged pages to the same module reuses the document. Material is isolated by account and module; deleting a course also deletes its material.

The assistant selects up to eight overlapping text excerpts by question-word relevance. This is lexical retrieval, not exhaustive semantic search across a course. Cross-language questions, diagrams, mathematical notation and broad synthesis may need a more specific question or a relevant pasted excerpt. An answer can still misinterpret valid quotations. Matching tolerates PDF whitespace differences only and returns the original source substring; changes to words, numbers or punctuation still fail validation. Exact-quote validation establishes that evidence exists, not that every generated claim follows from it. Unknown/unsupported answers are explicit; partial or invalid structured responses are rejected. It never updates tasks, invents authoritative deadlines, submits work, browses Moodle or executes source instructions.

Answers are not saved between visits. Course material text is included in full local SQLite backups; older backups remain verifiable. The existing Settings JSON export/merge workflow covers academic records but does not include the material library. Keep original documents. No encrypted backup workflow was added: the user explicitly declined that work.

## One local database runtime

The background runner sends fixed, account-scoped operations to Gobbler’s running API through a loopback-only endpoint. Requests require a purpose-specific key derived from the local session secret; arbitrary SQL and browser sessions do not grant access. Calendar checks also run in that same API runtime. This avoids separate workerd processes opening the same D1 file and failing to obtain session commit tokens during concurrent reads/writes. PDF extraction and original files remain local to the runner. The binding proxy is used only to load configuration secrets, not to query the live database.

## Local setup

Install [Ollama for Windows](https://docs.ollama.com/windows), then download the [Qwen3 4B Instruct model](https://ollama.com/library/qwen3:4b-instruct):

```powershell
ollama pull qwen3:4b-instruct
```

Add `LOCAL_AI_MODEL=qwen3:4b-instruct` to the ignored `.dev.vars` file and use Gobbler's local update procedure. Preserve existing session/feed secrets. Keep Ollama bound to loopback. The Windows installer adds its own sign-in shortcut; it is separate from Gobbler's runner. On Linux, start `ollama serve` locally and use the same model and setting. Linux GPU inference and Windows reboot with the new engine require separate hardware verification.

Assistant → Check local AI checks the configured installed model without loading it. A first answer may take up to a minute to load the model; requests stop after 90 seconds. Generation has bounded context and output, no tools and no mutable workflow access. If Ollama is stopped or the model is missing, saved coursework, reminders and calendar checks continue working. Start the engine and retry; no cloud fallback is attempted.

The local interface follows the account's EN/DE/VI language preference; material text and quotations stay in their original language. The answer requests that language from the model. The existing optional OpenAI deadline-extraction feature remains separate, requires explicit consent and a separately configured provider, and is not used by this assistant.

The installed Windows engine completed its first-install automatic update before final validation. Real source-based EN/DE/VI and unsupported-question checks passed, followed by an authenticated browser/backend/model round trip with valid page evidence. The first cold answer took 78 seconds; subsequent small questions took about two seconds. These synthetic checks do not establish quality across a full academic course. An additional acceptance check used automatically imported course PDFs and a real local-model answer with a validated original page quotation. Broader course questions, formulas and scanned documents still require further quality work.
