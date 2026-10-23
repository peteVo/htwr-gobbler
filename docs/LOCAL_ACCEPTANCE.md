# Local Windows acceptance checklist

Gobbler's supported release scope is one Windows PC with local storage and loopback-only services. Hosting, cloud migration, phone access and background push remain deferred. This checklist separates recorded evidence from observations still needed on the current computer. Checked items identify the dated validation that established them.

## Evidence already recorded

- Fresh build/update, local migration, runner restart and workspace preservation passed on the previous setup. The 19 October milestone passed 79 code checks and 32 Windows/Edge scenarios; the 22 October fresh-checkout follow-up passed 86 and 33 respectively, plus type-check/build. See [validation](VALIDATION.md) and [local use](LOCAL_USE.md).
- A cold-start and a short sleep/wake check previously showed responding local servers, an advancing heartbeat and preserved records. A roughly one-minute sleep/wake also resumed the runner and a local assistant question.
- Backup tests cover online SQLite snapshots, integrity and foreign-key checks, matching feed-key decryption, corruption rejection and seven-copy retention. A real local backup restore was verified. Those checks do not establish a full live rollback or elapsed 24-hour rotation.
- Representative real course questions returned source quotations and page references; altered quotations and an unsupported question were rejected. OCR examples showed useful transcription with visible mistakes, so original pages still need review.

## Acceptance checklist

Run the software checks from a separate checkout with synthetic accounts and storage. Do not copy `.dev.vars`, `.wrangler`, exports, backups or academic records from the personal checkout.

- [x] **Fresh checkout (22 October 2026):** Node.js 24.19.0/pnpm 11.25.0, frozen install, new local secrets, migrations and build passed on `master` plus the current changes. All 86 code checks passed (one non-Windows case skipped), as did all 33 Edge scenarios on frontend port 5273/API port 8787. Storage contains synthetic test accounts; no personal database was copied. See [validation](VALIDATION.md).
- [x] **Bounded local Q&A integration (22 October 2026):** the supported Qwen model returned three source-based answers with matching original page evidence from authorized local PDFs. Synthetic EN/DE/VI questions returned the expected known fact; a relevant question with no answer in the source was declined. These direct local checks did not import coursework into the test account. See [validation](VALIDATION.md).
- [x] **Bounded real OCR integration (22 October 2026):** a scanned original page was rendered read-only and transcribed locally with the supported OCR model. The response completed without truncation in 28 seconds; a follow-up Qwen answer retained the original page and OCR marker. This confirms integration, not transcription accuracy.
- [ ] **Independent answer/OCR review:** compare a printed and a scanned/handwritten original page with the answer and transcription. Record incorrect interpretations, omitted formulas and resource contention. Exact page evidence and successful transcription requests do not establish semantic correctness; this remains a human review step.
- [ ] **Reboot and startup:** after the official downloader, Ollama and Gobbler runner are configured, sign out/reboot once. Confirm the downloader and runner start as configured, ports 5173/8787 respond, Sources/Settings show a fresh heartbeat and checks, Ollama answers a local question, and no duplicate runner appears. Confirm the same local records and folder mapping remain. Do not enter university credentials as part of this checklist.
- [ ] **Sleep across a due check:** leave the PC asleep across a scheduled source-check time, wake it, and confirm the runner resumes, performs an overdue check without a burst of catch-up requests, updates status and preserves existing records. Record the sleep interval and observed check times.
- [ ] **Real daily backup and synthetic restore:** keep the personal runner awake and signed in for a full 24-hour interval; confirm `last_backup` advances, the new automatic snapshot verifies, and retention stays at seven. Separately, in the isolated synthetic checkout, create a backup and restore/inspect that synthetic snapshot without replacing any live database. Record both results and any failure status.

For commands and local backup verification, see [Local use](LOCAL_USE.md) and [Recovery and updates](RECOVERY_AND_UPDATES.md). Never use personal records to manufacture a test failure or practice destructive rollback.
