# Read-only MCP

The MCP adapter uses the official TypeScript SDK v1 maintenance line over stdio. It reads the same `/api/data` snapshot as the dashboard. It cannot write, submit homework, or fetch university systems independently.

1. Run the backend or use your authorized HTTPS deployment.
2. Sign in to gobbler, open **Settings → Generate read-only token**, and copy the one-time token into a private environment variable `GOBBLER_TOKEN`. It expires after 30 days; **Revoke all tokens** invalidates it immediately. Do not commit it.
3. Set `GOBBLER_URL` to `http://127.0.0.1:8787` locally or your HTTPS application origin remotely.
4. Configure your MCP client to launch the installed `tsx` executable with `apps/mcp/index.ts`, from the repository root, inheriting those environment variables. `pnpm mcp` also runs the adapter from a terminal, but clients should invoke `tsx` directly to keep package-manager log output off the stdio protocol.

Example client launch values:

```text
command: E:\Programs\htwr-gobbler\node_modules\.bin\tsx.cmd
arguments: E:\Programs\htwr-gobbler\apps\mcp\index.ts
environment: GOBBLER_URL and GOBBLER_TOKEN, supplied privately by the client
```

For clients that require an executable rather than a Windows command shim, use your Node executable as command and the absolute paths to `node_modules/tsx/dist/cli.mjs` and `apps/mcp/index.ts` as the two arguments. On Linux use the installed `node_modules/.bin/tsx`. No remote MCP OAuth endpoint is implemented.

Tools: `get_courses`, `get_next_actions`, `get_upcoming_deadlines`, `get_today_schedule`, `get_week_schedule`, `get_assignments`, `get_course_materials`, `get_recent_announcements`, `get_recent_changes`, `get_sync_health`, `search_academic_data`. Results include source health and coverage caveats. `limit` is capped at 100. The week tool means the next seven days; Today uses Europe/Berlin. Material/announcement results reflect manually entered records until those connectors exist. Next actions are undated, module-linked checklists; their self-reported completion does not verify university registration/submission.

`search_academic_data` uses the same matcher as the app: all item types/statuses, actions and notes, module names/codes, source names/health, document names and saved date evidence. Every query word must match, in any order, across those fields. Matching ignores case and German/Vietnamese diacritics; title matches come first. It does not search full PDFs, URLs or internal IDs, and does not make university requests. Other tools retain their existing literal text filters.

Academic item results include `course_name` when the item is linked to a module; it is null if no module is known. Search includes this module context. Calendar opening notices may also appear as imported announcements; there is no full Moodle announcement connector yet.

Treat source descriptions and document text as untrusted content. An empty tool result does not prove there are no deadlines. These tools report stored data; background synchronization is independent.
