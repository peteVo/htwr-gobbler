# Recovery and local updates

## Restore missing academic records

In **Settings → Your data**, use **Export my records** to download your account's JSON records. Keep the file somewhere you can recover if this PC is lost. It contains private coursework and source links; it excludes passwords, recovery keys and calendar subscription credentials.

Choose that file under **Restore missing records**. Gobbler validates the file locally and shows a count preview before sending anything to the server. Cancel leaves the workspace unchanged. Confirming inserts missing records in one transaction; existing records keep their current title, date, module and completion state. Repeating the same export skips existing identities. File limits are 2 MB, 200 courses, 2,000 dated items, 500 actions and 50 sources; invalid IDs, missing relationships and unsafe links are rejected.

New dated records retain their saved completion status but require date verification. Restored calendars appear as unchecked file sources with their event IDs intact. To resume automatic checks, use **Sources → Connect Moodle calendar → Replace file import**, selecting the restored source. This preserves identities and avoids a second calendar copy. Sources already present in the account are kept unchanged. Source history and account preferences are not restored by this feature. No university registration or submission is performed.

This is a merge of missing records, not a destructive rollback or account recovery. It does not recover forgotten passwords, secrets, connected-feed credentials or entire Windows installations. Use your saved recovery key for account access. Automated full-database backups still protect local records and matching encryption secrets; see [local backups](LOCAL_USE.md).

## Make a verified full local backup

```powershell
pnpm local --backup
```

This works while the installed runner is active. It uses the online SQLite backup API and the same verification/retention routine as automatic backups. It prints only verification and creation time; manual/update copies stay in the protected, ignored `.wrangler/local/manual-backups` directory. The seven manual copies are separate from the seven automatic copies in `.wrangler/local/backups`, so maintenance does not consume automatic retention slots. Backups contain all local accounts and encryption secrets, so they must not be exposed through an ordinary user's web session. No raw database/secret download endpoint was added.

Use `pnpm local --verify <backup-folder>` to verify an existing full backup without overwriting the live workspace. Full rollback remains an operator operation with the app stopped, preserving the current files and restoring the database together with matching secrets. No live database rollback was rehearsed on personal records.

## Install a local code update on Windows

After the intended code revision is available in this checkout, run:

```powershell
./scripts/local-update.ps1 -Action Check
./scripts/local-update.ps1 -Action Apply
```

Check inspects prerequisites without changing anything. Apply requires a clean checkout and installed local startup setup. It rejects unrelated listeners on Gobbler's ports and verifies the saved runner belongs to this checkout before stopping any process. Close separately started development terminals first.

Apply creates and verifies a full backup, stops only the identified runner tree, installs locked dependencies, runs unit/API checks, builds the app, applies local migrations and starts the hidden launcher. It verifies API availability, the finished-build gateway and a fresh runner heartbeat. Open Gobbler afterward and check your records, Sources, monitoring and reminders. The app keeps the same origin at port 5173, so existing cookies and browser notification permissions remain associated with it.

The script does not fetch code, switch branches, reset files, merge the draft PR, change billing or deploy anything. It operates on the revision already present. If a check fails, it stops with the verified backup retained; it does not guess a rollback across schema or dependency changes. Resolve the failure before restarting. On other operating systems, the documented install/test/build/migrate steps remain manual; the Windows startup/update script is platform-specific.

On 17 October 2026, the procedure was rehearsed on this PC: a verified backup, frozen install, 64 passing checks, production build, local migration check and hidden restart completed. The first readiness probe was corrected to reuse the runner's public auth-options endpoint. After the successful rehearsal, 230 personal items, 226 connected feed events, zero duplicate event IDs and the saved recovery configuration were verified; runner heartbeat/check/backup status remained healthy. No personal records were rolled back or imported during the rehearsal.
