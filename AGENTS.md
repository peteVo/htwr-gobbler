# Repository guide

## Start here

- [README.md](README.md): product overview, supported setup, and common commands.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): components, data flow, boundaries, and key entry points.
- [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md): evidence-backed implementation and environment status.
- [docs/DECISIONS.md](docs/DECISIONS.md): rationale and constraints behind current choices.
- Feature and operations guides live in `docs/`; see the README index.

## Working rules

- Read the relevant source and its callers before changing behavior. Keep changes small and follow the existing TypeScript, React, Hono, SQL migration, and test conventions.
- Preserve account isolation, same-origin protections, source provenance, and existing records. Migrations must be additive and safe for existing local workspaces.
- Treat `.dev.vars`, `.wrangler/`, exports, backups, calendar subscription URLs, tokens, and real academic records as private. Never commit or print their contents.
- Do not fetch university systems or use user credentials unless the user explicitly asks. Imported calendars and documents have limited coverage; do not imply that a task was submitted or registration verified.
- Do not deploy, upload personal data, enable billing, push, or alter remotes without explicit authorization.
- Update the relevant docs when behavior or supported setup changes. Distinguish repository evidence, automated checks, and user-reported hardware observations.

## Local development

Use Node.js 24 and pnpm 11.25.0. Copy `.dev.vars.example` to `.dev.vars` only for a new checkout, set distinct random `SESSION_SECRET` and `FEED_SECRET` values, then run:

```sh
pnpm install
pnpm db:migrate
pnpm build
pnpm dev
```

Open `http://127.0.0.1:5173`; the API is on `127.0.0.1:8787`. More complete Windows daily-use, account, Ollama, and backup instructions are in the linked docs. Never overwrite an existing `.dev.vars` file or local database as part of setup.

## Checks

For code changes, use the focused tests plus `pnpm build`; browser tests are `pnpm test:e2e` (Edge on Windows or set `PLAYWRIGHT_CHANNEL=chromium` where Chromium is installed). Tests use local Wrangler storage, so use a separate checkout when isolation from personal records matters. See [docs/VALIDATION.md](docs/VALIDATION.md) for recorded evidence and limitations.
