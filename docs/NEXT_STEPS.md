# Next steps · local pilot · 16 October 2026

The current objective is dependable daily coursework on this PC. Hosting, phone push and paid infrastructure are deferred by the user's choice.

## Completed

1. Calendar reliability: an encrypted personal Moodle feed, stable event IDs, file-to-feed conversion, module context, completion preservation and duplicate protection. The real workspace retains 230 dated records and 226 feed events, with no duplicate calendar UIDs.
2. Daily workflow: assignment-first Tasks, sourced/verified deadlines, old/new deadline changes, review-required document dates, repeat/revision protection and Berlin date-only boundaries.
3. Local operation: Windows sign-in startup, per-account 30-minute checks, visible health/failure status, automatic view refresh and seven verified daily online SQLite backups. Cold startup and the user's shutdown/startup and short sleep/wake checks passed. A simulated 31-minute gap confirms overdue checks resume without replaying a burst. A physical sleep spanning a scheduled interval and a full 24-hour backup interval remain unobserved.
4. Account safety: saved one-use recovery key, session/token revocation and tenant-scoped API access. Real backup copies restore with feed credentials intact; corruption and incorrect keys are rejected.
5. Next actions: module-linked undated checklists on Today, with source URLs, notes, completion/reopening/editing/deletion and read-only MCP access. These do not fabricate due dates or university registration/submission outcomes. Five personal prerequisites/review actions were populated from the existing private audit; the existing dated registration task was retained rather than duplicated. Backup manifests now include actions while older snapshots remain verifiable.

Validation for this local milestone: 52 unit/API/backup checks, 16 Windows browser scenarios, strict TypeScript and production build. Source changes remain in the draft PR; hosted CI is reported separately.

## Next student actions

1. Finish the separate exercise-group registration already shown in Tasks. Confirm its cutoff against the university system; a date-only deadline does not imply midnight. Gobbler cannot complete registration by checking a box.
2. Follow the HPC account/service-password, MFA/access test and course-group-email actions in Today, in that order. These require the student's university login/MFA. No email was sent and no university account/registration was changed by the assistant.
3. After allocation, review the separate exercise-group course and its first released sheet. Review the other module's first published materials when available. The in-app actions retain the audited publication guidance, source links and uncertainty. Enter only explicit submission deadlines, with module and page evidence; publication/discussion dates remain distinct.

Personal course details, enrollment status, course links and quotations stay in the local database/private audit, outside Git. The audited sample had no currently released submission sheet. A future sheet cannot be validated before it exists or before authorized access is available.

## Remaining integration boundary

Automatic course/material discovery requires Gobbler's own approved RWTH OAuth client registration and current API capabilities/rate limits. The identified university proxy establishes course/file access in another registered app, not complete assignment/announcement coverage for Gobbler. Obtain that registration/documentation before implementation; do not borrow application IDs, copy browser cookies or bypass SSO/MFA. See INTEGRATIONS.md.

## Deferred

Cloud migration, remote phone access and Web Push; university email/Dynexite/Google Calendar writes; OCR, broad recurrence and additional AI providers. The synthetic Cloudflare staging deployment remains closed to registration with cron disabled and no personal data. Free-hosting research is in FREE_HOSTING.md; it does not authorize another deployment.
