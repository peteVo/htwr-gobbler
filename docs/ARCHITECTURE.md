# Architecture

## Shape of the system

```text
Browser (React PWA, apps/web)
  ├─ /api/* ──> Hono Worker (apps/api) ──> D1 SQLite (Wrangler local or Cloudflare)
  ├─ /local-status ──> local runner status (Windows daily-use mode)
  └─ Assistant requests ──> API ──> Ollama on loopback (optional)

Local runner (scripts/local.ts)
  ├─ starts/reuses loopback API and finished-build gateway
  ├─ checks the configured account's subscribed calendars
  ├─ reads explicitly mapped local PDF folders
  └─ creates/restores/rotates verified local database backups

MCP client ──stdio──> apps/mcp ──HTTP + scoped read-only token──> same API
```

The development command uses Vite at `127.0.0.1:5173` and Wrangler at `127.0.0.1:8787`. Daily Windows mode serves the compiled frontend through the local gateway on port 5173 and the API/assets through Wrangler on 8787. Both bind to loopback. A hosted Worker can serve static assets and API from one origin, but current deployment configuration is a template and personal records are not deployed.

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/web/` | React interface, translations, PWA shell, browser-side calendar/PDF review and notifications. `src/main.tsx` is the UI entry point. |
| `apps/api/` | Hono routes, authentication, tenant-scoped queries, ingestion/sync, assistant retrieval, local runner operations and restore. `index.ts` builds the Worker application. |
| `packages/core/` | Shared schemas and deterministic domain logic for dates, materials, reminders, restore and search. |
| `apps/mcp/` | Read-only stdio adapter for an authenticated Gobbler API. |
| `scripts/` | Windows/local runner, loopback server, backups, update/startup support, folder synchronization, PDF reading/OCR. |
| `migrations/` | Ordered D1/SQLite schema migrations; apply all migrations for a fresh database. |
| `tests/` | Unit/API and browser tests plus synthetic fixtures. Do not use personal records as fixtures. |
| `docs/` | Setup, feature, security, recovery, integration, deployment, validation and status guides. |

## Data and trust boundaries

- Browser API requests use the same-origin application origin and account session. API record queries are scoped to the authenticated account; schemas validate untrusted inputs and SQL values are bound parameters.
- D1 is the durable record store. Wrangler local mode stores development data beneath ignored `.wrangler/`; a deployed D1 database is a separate environment. Never copy a database without its matching secrets when doing a full recovery.
- Moodle calendar subscription URLs are encrypted at rest and fetched only by the allowlisted calendar sync path. Calendar coverage is limited to published feed entries. File imports and connected local PDF folders are separate source types.
- The local runner receives a configured account ID and explicit module-to-folder mappings in ignored `.wrangler/local/config.json`. Browser requests cannot choose arbitrary filesystem paths. PDF extraction and optional OCR run locally; local course Q&A calls Ollama on loopback and has no cloud fallback.
- Optional OpenAI date extraction is a distinct consent-gated feature and requires operator-provided credentials. It is not the local assistant.
- The MCP adapter uses a revocable, expiring, read-only token and calls the API; it does not directly access D1 or university systems.
- The service worker caches the app shell, not private API records. Browser reminders require the app to be open; local calendar checks can continue while the configured runner is active and the computer is awake.

## Change guidance

Keep shared validation/domain behavior in `packages/core/` when both API and interface need it. Keep database changes in a new ordered SQL migration; do not edit an already applied migration to change existing installations. Keep university/source adapters explicit about provenance, freshness, failure, and incomplete coverage. Preserve prior data on failed imports or backups. Consult `SECURITY.md`, `INTEGRATIONS.md`, and the feature-specific guide before changing those boundaries.
