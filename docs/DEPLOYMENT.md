# Deployment, when authorized

Nothing is deployed by the development setup. One Worker can serve the built PWA and API with one D1 database; clients then share an account and database across devices. The separate stdio MCP adapter runs in the AI client's environment and connects to that same API.

## Proposed private pilot — 15 October 2026

Use one Cloudflare Worker named `htwr-gobbler-staging` with bundled static assets and one D1 database named `gobbler-staging`. Cloudflare CLI sign-in is complete; no Gobbler database exists remotely. Start with the provider's HTTPS workers.dev address; no domain purchase, AI provider, object storage, email service or paid plan is included. The actual database ID and HTTPS origin must be resolved during approved provisioning. This is a proposal, not an approved or completed deployment.

Current [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) provides 100,000 free dynamic requests/day and 10 ms CPU per invocation. Current [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) provides 5 million rows read/day, 100,000 rows written/day and 5 GB total storage on Workers Free. Exceeding the D1 free allowance causes errors; it does not provide unlimited service. Workers Paid starts at $5 USD/month and requires a separate decision.

Planning estimate, not a deployed benchmark: one unchanged 226-event feed checked 48 times/day updates approximately 10,848 item rows/day, plus source metadata and index work. Allowing 100 interactive API requests/day gives about 148 handler invocations/day including cron, excluding retries and other account usage. Query scans, index maintenance, changed events, imports and abuse can increase actual use. A $0 infrastructure pilot is plausible only if the workload fits Free; account-wide use and native CPU measurements must be checked before launch. Password hashing, parsing and hashing 226 events may exceed the [10 ms CPU allowance](https://developers.cloudflare.com/workers/platform/limits/#cpu-time), including cron. Do not reduce password security to fit the free tier. Benchmark the real runtime before selecting a plan; do not silently upgrade.

Local evidence already available:

- File-to-feed conversion and two real fetches retained 230 personal academic records without duplicate calendar IDs or lost completion/module choices.
- All five schema migrations are applied locally. The identity migration preserved all records present at application time.
- A complete ignored SQL backup was restored to an in-memory SQLite database. All user/session/token/course/source/item/change/preference rows matched the original; foreign keys and the calendar uniqueness index were intact. The separately held feed key could decrypt restored feed credentials. This is a local restore test, not a remote D1 restore test.

Prepared for review:

1. Recovery keys and closed registration pass API/browser checks. The student saved a key outside Gobbler. Staging sets `REGISTRATION_OPEN=false`.
2. The ignored tenant-only migration contains one account, 12 modules, one encrypted feed, 230 academic items and 470 change records. It preserves IDs, dates, completion states, password and recovery-key hashes. Browser-test accounts, sessions and MCP tokens are excluded. No plaintext password or recovery key is exported.
3. Fresh staging session/feed secrets are generated separately from the database. The feed is re-encrypted and verified; a local rollback snapshot is retained. Restore into a fresh in-memory database passes foreign-key and count checks.
4. The prepared staging bundle passes `wrangler deploy --dry-run`. Its database ID and origin are deliberate placeholders. Scheduled checks are initially disabled. Secrets and private migration files remain ignored by Git.

Approval scope: create the named Free-plan staging Worker/database and deploy the reviewed app with registration closed. First use synthetic records to measure authentication/import CPU and verify HTTPS, cookies, rate limiting and isolation. Stop for a new decision if the Free allowance is unsuitable; do not weaken password hashing or enable billing. Only after that gate passes, upload the prepared personal workspace, verify its records and run a real feed check. Enable the existing 30-minute scheduler after successful smoke checks, then test Windows and Android against the same account. Back up the feed key separately and verify remote export/restoration before treating the pilot as dependable.

No remote resource creation, personal-data upload or deployment has occurred. Cloudflare login alone does not authorize those actions. Background push is a subsequent feature requiring a real device test.

## Deployment procedure

1. Sign in to your own Cloudflare account. Confirm current pricing and usage limits; do not enable billing without a deliberate decision.
2. Create a D1 database named `gobbler` and replace the all-zero development `database_id` in `wrangler.jsonc` with its actual ID.
3. Set `APP_ORIGIN` to the exact HTTPS application origin. Remove the loopback development value. Check the auth rate-limit binding and namespace in your account.
4. Generate strong, separate `SESSION_SECRET` and `FEED_SECRET`. Store them with `wrangler secret put SESSION_SECRET` and `wrangler secret put FEED_SECRET`, never in the repository. Back up the feed-encryption key securely: replacing it makes existing feed URLs unreadable and requires reconnecting them.
5. If external AI is wanted, separately configure `OPENAI_API_KEY` as a secret and `OPENAI_MODEL` as an explicit supported model ID. No default paid model is selected. Test costs and consent before use.
6. Run tests and build. Apply `wrangler d1 migrations apply gobbler --remote` to the intended database only after a backup and migration review. Then deploy with `pnpm deploy` when authorized.
7. Verify HTTPS cookie flags, account isolation, static-content headers, source failures, actual scheduled events, browser installation, and usage limits. Cron checks up to 10 feeds each run, prioritizing oldest attempts; it is not an unlimited per-user scheduler.

Before public release, add email ownership verification, a secure deletion workflow, operational monitoring/backups, deployed CPU/load measurements and an independent security review. Recovery without a previously saved key is not supported. Do not expose the local development server to a public network as a substitute for this process.

## Local cron check

Wrangler does not fire scheduled handlers automatically. With `pnpm dev` running, the documented local scheduled endpoint can be invoked manually:

```sh
curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled"
```

This checks configured real feeds if any are present. For deterministic tests, `tests/api.test.ts` uses an in-memory database and fake fetch responses instead of contacting a university account.
