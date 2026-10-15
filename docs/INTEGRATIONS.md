# Integration findings · 15 October 2026

## RWTHmoodle

[RWTH IT Center dashboard documentation](https://help.itc.rwth-aachen.de/service/8d9eb2f36eea4fcaa9abd0e1ca008b22/article/b198cbf620c448b98ae8d256b47787ca/) describes calendar import/export. This makes an authorized calendar export the initial fallback. A real authenticated student export has **not** been tested in this session. The app's calendar endpoint allowlist is `https://moodle.rwth-aachen.de/calendar/export_execute.php` with query parameters preserved and encrypted at rest. Redirects are refused. Login HTML, unsupported calendars and failed responses become failed checks, not successful empty calendars.

Do not conclude that RWTH exposes ordinary Moodle token authentication. Confirm documented REST/mobile service availability and university permission with IT Center before adding course/material/announcement discovery. If approved APIs are unavailable, assess a desktop extension using the student's existing session with explicit permissions; do not bypass SSO or MFA.

Calendar event classification is heuristic and editable: due/deadline/assignment/Abgabe/fällig wording becomes an assignment; opening notices are announcements; exams/Klausuren are exams; ordinary Übung/tutorial sessions are tutorials. A single CATEGORIES value in an explicitly Moodle-produced calendar supplies the module name, with common teaching-format prefixes removed. Multiple or absent categories do not produce a guessed module. Imported course associations populate existing course records; manual non-empty course choices and completion states survive reimport. Review imported events; a calendar is not a definitive assignment inventory. The connector boundary consists of `parseCalendar`, `ingest`, and `syncFeed`; future connectors should normalize into the same items and source-health model.

## RWTHonline

The app accepts uploaded VEVENT calendar files. Direct account access, exam-registration verification and a live RWTHonline export are not tested. Recurrence is explicitly unsupported in this milestone, so many timetable exports will need individual events. No timetable scrape is implemented.

## VGU-MCP reference

Reviewed the current [authentication code](https://github.com/haanhtuandev/vgu-mcp/blob/main/internal/moodle/auth.go), [Moodle REST client](https://github.com/haanhtuandev/vgu-mcp/blob/main/internal/moodle/client.go), and [deadline tool](https://github.com/haanhtuandev/vgu-mcp/blob/main/internal/tools/deadlines.go). Authentication exchanges credentials at `/login/token.php` for `moodle_mobile_app`; the client calls `/webservice/rest/server.php`, including `core_calendar_get_action_events_by_timesort` for deadlines. That flow does not establish RWTH SSO compatibility and the deadline tool does not scan arbitrary PDFs.

The repository README advertises MIT, but the inspected tree still lacked a root LICENSE. No code was copied. Shared normalized data and thin MCP tools are architectural ideas only.

## AI and PDF

[Mozilla PDF.js](https://mozilla.github.io/pdf.js/examples/) reads PDF text locally, retaining page numbers. Local date candidates are deterministic and require review. Optional OpenAI extraction uses the [Responses API structured-output format](https://developers.openai.com/api/docs/guides/structured-outputs), requires API credentials configured by the operator, and sends only text following explicit consent. Do not assume a ChatGPT subscription grants API-key access. ChatGPT-plan authentication for this app is not implemented or established. Ollama remains future work; a hosted Worker cannot automatically access a student's local model server.

## Hosting constraints

Use the current [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) when deciding whether to deploy. Free tiers are bounded, not unlimited. CPU, requests, database reads/writes and storage all matter; password derivation, imports and AI response handling need a deployed-account benchmark. This session does not establish that all workloads fit a free account. No paid resource was created.

## Deliberate follow-up work

1. Validate one authorized Moodle export end to end; compare against the original calendar.
2. Add bounded recurrence expansion with embedded timezone/DST fixtures before accepting recurring timetables.
3. Establish approved full Moodle access; add course/material/announcement discovery and explicit source coverage by capability.
4. Add background Web Push with delivery receipts, cross-device deduplication and a real unsubscribe flow.
5. Add OCR and broader date-format extraction with ambiguity review; never auto-confirm inferred dates.
6. Add read-only university email and other connectors separately, preserving provenance and tenant boundaries.
