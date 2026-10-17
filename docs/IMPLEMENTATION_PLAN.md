# Implementation plan

## Milestone and scope

Build one React/TypeScript PWA and one Hono Worker sharing normalized D1 records with a read-only local MCP client. Local Wrangler provides the same D1 API used in deployment. Use plain token-based CSS rather than adding Tailwind for this small app. No empty packages, extension, or native wrappers.

1. Foundation: installable shell, responsive Today/Courses/Tasks/Calendar/Sources/Settings, EN/DE/VI navigation, theme preferences.
2. Persistence: account registration, hashed passwords, expiring sessions, tenant-scoped CRUD, SQL migration, validation and same-origin writes.
3. Authorized ingestion: uploaded iCalendar and allowlisted RWTHmoodle calendar subscription; deterministic UID deduplication, content hashes, provenance, last-success/error reporting. Unsupported recurrence must fail explicitly instead of silently dropping events.
4. Monitoring: cron and manual feed refresh, bounded retries, change history, explicit partial coverage. Foreground reminders with quiet hours; background Web Push deferred pending delivery infrastructure.
5. Document review: local PDF text extraction and explicit numeric date candidates with page evidence; optional consent-gated text extraction via configurable OpenAI Responses API. Evidence required, needs-review always. OCR, broader date parsing and Ollama deferred.
6. Read-only MCP over stdio queries the same authenticated API; no university credentials.
7. Validate core logic, account isolation, import/reimport/change/failure, UI persistence, small screens, build; document and commit/push feature branch, create reviewable PR.

## Safety and deployment

No production deploy or paid resources. Calendar feeds are secrets: encrypt URLs at rest and never return them. University passwords are never requested. Cache only app-shell assets, never API responses or personal data. Marking a task done never means submitted. Calendar import only covers published calendar entries, not PDFs, announcements or full course discovery.

## Integration research

RWTH officially documents calendar import/export in its Moodle dashboard help. This establishes export as the first supported fallback, not availability of Moodle REST tokens with SSO/MFA. Validate a real export with a user-authorized feed later. VGU-MCP is an architectural reference only; no code copied. See INTEGRATIONS.md for sources and deployment limits.
