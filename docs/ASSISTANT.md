# Local course assistant

The Assistant view answers questions using material the signed-in user saves for a selected module. It runs through a local Ollama model, with no AI API key or per-request service charge. Downloading/installing the engine and model requires internet access; inference uses the fixed loopback endpoint `http://127.0.0.1:11434/api/chat`. It does not fall back to a cloud model or provider.

## Use

1. Open Assistant, select a module, and expand Add course material.
2. Choose a PDF or paste course text, give it a title and optionally its original URL, then save.
3. Ask a specific question. Read the answer beside its supporting quotations, document names and page references.

PDFs are read on the device. The library saves extracted text, not original PDF binaries, in the local account database. Limits are 200 pages, 10 MB and 500,000 characters per document, 100 documents and 5 million serialized characters per account. PDFs containing only scanned images require OCR, which is not included. Editing extracted text removes page references. Re-uploading unchanged pages to the same module reuses the document. Material is isolated by account and module; deleting a course also deletes its material.

The assistant selects up to eight overlapping text excerpts by question-word relevance. This is lexical retrieval, not exhaustive semantic search across a course. Cross-language questions, diagrams, mathematical notation and broad synthesis may need a more specific question or a relevant pasted excerpt. An answer can still misinterpret valid quotations. Exact-quote validation establishes that evidence exists, not that every generated claim follows from it. Unknown/unsupported answers are explicit; partial or invalid structured responses are rejected. It never updates tasks, invents authoritative deadlines, submits work, browses Moodle or executes source instructions.

Answers are not saved between visits. Course material text is included in full local SQLite backups; older backups remain verifiable. The existing Settings JSON export/merge workflow covers academic records but does not include the material library. Keep original documents. No encrypted backup workflow was added: the user explicitly declined that work.

## Local setup

Install [Ollama for Windows](https://docs.ollama.com/windows), then download the [Qwen3 4B Instruct model](https://ollama.com/library/qwen3:4b-instruct):

```powershell
ollama pull qwen3:4b-instruct
```

Add `LOCAL_AI_MODEL=qwen3:4b-instruct` to the ignored `.dev.vars` file and use Gobbler's local update procedure. Preserve existing session/feed secrets. Keep Ollama bound to loopback. The Windows installer adds its own sign-in shortcut; it is separate from Gobbler's runner. On Linux, start `ollama serve` locally and use the same model and setting. Linux GPU inference and Windows reboot with the new engine require separate hardware verification.

Assistant → Check local AI checks the configured installed model without loading it. A first answer may take up to a minute to load the model; requests stop after 90 seconds. Generation has bounded context and output, no tools and no mutable workflow access. If Ollama is stopped or the model is missing, saved coursework, reminders and calendar checks continue working. Start the engine and retry; no cloud fallback is attempted.

The local interface follows the account's EN/DE/VI language preference; material text and quotations stay in their original language. The answer requests that language from the model. The existing optional OpenAI deadline-extraction feature remains separate, requires explicit consent and a separately configured provider, and is not used by this assistant.

The installed Windows engine completed its first-install automatic update before final validation. Real source-based EN/DE/VI and unsupported-question checks passed, followed by an authenticated browser/backend/model round trip with valid page evidence. The first cold answer took 78 seconds; subsequent small questions took about two seconds. These synthetic checks do not establish quality across a full academic course. The next acceptance check is a representative real document and question supplied by the user in the app.
