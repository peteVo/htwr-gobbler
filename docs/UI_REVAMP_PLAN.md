# Workspace redesign · 23 October 2026

The user asked for a whole-app revamp with ponytail and impeccable, then confirmed all priorities: less clutter, easier discovery of the next task/deadline, a clearer assistant/materials workflow, and larger text throughout.

## Direction

An academic reading desk: a deep navy navigation rail, warm paper ground and clean reading surfaces, Source Sans 3 working text and Source Serif 4 page headings. Standard navigation, forms and calendar controls remain familiar. The visual signature is a clear, generous reading column for the work that needs attention. Brand geometry stays in the existing Gobbler mark.

This is an Operate surface, built directly in code. Product facts are recorded in `PRODUCT.md`. The implementation direction was delegated by the user; it is not a user-selected mockup. The Impeccable direction seed ran successfully; `seed:0f086f38f00d29f8` assigned the academic-journal candidate from the grounded direction list. Its material is expressed through palette, type and density, not a journal-shaped interface. Diagram/console/ticket costumes were declined because they weaken everyday task clarity; their useful discipline is clear state naming, navigation and aligned spacing.

## Completed implementation

1. Establish readable type: 17px working text, at least 14px supporting text, 16px controls, clear heading steps and generous line height. Self-host the EN/DE/VI font subsets. Keep light/dark/system themes and reduced motion.
2. Simplify the shell: one strong page heading, useful search, quieter workspace context, obvious navigation and compact account controls.
3. Recompose Today: concise attention summary followed immediately by assignments, then schedule, next actions, changes and source coverage. Remove duplicated metric tiles and decorative briefing artwork.
4. Recompose Assistant: prominent module/question/answer column; readable quotations and page evidence; a clearly separate material library and secondary import/setup controls.
5. Apply the same spacing, type and controls across tasks, calendar, courses, sources, settings, search and dialogs. Preserve status words, uncertainty, original evidence, completion/reopening and existing actions.

## Completed verification

The navy/warm reading-desk UI is implemented across Today, Assistant, tasks, calendar, courses, sources, settings, search and dialogs, with self-hosted Source Sans 3 working text and Source Serif 4 headings. Text sizes, EN/DE/VI and light/dark states follow the direction above. Today removes duplicate summary tiles and presents assignments and schedule as independent columns; Assistant separates the question/answer flow from the material library.

Strict TypeScript and production build passed; 86 code checks passed, with one non-Windows case skipped. All 37 full Windows/Edge browser scenarios passed before two mobile CSS refinements; after rebuilding, 11 focused Edge scenarios passed. Twenty-five synthetic captures covered view/state combinations, with minimum font-size and no-overflow checks at 320, 390, 768 and 1440px. Seventy-nine text-pair contrast checks in each theme had zero findings; the Impeccable design detector returned no findings in its single run. A fresh screenshot review found two mobile issues, which were corrected. After recapturing both corrected screens, the reviewer gave a ship verdict for those resolved findings, with no observed regressions in the recaptures. Preview ran on port 5273 because another application occupied 5173. One earlier post-CSS preview attempt was interrupted by an asset-watcher EPERM/404; restarting the preview resolved it, and the focused checks then passed.

Design tokens are documented separately in [design.md](../design.md) and `.impeccable/design.json`. This visual review does not claim a physical screen-reader test, a full accessibility audit, phone hardware validation, or new reboot, sleep or 24-hour backup observations.

Account/backend behavior, personal records, university connections, hosting, model setup and workspace migration are outside this interface change.
