# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

RWTH students organizing their coursework on a personal computer. This record follows the repository's documented product and the current user's request to revamp the existing app.

## Product Purpose

Make the next coursework action and its evidence easy to find: dated assignments, saved events, undated actions and questions about available course material.

## Positioning

Gobbler combines account-scoped academic records, imported calendar changes and locally processed course PDFs with explicit source coverage and review states. A saved task is never a university submission or registration receipt.

## Operating Context

Local Windows pilot using a React PWA, Hono API and SQLite/D1. The official downloader supplies explicitly mapped PDF folders; Ollama provides local Q&A and OCR. The app also supports calendar-file import and allowlisted subscriptions. EN/DE/VI and light/dark/system themes are implemented.

## Capabilities and Constraints

- Today, tasks, calendar, courses, sources, assistant, settings and global search remain available.
- Preserve account isolation, records, source links, original quotations, OCR provenance and explicit failures/uncertainty.
- Foreground reminders need the app open; the offline shell does not cache private records.
- Calendar coverage is incomplete. Extracted dates require review. Missing material cannot support an answer.
- The redesign changes the interface and hierarchy; hosting, university integration and personal-workspace migration remain separate work.

## Brand Commitments

Keep the Gobbler name and existing mark. Voice is plain, calm and practical. The user authorized a whole-app revamp with ponytail and impeccable; visual choices are delegated for this implementation, with optional priority feedback requested.

## Evidence on Hand

Repository documentation, synthetic demo records and browser fixtures. Real academic records and credentials are private and must not be used in screenshots or committed design examples.

## Product Principles

- Put the next action before aggregate statistics.
- Show where information came from and what still needs checking.
- Keep secondary setup and maintenance available without crowding daily work.
- Make the same workflows usable on a narrow screen and by keyboard.

## Accessibility & Inclusion

Preserve localized controls, named dialogs, focus handling, reduced motion, readable contrast and verification labels that do not depend on color.
