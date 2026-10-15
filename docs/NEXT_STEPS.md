# Next steps: dependable assignment coverage

## Starting point

The local app imports Moodle calendar events without duplicate file uploads, preserves explicit module names, prioritizes assignments, and retains completion states. The user has checked that displayed times look correct. Local verification currently passes 40 unit/API tests and 10 browser scenarios, plus build and Linux CI.

The principal gap is coverage: a successful calendar import does not establish that all exercise sheets, instructions, announcements or submission requirements have been checked. Assignment discovery and reliable monitoring take priority over additional visual polish or AI features.

## 1. Validate coverage on two active modules

Choose two modules with regular homework. Compare their currently released assignments with the imported calendar and inspect one representative exercise sheet from each. Record whether deadlines live in Moodle assignment activities, PDF text, announcements, another system, or several of these.

Deliverable: a small coverage checklist per module, distinguishing known assignments, missing assignments, review-required dates and sources that have not been checked. Avoid entering a generic exercise session as a submission deadline.

Done when: every assignment in this bounded sample has a module, original source and explicit deadline state, and every omission has an identified cause.

Needed from the user: two module names and where their homework is published; representative PDFs can be read locally through the app. No university passwords are needed.

## 2. Validate an automatic Moodle calendar connection

Use the user's authorized subscription URL in the app, keeping it out of chat, Git and logs. Test a real manual feed check, a repeated unchanged check, and failure handling. Preserve existing records, module choices and completion states; guard against duplication between an existing uploaded calendar and a newly connected feed before enabling both together.

Done when: the live feed matches the existing export, repeats create no duplicates, a changed due date updates the same assignment, and a failed check visibly marks information stale. Controlled fixtures can test a deadline change and an outage without changing Moodle.

Needed from the user: obtain the personal export/subscription URL in Moodle and enter it in the app when the file-to-feed transition is ready. If no usable URL is offered, retain explicit manual-import status rather than implying automatic monitoring.

## 3. Cover exercises missing from calendars

Use findings from step 1 to choose the smallest useful connector. Investigate permitted official read-only Moodle APIs first. Do not assume token login works with RWTH SSO/MFA. Consider a narrowly scoped desktop-session extension only if supported access is unavailable and permissions are understood.

While that access is unresolved, improve the existing local PDF workflow: associate sheets with modules, recognize the date formats seen in the samples, preserve page quotations, avoid duplicate candidates when a sheet is reread, and distinguish updated document versions. Dates lacking a year/time or otherwise ambiguous remain review-required; they are never silently confirmed. File reading and deterministic extraction remain usable without external AI.

Done when: a newly released sample sheet can become a sourced assignment with evidence, a revised sheet produces a useful change record, and unchecked materials remain visible as a coverage gap. Automatic discovery is only considered complete after a permitted real connector demonstrates it.

## 4. Make the daily view actionable

Use the real assignment sample to refine Today around overdue tasks, upcoming deadlines, unreviewed dates and deadlines moved earlier. Show old and new dates for meaningful deadline changes, the affected module and the reason an alert was generated. Maintain separate meanings for completed, dismissed and actually submitted; calendar access cannot verify submission.

Done when: the student can identify the next assignment to act on and what information remains uncertain without searching through lecture events.

## 5. Prepare and deploy a private cross-device pilot

Prepare account recovery, backups/restore, secret configuration, local-data migration and a minimal security/usage review. Measure expected Worker and database use against current service limits. Present a concrete deployment configuration and any expected costs before asking for deployment approval; prefer a free-tier pilot without promising unlimited capacity.

Only after authorization, deploy one HTTPS backend and database, migrate the selected personal workspace safely, and enable scheduled feed checks. Test Windows and Android against that same account. Do not expose the local development server publicly as a shortcut.

Done when: both devices see the same assignments and changes, supported source checks continue with the PC off, and backup restoration has been exercised.

Needed from the user later: hosting-account sign-in and approval of the prepared deployment. Do not request account passwords or API keys in chat.

## 6. Deliver background reminders

Add real Web Push subscriptions, revocation and delivery handling after hosting works. Respect quiet hours, per-device permissions and duplicate suppression. Prioritize approaching deadlines, earlier deadline changes and source-check failures; make denied permissions and unavailable delivery explicit.

Done when: a test reminder reaches an authorized Android device with the app closed, repeated synchronization does not duplicate it, quiet hours are honored, and reminders can be disabled.

## Deferred

Additional AI providers, a general chat interface, Google Calendar writes, university email, Dynexite and broad visual redesigns wait until assignment coverage and monitoring are dependable. Recurring timetable support remains useful but secondary to the user's deadline and exercise priorities.

## Validation progress — 15 October 2026

Two authenticated courses were inspected. Their current material confirms that calendar exports omit some registration requirements and that exercise publication/discussion dates must not automatically become submission deadlines. No currently published submission sheet was found in the visible sample; one course will use a separate exercise-group room. Conflicting source dates remain unresolved. Personal course names, enrollment/prerequisite status and evidence are retained locally outside Git.

University registration, account/password/MFA setup and any teaching-team email require student action. The automation has not completed those steps on the student's behalf.

File-to-feed conversion retains existing source IDs and records, with overlap rejection and a database uniqueness constraint. The student connected a real subscription directly in the app. Two live checks each returned 226 events with zero changes, retaining 230 personal records, completion states and modules without duplicates. Unit/API checks total 43 and browser scenarios total 11. Local checks remain manual; cloud deployment and phone push delivery have not been completed.

## Immediate next action

Complete the university prerequisites and inspect the future exercise-group course when it becomes available. Direct Moodle course/file access has an identified university OAuth/proxy route, but requires Gobbler's own client registration and current capability documentation; see INTEGRATIONS.md. Prepare the private deployment prerequisites before requesting launch approval. Existing calendar checks and local document review remain usable meanwhile.
