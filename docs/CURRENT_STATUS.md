# Current status

Status reflects repository evidence and fresh checkout validation through 23 October 2026. Earlier validation and user-device reports are identified separately; they do not establish that this computer passed physical startup, sleep or daily backup observations.

## Product

Gobbler is a private, local-first academic organizer for RWTH coursework. The repository contains a React/TypeScript PWA, Hono API, Wrangler/D1 SQLite runtime, Windows background runner and a read-only stdio MCP adapter. Implemented workflows include account-scoped courses and tasks, calendar import/subscriptions, local PDF/material ingestion and review, local Ollama course Q&A, foreground reminders, search, recovery and local backups.

This is not complete university-wide monitoring. Calendar feeds cover published events; course files arrive through the official RWTH Sync-my-L2P application and explicitly mapped local folders. Gobbler does not currently discover all Moodle announcements/submissions or verify registration/submission. See [INTEGRATIONS.md](INTEGRATIONS.md), [ASSISTANT.md](ASSISTANT.md), and [README.md](../README.md#known-limits-and-next-work).

## Development and personal data

- The current checkout started clean on `master`. The local-roadmap follow-up contains uncommitted code, test and documentation changes.
- Local development uses Node.js 24, pnpm 11.25.0, Wrangler local D1 and loopback ports 5173/8787. No Cloudflare account is needed for local development.
- `.dev.vars`, `.wrangler/`, `dist/`, and test outputs are ignored. A new checkout needs its own distinct session and feed secrets and its own local database migrations. Do not replace an existing user's secrets or storage during setup.
- The optional local assistant uses Ollama and `qwen3:4b-instruct`; Windows scanned-PDF OCR uses local `glm-ocr:latest`. Models are not vendored and require separate local installation. See [ASSISTANT.md](ASSISTANT.md).
- On the current computer, the supported Qwen model was installed and enabled in the new local configuration. Three bounded authorized-PDF questions and synthetic EN/DE/VI known-fact checks passed with page evidence; a topic-matching unsupported question was declined. Real-answer semantic accuracy remains a separate review. See [validation](VALIDATION.md).
- The supported OCR model was installed and completed a real scanned-page check, followed by a local answer with matching page/OCR evidence. Independent transcription and answer review remains outstanding.
- The README describes the currently supported setup. [LOCAL_USE.md](LOCAL_USE.md) covers the installed Windows runner, update, backup, and recovery operations.
- The whole-app reading-desk UI revamp is complete and reviewed for shipping after two mobile CSS refinements. It passed strict TypeScript, production build, 86 code checks, 37 full Edge scenarios before those refinements, and 11 focused Edge scenarios afterward. Screenshot, contrast and overflow evidence is in [VALIDATION.md](VALIDATION.md); physical screen-reader and hardware checks remain separate.

## Hosting

The repository's deployment notes report a Cloudflare staging Worker and D1 database with synthetic data only. They record a Free-plan CPU gate failure and say that personal migration and scheduled checks were stopped. No personal records, recovery hash, or Moodle subscription should be expected in staging; no paid plan is documented as enabled. See [DEPLOYMENT.md](DEPLOYMENT.md) and [FREE_HOSTING.md](FREE_HOSTING.md). `wrangler.jsonc` contains a placeholder D1 ID, so it is not ready for direct production deployment.

## Recorded validation and open checks

On 22 October this checkout passed 86 code checks, with one non-Windows case skipped, strict TypeScript/production build and 33 Windows/Edge browser scenarios. On 23 October the UI revamp passed strict TypeScript/build, 86 code checks with one non-Windows case skipped, and 37 full Edge scenarios, followed by two CSS refinements and 11 focused Edge scenarios. Tests used synthetic records and a separate browser port to avoid another application. Fixes cover date-only deadlines in calendar answers, unrelated assistant excerpts, reminder retries during workspace refresh and Unicode paths in the native PDF renderer. See [VALIDATION.md](VALIDATION.md) for dated evidence, [UI_REVAMP_PLAN.md](UI_REVAMP_PLAN.md) for the completed design work and [local acceptance](LOCAL_ACCEPTANCE.md) for remaining physical checks.

Still unverified or limited according to the docs:

- Full external security review, deployed load/security review, and public release readiness.
- Complete Moodle coverage, Gobbler-owned university OAuth integration, recurrence expansion, and background Web Push.
- A physical sleep spanning a scheduled check, a full 24-hour backup interval, and cross-platform hardware support beyond the recorded Windows/Linux CI evidence.
- Semantic correctness for arbitrary course questions, OCR on all handwriting/formulas, and freshness of the upstream downloader's local files.

For the maintained next-work list see [NEXT_STEPS.md](NEXT_STEPS.md). For reasoning behind hosting, ingestion and privacy boundaries see [DECISIONS.md](DECISIONS.md).
