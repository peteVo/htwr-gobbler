# Integration findings · 15 October 2026

## RWTHmoodle

### Local folder bridge · 18 October 2026

The official [RWTH download page](https://app.rwth-aachen.de/syncmymoodle/) calls the app SyncMyMoodle but links to the Sync-my-L2P installer. Gobbler consumes only its downloaded PDFs through one-time module/directory mappings; it never reads the app’s credentials, OAuth registration or tokens. Folder polling, deduplication, revision bindings, unavailable-text exclusion and review-only explicit date suggestions are implemented. Optional Windows scheduling launches the official app every 30 minutes using the user’s saved settings. Local read health does not establish remote freshness or cover announcements, submissions, videos, other document formats or scanned-image OCR. See ASSISTANT.md for setup, limits and removal. The direct connector research below remains separate.

[RWTH IT Center dashboard documentation](https://help.itc.rwth-aachen.de/service/8d9eb2f36eea4fcaa9abd0e1ca008b22/article/b198cbf620c448b98ae8d256b47787ca/) describes calendar import/export. A real student ICS file has been imported and checked against two authenticated Moodle courses. The student connected its subscription by replacing the existing file source. Two real subscription checks each returned 226 events and zero changes; both retained the same 230 total records including manually reviewed entries, completion states and module choices, with no duplicate UIDs. The private URL was not displayed or committed. The app's calendar endpoint allowlist is `https://moodle.rwth-aachen.de/calendar/export_execute.php` with query parameters preserved and encrypted at rest. Redirects are refused. Login HTML, unsupported calendars and failed responses become failed checks, not successful empty calendars.

When connecting a subscription for an already imported calendar, select its existing file source. Conversion retains source/event IDs, module choices and completion states. A first check is still required, and conversion clears source freshness until it succeeds. Imports reject UIDs that already belong to another source in the same account; ordinary repeated file uploads also detect connected feeds. Migration `0002_calendar_identity.sql` enforces that identity at the database boundary, including concurrent checks. Apply all migrations before running the updated app. Existing duplicate IDs cause migration failure without deleting records; back up and review any such duplicates before retrying. These checks do not merge independent sources automatically.

Do not conclude that RWTH exposes ordinary Moodle token authentication. The IT Center's [SyncMyMoodle page](https://app.rwth-aachen.de/syncmymoodle/) documents its university-maintained course/file synchronizer and links reviewed source code. Investigate its supported authorization and content capabilities before considering a custom browser extension. Availability of that application does not establish API permissions for this app. Never bypass SSO or MFA.

Inspection of the current university-maintained source establishes a concrete integration route:

- Its [README](https://github.com/rwthmoodle/Sync-my-L2P#compile) says an individual client ID is required and must not be published. Gobbler needs its own registration; another application's ID or stored tokens must not be reused.
- [Authorization implementation](https://github.com/rwthmoodle/Sync-my-L2P/blob/master/src/login.cpp) uses a device-code flow at the RWTH OAuth service, requesting `userinfo.rwth moodle.rwth`, with refresh tokens. Request only the scopes actually approved for Gobbler; the source does not establish that these scopes are narrowly read-only.
- Its [endpoint definitions](https://github.com/rwthmoodle/Sync-my-L2P/blob/master/include/urls.h) identify a university proxy at `https://moped.ecampus.rwth-aachen.de/proxy/api/v2/eLearning/Moodle/` with `getmyenrolledcourses`, `getfiles`, and `downloadfile`. This establishes course/file capabilities, not complete assignment or announcement coverage. The public Documentation URL could not be retrieved in this check.

Before implementing this connector, obtain an individual app registration and current API documentation from IT Center, confirm course/file/assignment/announcement capabilities and rate limits, then test student consent, encrypted token storage, refresh and revocation. Until then, keep calendar and local PDF workflows explicit; do not advertise automatic material discovery. No upstream code was copied, and no authorization request or token exchange was made.

Calendar event classification is heuristic and editable: due/deadline/assignment/Abgabe/fällig wording becomes an assignment; opening notices are announcements; exams/Klausuren are exams; ordinary Übung/tutorial sessions are tutorials. A single CATEGORIES value in an explicitly Moodle-produced calendar supplies the module name, with common teaching-format prefixes removed. Multiple or absent categories do not produce a guessed module. Imported course associations populate existing course records; manual non-empty course choices and completion states survive reimport. Review imported events; a calendar is not a definitive assignment inventory. The connector boundary consists of `parseCalendar`, `ingest`, and `syncFeed`; future connectors should normalize into the same items and source-health model.

## RWTHonline

The app accepts uploaded VEVENT calendar files. Direct account access, exam-registration verification and a live RWTHonline export are not tested. Recurrence is explicitly unsupported in this milestone, so many timetable exports will need individual events. No timetable scrape is implemented.

## VGU-MCP reference

Reviewed the current [authentication code](https://github.com/haanhtuandev/vgu-mcp/blob/main/internal/moodle/auth.go), [Moodle REST client](https://github.com/haanhtuandev/vgu-mcp/blob/main/internal/moodle/client.go), and [deadline tool](https://github.com/haanhtuandev/vgu-mcp/blob/main/internal/tools/deadlines.go). Authentication exchanges credentials at `/login/token.php` for `moodle_mobile_app`; the client calls `/webservice/rest/server.php`, including `core_calendar_get_action_events_by_timesort` for deadlines. That flow does not establish RWTH SSO compatibility and the deadline tool does not scan arbitrary PDFs.

The repository README advertises MIT, but the inspected tree still lacked a root LICENSE. No code was copied. Shared normalized data and thin MCP tools are architectural ideas only.

## AI and PDF

[Mozilla PDF.js](https://mozilla.github.io/pdf.js/examples/) reads PDF text locally, retaining page numbers. Local date candidates are deterministic and require review. Optional OpenAI extraction uses the [Responses API structured-output format](https://developers.openai.com/api/docs/guides/structured-outputs), requires API credentials configured by the operator, and sends only text following explicit consent. Do not assume a ChatGPT subscription grants API-key access. ChatGPT-plan authentication for this app is not implemented or established. The local assistant now uses Ollama with validated page quotations; see ASSISTANT.md. A hosted Worker cannot automatically access a student's local model server.

Saving a document date requires a module. A fingerprint of normalized text and candidate evidence prevents identical repeated reviews from adding tasks or resetting completion/verification. A revised document can explicitly update a selected existing task, retaining its ID and completion state and marking the new evidence for review. This does not automatically discover document revisions. Numeric and German month-name dates require an explicit year; date-only results preserve an unknown cutoff. Only confirmed timed deadlines trigger foreground reminders.

## Hosting constraints

Use the current [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) when deciding whether to deploy. Free tiers are bounded, not unlimited. CPU, requests, database reads/writes and storage all matter; password derivation, imports and AI response handling need a deployed-account benchmark. This session does not establish that all workloads fit a free account. No paid resource was created.

## Deliberate follow-up work

1. Validate one authorized Moodle export end to end; compare against the original calendar.
2. Add bounded recurrence expansion with embedded timezone/DST fixtures before accepting recurring timetables.
3. Establish approved full Moodle access; add course/material/announcement discovery and explicit source coverage by capability.
4. Add background Web Push with delivery receipts, cross-device deduplication and a real unsubscribe flow.
5. Add OCR and broader date-format extraction with ambiguity review; never auto-confirm inferred dates.
6. Add read-only university email and other connectors separately, preserving provenance and tenant boundaries.
