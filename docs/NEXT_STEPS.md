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

## Completed: find and open records

- Global search includes every item type and status, next actions, module names/codes and source records.
- Search matches saved descriptions, action notes, extracted date evidence and document names. Words may appear in different fields; German and Vietnamese diacritics do not prevent a match.
- Results open the matching editor, course's full coursework or source details. Completed/dismissed work is searchable independently of task filters.
- Search reads the current account's loaded snapshot. It does not persist another private index or make university requests. Full PDF contents are not stored or searchable.
- The MCP search tool uses the same matcher. Other focused MCP tools retain their existing filters.

## Next implementation milestones

1. **Release readiness:** off-device encrypted full-backup handling and an independent accessibility/security review. Finished-build serving and the installation/update support matrix are implemented. Do not confuse same-disk copies with off-device protection.
2. **Broader ingestion:** implement approved course/material/announcement discovery when Gobbler has its own supported university integration. Until then, improve user-provided document/export workflows without implying automatic Moodle coverage.
3. **Cross-device release:** choose and approve hosting, then migrate and verify shared records, phone access and background push. This remains deferred while the app is local only.

## Completed: languages, missing-record recovery and local maintenance

The EN/DE/VI catalogue covers app-owned forms, help, errors, statuses, search metadata and accessibility labels. Original course names, notes and source quotations stay unchanged. Typed control values remain the server's stable values even when their labels are translated; locale-aware dates and parameterized messages are checked. Native browser/third-party diagnostics may remain in their original language.

Settings now validates and previews Gobbler JSON exports, then restores missing courses/items/actions/calendar identities without overwriting current records. Restored dates need review; disconnected calendars must be reconnected. This does not recover account secrets or perform a full database rollback. `pnpm local --backup` verifies a complete local snapshot separately from automatic retention; the Windows update script backs up, checks/builds/migrates and restarts the identified runner. The actual update/restart rehearsal passed on this PC with personal records retained. See RECOVERY_AND_UPDATES.md.

## Completed: configurable foreground reminders

Account preferences now include reminder lead time and optional deadline-change alerts. Browser permission/status, immediate test delivery, Berlin quiet hours, old/new dates, uncertainty/source warnings, delivery retry and two-tab duplicate suppression are implemented. Clicking an alert opens its item. The additive local migration was backed up and verified with personal record counts unchanged. See REMINDERS.md for exact behavior and limits.

On 17 October, the user completed **Settings → Reminders → Enable foreground reminders → Send test notification** and confirmed the test notification was visible on this PC. Automated tests verify acceptance/rejection paths; this user report confirms visible manual test delivery in the chosen browser. Closed-browser delivery still requires a separately verified local notifier or later hosted infrastructure; no background delivery is claimed.

## Validation and remaining gates

Use unit/API tests for parsing, matching, ownership and data preservation; browser scenarios for real workflows, keyboard access and 320/375/414/768 px layouts; strict TypeScript and a production build. Keep test accounts separate from personal records.

Physical sleep spanning a scheduled check and a real 24-hour backup interval have not been directly observed. Simulated elapsed-time tests, cold startup, shutdown/startup and short sleep/wake checks passed previously. Private records are not cached for offline reading; an offline shell does not imply fresh data or successful monitoring.

Approved university OAuth registration and API capabilities are still prerequisites for automatic course discovery. Do not borrow another app's client ID, copy browser cookies, bypass SSO/MFA or collect university passwords. See INTEGRATIONS.md.

No paid resources, cloud migration, personal-data upload or university email sending is authorized by this roadmap. Synthetic Cloudflare staging stays closed to registration with cron disabled; free-hosting research in FREE_HOSTING.md is informational.
