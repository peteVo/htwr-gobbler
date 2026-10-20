# Current status

Status reflects repository evidence inspected on 20 October 2026. Earlier validation and user-device reports are identified as recorded evidence; they are not claims that this checkout was freshly tested during this documentation change.

## Product

Gobbler is a private, local-first academic organizer for RWTH coursework. The repository contains a React/TypeScript PWA, Hono API, Wrangler/D1 SQLite runtime, Windows background runner and a read-only stdio MCP adapter. Implemented workflows include account-scoped courses and tasks, calendar import/subscriptions, local PDF/material ingestion and review, local Ollama course Q&A, foreground reminders, search, recovery and local backups.

This is not complete university-wide monitoring. Calendar feeds cover published events; course files arrive through the official RWTH Sync-my-L2P application and explicitly mapped local folders. Gobbler does not currently discover all Moodle announcements/submissions or verify registration/submission. See [INTEGRATIONS.md](INTEGRATIONS.md), [ASSISTANT.md](ASSISTANT.md), and [README.md](../README.md#known-limits-and-next-work).

## Development and personal data

- The checkout is on `feat/cross-platform-mvp`; the inspected working tree was clean at the start of this documentation task.
- Local development uses Node.js 24, pnpm 11.25.0, Wrangler local D1 and loopback ports 5173/8787. No Cloudflare account is needed for local development.
- `.dev.vars`, `.wrangler/`, `dist/`, and test outputs are ignored. A new checkout needs its own distinct session and feed secrets and its own local database migrations. Do not replace an existing user's secrets or storage during setup.
- The optional local assistant uses Ollama and `qwen3:4b-instruct`; Windows scanned-PDF OCR uses local `glm-ocr:latest`. Models are not vendored and require separate local installation. See [ASSISTANT.md](ASSISTANT.md).
- The README describes the currently supported setup. [LOCAL_USE.md](LOCAL_USE.md) covers the installed Windows runner, update, backup, and recovery operations.

## Hosting

The repository's deployment notes report a Cloudflare staging Worker and D1 database with synthetic data only. They record a Free-plan CPU gate failure and say that personal migration and scheduled checks were stopped. No personal records, recovery hash, or Moodle subscription should be expected in staging; no paid plan is documented as enabled. See [DEPLOYMENT.md](DEPLOYMENT.md) and [FREE_HOSTING.md](FREE_HOSTING.md). `wrangler.jsonc` contains a placeholder D1 ID, so it is not ready for direct production deployment.

## Recorded validation and open checks

`VALIDATION.md` records successful unit/API tests, type-check/build, Windows/Edge browser scenarios, local folder ingestion/OCR checks, and selected real local-model questions. The exact counts vary by milestone; use the dated entries there rather than treating one count as current. These records do not establish a fresh test run for this documentation-only change.

Still unverified or limited according to the docs:

- Full external security review, deployed load/security review, and public release readiness.
- Complete Moodle coverage, Gobbler-owned university OAuth integration, recurrence expansion, and background Web Push.
- A physical sleep spanning a scheduled check, a full 24-hour backup interval, and cross-platform hardware support beyond the recorded Windows/Linux CI evidence.
- Semantic correctness for arbitrary course questions, OCR on all handwriting/formulas, and freshness of the upstream downloader's local files.

For the maintained next-work list see [NEXT_STEPS.md](NEXT_STEPS.md). For reasoning behind hosting, ingestion and privacy boundaries see [DECISIONS.md](DECISIONS.md).
