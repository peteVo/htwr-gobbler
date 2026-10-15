# Deployment, when authorized

Nothing is deployed by the development setup. One Worker can serve the built PWA and API with one D1 database; clients then share an account and database across devices. The separate stdio MCP adapter runs in the AI client's environment and connects to that same API.

1. Sign in to your own Cloudflare account. Confirm current pricing and usage limits; do not enable billing without a deliberate decision.
2. Create a D1 database named `gobbler` and replace the all-zero development `database_id` in `wrangler.jsonc` with its actual ID.
3. Set `APP_ORIGIN` to the exact HTTPS application origin. Remove the loopback development value. Check the auth rate-limit binding and namespace in your account.
4. Generate strong, separate `SESSION_SECRET` and `FEED_SECRET`. Store them with `wrangler secret put SESSION_SECRET` and `wrangler secret put FEED_SECRET`, never in the repository. Back up the feed-encryption key securely: replacing it makes existing feed URLs unreadable and requires reconnecting them.
5. If external AI is wanted, separately configure `OPENAI_API_KEY` as a secret and `OPENAI_MODEL` as an explicit supported model ID. No default paid model is selected. Test costs and consent before use.
6. Run tests and build. Apply `wrangler d1 migrations apply gobbler --remote` to the intended database only after a backup and migration review. Then deploy with `pnpm deploy` when authorized.
7. Verify HTTPS cookie flags, account isolation, static-content headers, source failures, actual scheduled events, browser installation, and usage limits. Cron checks up to 10 feeds each run, prioritizing oldest attempts; it is not an unlimited per-user scheduler.

Before public release, add email verification and account recovery, a secure deletion workflow, operational monitoring/backups, deployed CPU/load measurements and an independent security review. Do not expose the local development server to a public network as a substitute for this process.

## Local cron check

Wrangler does not fire scheduled handlers automatically. With `pnpm dev` running, the documented local scheduled endpoint can be invoked manually:

```sh
curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled"
```

This checks configured real feeds if any are present. For deterministic tests, `tests/api.test.ts` uses an in-memory database and fake fetch responses instead of contacting a university account.
