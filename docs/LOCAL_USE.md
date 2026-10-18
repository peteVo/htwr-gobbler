# Local Gobbler

Open http://127.0.0.1:5173/. The Windows startup action runs the local app, calendar checks and daily backups quietly after signing in to Windows. It does not open a browser automatically. Sources and Settings show the runner's heartbeat, last automatic check and last verified backup. A stopped runner, failed check or failed backup is shown explicitly.

## Installed behavior

Reminder timing and deadline-change options are in Settings → Reminders. Enable browser permission and use Send test notification to verify visible delivery. The local runner checks sources while the browser is closed, but notifications still need Gobbler open; see [reminders](REMINDERS.md). The reminder preference migration is additive and preserves existing accounts' 1-day lead time.

- The current user's Startup folder contains `Gobbler.lnk`, pointing to a hidden launcher in this checkout's ignored `.wrangler/local` folder. It runs `pnpm local`'s equivalent with the installed Node executable. It requires this checkout and its dependencies to remain in place; reinstall startup after moving the checkout or changing Node's installation path.
- Servers bind to loopback only at ports 5173 and 8787. The runner serves the finished `dist` build through a local gateway at 5173; Wrangler's local runtime at 8787 supplies the API and built assets. Vite's development server is reserved for `pnpm dev`. Existing matching servers are reused; a development server at 5173 is rejected by the daily runner. A PID lock prevents duplicate runners; restarting the startup action does not start another copy.
- Only the configured personal workspace's connected subscriptions are checked. Synthetic browser-test accounts are excluded. Manual uploads are not polled. Connected local PDF folders are checked every minute, with three new/changed documents per course per pass. See [Assistant](ASSISTANT.md) for one-time folder mapping and the optional Windows task that launches the official RWTH downloader every 30 minutes. Local file health does not establish Moodle download freshness. A due-feed scan runs every minute; each feed is eligible every 30 minutes. After sleep, overdue checks run when execution resumes. Missed intervals are not replayed as a burst.
- The app refreshes records every minute while visible and signed in, and when focus/connectivity returns. Editing dialogs pause this refresh. Existing source errors, last-success timestamps and one-hour stale indicators remain authoritative.
- Checks continue with the browser closed while the runner is active, the PC is awake and Windows remains signed in. Notifications still require the browser app to be open. There is no phone push, cloud monitoring or wake-from-sleep guarantee.

## Automatic backups

Before the first automatic check, then every 24 hours of elapsed time while running, an online SQLite snapshot is created under `.wrangler/local/backups`. Each completed folder contains:

- `workspace.sqlite`: a consistent full local database, including all local accounts, record IDs, modules, dated items, undated next actions, completion, password/recovery hashes and session/token hashes.
- `secrets.json`: the matching local session and feed encryption secrets. It contains no plaintext account password or recovery key. The feed secret is necessary to restore connected subscriptions.
- `manifest.json`: creation time, table counts and a SHA-256 database checksum.

Every snapshot is opened as an independent restored copy. Integrity, foreign keys, table counts and encrypted feed decryption are verified before it becomes a completed backup. Only then are older completed backups pruned to retain seven. Failed backups preserve the previous good copies, report failure and retry after an hour. Never copy only a live SQLite file while omitting its WAL; the online snapshot handles active writes.

The installer restricts `.wrangler/local` to the current Windows user and SYSTEM. Backups contain private data and secrets, are not encrypted at rest by Gobbler, and remain outside Git. They protect against accidental changes, not loss of the disk/PC or access through the same Windows account. An off-device encrypted backup is separate work.

To recheck a completed backup without replacing the live database:

```powershell
pnpm local --verify .wrangler/local/backups/<timestamp-folder>
```

The command reports verification/counts only and removes its temporary restored copy. For an actual rollback, first stop the runner and local servers, preserve the current database and secrets, then restore the selected database together with its matching secrets and verify the account/feed before resuming checks. Do not overwrite an open database or replace feed secrets independently. This workflow has verified recovery into a separate copy; no live rollback was performed.

