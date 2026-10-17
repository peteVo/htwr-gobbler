# App completion roadmap · local pilot · 17 October 2026

The objective is a complete academic assistant experience. Course registration and university account setup are personal coursework tasks, not app development milestones. Local operation remains the chosen deployment scope.

## Working foundation

- Personal accounts, recovery keys, session/token revocation and tenant-scoped records.
- Persistent modules, dated tasks/events and undated next actions, with edit, completion and reopening.
- Dashboard, day/week/month calendar, themes, EN/DE/VI navigation and installable responsive PWA shell.
- Calendar files and encrypted Moodle subscriptions, stable event IDs, duplicate protection, module context and preserved completion.
- Source health and explicit coverage limits, deadline change history, Berlin dates and date-only cutoff uncertainty.
- Local PDF date review with page evidence, repeat/revision protection and optional consent-gated OpenAI extraction.
- Windows sign-in startup, 30-minute source checks, visible runner health and seven verified daily SQLite backups.
- Read-only MCP access to the same stored workspace.

## Current milestone: find and open records

- Global search includes every item type and status, next actions, module names/codes and source records.
- Search matches saved descriptions, action notes, extracted date evidence and document names. Words may appear in different fields; German and Vietnamese diacritics do not prevent a match.
- Results open the matching editor, course's full coursework or source details. Completed/dismissed work is searchable independently of task filters.
- Search reads the current account's loaded snapshot. It does not persist another private index or make university requests. Full PDF contents are not stored or searchable.
- The MCP search tool uses the same matcher. Other focused MCP tools retain their existing filters.

## Next implementation milestones

1. **Daily attention and reminders:** configurable reminder timing and useful deadline-change alerts; verify delivery permissions and quiet hours. Browser reminders currently require an open browser. Background delivery needs a separately verified local mechanism or later hosted infrastructure.
2. **Complete language coverage:** translate forms, validation/help text, status messages and new components beyond the existing EN/DE/VI navigation; check long translations and localized dates on small screens.
3. **Release and recovery experience:** user-facing backup/restore guidance and controls, a repeatable local update/recovery flow, installation checks and production-serving readiness. Automatic backup verification already exists; do not confuse same-disk copies with off-device protection.
4. **Broader ingestion:** implement approved course/material/announcement discovery when Gobbler has its own supported university integration. Until then, improve user-provided document/export workflows without implying automatic Moodle coverage.
5. **Cross-device release:** choose and approve hosting, then migrate and verify shared records, phone access and background push. This remains deferred while the app is local only.

## Validation and remaining gates

Use unit/API tests for parsing, matching, ownership and data preservation; browser scenarios for real workflows, keyboard access and 320/375/414/768 px layouts; strict TypeScript and a production build. Keep test accounts separate from personal records.

Physical sleep spanning a scheduled check and a real 24-hour backup interval have not been directly observed. Simulated elapsed-time tests, cold startup, shutdown/startup and short sleep/wake checks passed previously. Detailed forms remain mostly English. Private records are not cached for offline reading; an offline shell does not imply fresh data or successful monitoring.

Approved university OAuth registration and API capabilities are still prerequisites for automatic course discovery. Do not borrow another app's client ID, copy browser cookies, bypass SSO/MFA or collect university passwords. See INTEGRATIONS.md.

No paid resources, cloud migration, personal-data upload or university email sending is authorized by this roadmap. Synthetic Cloudflare staging stays closed to registration with cron disabled; free-hosting research in FREE_HOSTING.md is informational.
