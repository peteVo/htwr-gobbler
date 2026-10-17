# Local Gobbler

Open http://127.0.0.1:5173/. The Windows startup action runs the local app, calendar checks and daily backups quietly after signing in to Windows. It does not open a browser automatically. Sources and Settings show the runner's heartbeat, last automatic check and last verified backup. A stopped runner, failed check or failed backup is shown explicitly.

## Installed behavior

Reminder timing and deadline-change options are in Settings → Reminders. Enable browser permission and use Send test notification to verify visible delivery. The local runner checks sources while the browser is closed, but notifications still need Gobbler open; see [reminders](REMINDERS.md). The reminder preference migration is additive and preserves existing accounts' 1-day lead time.

- The current user's Startup folder contains `Gobbler.lnk`, pointing to a hidden launcher in this checkout's ignored `.wrangler/local` folder. It runs `pnpm local`'s equivalent with the installed Node executable. It requires this checkout and its dependencies to remain in place; reinstall startup after moving the checkout or changing Node's installation path.
- Servers bind to loopback only at ports 5173 and 8787. Existing matching local servers are reused. A PID lock prevents duplicate runners; restarting the startup action does not start another copy.
- Only the configured personal workspace's connected subscriptions are checked. Synthetic browser-test accounts are excluded. File uploads are not polled. A due-feed scan runs every minute; each feed is eligible every 30 minutes. After sleep, overdue checks run when execution resumes. Missed intervals are not replayed as a burst.
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

For another Windows checkout, install dependencies, create separate strong `.dev.vars` secrets, apply all migrations and create the account/feed first. Run this once with that account's UUID:

```powershell
./scripts/windows-startup.ps1 -UserId <account-uuid>
```

The UUID selects whose feed checks run; it is not a password or token. The installer can be rerun without `-UserId` to refresh the shortcut and permissions. Start the installed action from the Windows Startup folder, or run `pnpm local` in a terminal. Control-C stops a terminal runner. Check Sources/Settings to confirm a current heartbeat. Failure logs for spawned local servers are in `.wrangler/local/runtime.log`.

To remove automatic Windows sign-in startup:

```powershell
./scripts/windows-startup.ps1 -Remove
```

Removal does not delete records/backups or stop an already running process. Local databases and secrets must stay outside Git. No hosting resources or billing are changed by these commands.

## Verified on this PC

The installed hidden startup action was launched, corrected and verified to remain active. A second launch retained the same runner. The first real snapshot passed restoration checks, and the real Moodle feed remained connected: 226 calendar events, 230 personal records and zero duplicate UIDs; the saved recovery hash remained present. Folder permissions were inspected. All 51 unit/API/backup checks and 14 browser scenarios passed, with strict type-check and production build.

A cold-start check stopped only the identified Gobbler runner and dev-server process trees, then launched the installed startup action. It recreated both loopback servers successfully, reported a fresh heartbeat and preserved all personal records and recovery configuration. A complete Windows sign-out/reboot, 24-hour timed backup rotation and physical sleep/resume have not been observed. Rotation and corruption/incorrect-key handling are covered by controlled tests.

On 16 October, the student reported shutdown/startup and short sleep/wake tests. Fresh startup processes, responding servers, advancing heartbeats and the same personal records/recovery configuration were verified. A controlled 31-minute clock advance tests overdue-feed eligibility without replaying missed intervals. A physical sleep spanning a due check and a real 24-hour backup interval remain unobserved. The next-action migration is additive; new backup manifests count actions, and older snapshots without that table remain verifiable.