## Operator setup and removal

For manual verified backups, record restoration and the repeatable local update command, see [recovery and updates](RECOVERY_AND_UPDATES.md). The JSON restore in Settings preserves current records and excludes account/feed secrets; it is separate from full database rollback.

For another Windows checkout, install dependencies, create separate strong `.dev.vars` secrets, apply all migrations, run `pnpm build` and create the account/feed first. Run this once with that account's UUID:

```powershell
./scripts/windows-startup.ps1 -UserId <account-uuid>
```

The UUID selects whose feed checks run; it is not a password or token. The installer can be rerun without `-UserId` to refresh the shortcut and permissions. Start the installed action from the Windows Startup folder, or run `pnpm local` in a terminal. Control-C stops a terminal runner. Check Sources/Settings to confirm a current heartbeat. Failure logs for spawned local servers are in `.wrangler/local/runtime.log`.

To remove automatic Windows sign-in startup:

```powershell
./scripts/windows-startup.ps1 -Remove
```

Removal does not delete records/backups or stop an already running process. Local databases and secrets must stay outside Git. No hosting resources or billing are changed by these commands.

## Installation and update support

| Environment                    | Start and update                                             | Status                                                                             |
| ------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Windows, Node 24, pnpm 11.25.0 | Installed sign-in launcher; `local-update.ps1 -Action Apply` | Daily-use target; finished build, monitoring and backups                           |
| Windows manual operation       | `pnpm build`, then `pnpm start`                              | Finished app and API only; no scheduled checks/backups                             |
| Linux, Node 24, pnpm 11.25.0   | Install, migrate, build, then `pnpm start`                   | Browser workflow checked in CI; startup and backup scheduling require manual setup |
| macOS                          | Same manual commands                                         | Not verified on hardware                                                           |
| Development                    | `pnpm dev`                                                   | Live source updates; no scheduled checks/backups                                   |

Keep `dist` in place for daily startup. After editing code, use the documented update procedure to rebuild and restart; edits do not automatically appear in the finished app. The gateway preserves the app origin, API cookies, reminder permissions and service-worker address. HTML and the service-worker script are served without HTTP caching so a reload can pick up a new build; hashed assets remain cacheable. Private API responses retain their no-store policy. The local status endpoint exposes only the seven monitoring fields (runner heartbeat, calendar check time/failure, backup time/failure and material check time/failure) and is never cached. The gateway accepts only its loopback Host address, and forwards requests only to the fixed local backend.

This is a finished frontend build on the existing local development backend runtime, not a separately packaged native application or hosted production backend. Neither port is exposed to the network.

## Verified on this PC

The installed hidden startup action was launched, corrected and verified to remain active. A second launch retained the same runner. The first real snapshot passed restoration checks, and the real Moodle feed remained connected: 226 calendar events, 230 personal records and zero duplicate UIDs; the saved recovery hash remained present. Folder permissions were inspected. All 51 unit/API/backup checks and 14 browser scenarios passed, with strict type-check and production build.

A cold-start check stopped only the identified Gobbler runner and dev-server process trees, then launched the installed startup action. It recreated both loopback servers successfully, reported a fresh heartbeat and preserved all personal records and recovery configuration. A complete Windows sign-out/reboot, 24-hour timed backup rotation and physical sleep/resume have not been observed. Rotation and corruption/incorrect-key handling are covered by controlled tests.

On 16 October, the student reported shutdown/startup and short sleep/wake tests. Fresh startup processes, responding servers, advancing heartbeats and the same personal records/recovery configuration were verified. A controlled 31-minute clock advance tests overdue-feed eligibility without replaying missed intervals. A physical sleep spanning a due check and a real 24-hour backup interval remain unobserved. The next-action migration is additive; new backup manifests count actions, and older snapshots without that table remain verifiable.
