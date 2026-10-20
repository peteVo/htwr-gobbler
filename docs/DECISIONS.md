# Decisions and rationale

This log records choices evident in the implementation and existing project docs. It is not a claim that every alternative was benchmarked. Dates refer to the dated repository evidence; rationale may be summarized from that evidence.

| Decision | Rationale and consequence | Evidence |
| --- | --- | --- |
| Keep the current pilot local-first | Personal records and the Moodle subscription remain on the user's computer. Shared remote access waits for a hosting choice and deployment review. | `LOCAL_USE.md`, `DEPLOYMENT.md`; Free Worker CPU samples exceeded 10 ms and personal migration stopped. |
| Use one React/TypeScript PWA and a Hono API with SQLite/D1 | Shared schemas and normalized records support local operation and a possible hosted Worker without separate client data models. | `package.json`, `apps/`, `packages/core/`, `migrations/`, `wrangler.jsonc`. |
| Use Wrangler local D1 for development | The API uses the same D1-oriented interface locally and on Workers; local setup needs no Cloudflare account. | `wrangler.jsonc`, README setup. |
| Keep university integrations narrow and authorized | Calendar subscription is allowlisted; Sync-my-L2P supplies files through user-configured local folders. Gobbler does not reuse another app's OAuth client, university password, cookies, or tokens. | `INTEGRATIONS.md`, `ASSISTANT.md`, `SECURITY.md`. |
| Require review for extracted academic dates | Deterministic parsing and OCR can miss or misread dates, time zones, or cutoffs. Evidence and source pages are retained, but a person confirms the task. | `README.md`, `ASSISTANT.md`, `VALIDATION.md`. |
| Run course Q&A locally through Ollama | Course material remains on the laptop and no AI API key is needed for Q&A. The tradeoff is local model installation, hardware performance, and answer-quality limits. | `ASSISTANT.md`; configured model `qwen3:4b-instruct`. |
| Separate assistant Q&A from optional external date extraction | The external provider path is consent-gated and configured independently; it does not become a fallback for local Q&A. | `SECURITY.md`, `ASSISTANT.md`, `.dev.vars.example`. |
| Keep browser reminders foreground-only | This avoids claiming delivery when the browser is closed or the device is offline. Background push remains future work. | `REMINDERS.md`, `NEXT_STEPS.md`. |
| Back up the complete local database with matching secrets | Feed URLs need the matching encryption secret to restore. Online snapshots are verified before retention pruning; backups contain private data and are not encrypted at rest by Gobbler. | `LOCAL_USE.md`, `RECOVERY_AND_UPDATES.md`. |
| Keep the MCP adapter read-only | AI clients can query saved academic data through expiring, revocable tokens without gaining record-write or university access. | `MCP.md`, `apps/mcp/`. |

## Revisit when

- The user authorizes cross-device hosting: benchmark the real workload and review account isolation, migrations, secrets, backups, costs, and recovery before moving personal data.
- RWTH confirms an app registration and current API permissions: assess the exact approved scopes and capabilities before adding a direct connector.
- Real device delivery is a requirement: implement and validate push delivery, retries, unsubscribe, and cross-device deduplication before describing reminders as background-capable.
- Users need another deployment target: add a documented adapter only after proving its database, crypto, scheduled work, and runtime fit; avoid claiming portability from frontend build success alone.
