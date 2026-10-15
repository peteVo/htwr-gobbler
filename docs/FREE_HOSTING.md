# Free hosting research · 15 October 2026

Recommendation: test **Netlify Free standard Node Functions + Turso Free** next. This is a researched candidate, not a deployed or benchmarked replacement. The student requested research rather than a paid Cloudflare upgrade. No new accounts/resources or personal-data uploads were made during this research.

## Comparison

| Candidate | Relevant current limits | Fit for Gobbler |
| --- | --- | --- |
| Netlify Free + Turso Free | Netlify has 300 monthly credits with a hard cap and no auto-recharge. Scheduled functions are available on all plans, with a 30-second execution limit. Turso offers SQLite-compatible storage: 5 GB, 500 million rows read and 10 million written/month on Free. | Best candidate for retaining the existing SQLite schema and implementing the API/scheduler in Node. Requires two accounts and a tested database adapter. |
| Supabase Free + static frontend hosting | 500 MB Postgres, 500,000 function calls; Edge Functions allow 2 seconds CPU/request. Low-activity projects can pause after seven days; automatic backups are not included on Free. Cron can invoke functions. | Technically plausible, but changing SQLite SQL/migrations to Postgres is a larger change. Pausing and manual backup operation remain concerns. |
| Vercel Hobby + a free database | Native Hobby cron runs each job at most once/day with hourly timing precision. | Does not directly meet the existing 30-minute monitoring requirement. An additional external scheduler adds another service and authenticated trigger. |
| Render Free | Web services sleep after 15 idle minutes, can take about a minute to wake and lose local filesystem changes. Free Postgres expires after 30 days. | Poor direct fit for durable academic records and frequent checks. An external database/scheduler would still be needed. |

Sources: [Netlify credits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/), [Turso pricing](https://turso.tech/pricing), [Supabase pricing](https://supabase.com/pricing), [function limits](https://supabase.com/docs/guides/functions/limits), [pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Render Free](https://render.com/docs/free).

## Illustrative Netlify budget

Using the current [published credit rates](https://www.netlify.com/pricing/), a 30-day planning scenario is:

| Assumption | Estimated credits |
| --- | ---: |
| Four production deployments at 15 credits each | 60 |
| 1,440 half-hour checks, averaging five seconds at 1 GB, at 10 credits/GB-hour | 20 |
| 3,000 interactive API calls, averaging one second at 1 GB | 8.33 |
| 1 GB web bandwidth | 20 |
| 10,000 total web requests, including API/assets | 2 |
| Total | 110.33 of 300 |

This is arithmetic from explicit assumptions, not measured Netlify usage or a guarantee. Retries, cold starts, other projects, traffic and larger PDF.js asset downloads can change it. Free credits are shared with other team usage. Production deployment frequency matters: 20 deployments alone would consume 300 credits before any traffic. Keep previews separate from published releases, avoid publishing on every development commit, and keep optional AI/Agent Runners out of this budget.

On Free, running out of credits pauses service until the next cycle unless the owner deliberately upgrades; see [paused projects](https://docs.netlify.com/manage/accounts-and-billing/billing/resume-paused-projects/). Free hosting cannot guarantee uninterrupted deadline monitoring. Configure usage notices and continue showing source freshness in Gobbler.

## Minimum implementation and validation

1. Keep React, the Hono routes, password hashing/recovery, feed encryption and MCP contract. Add standard Node function entry points, static headers and same-origin API routing. Do not use Netlify Edge Functions for this CPU-heavy workload.
2. Adapt the currently used D1 operations (`prepare/bind/first/all/run/batch`) to Turso's official client. Its [batch API](https://tursodatabase.github.io/libsql-client-ts/interfaces/Client.html#batch) provides atomic transactions. Validate all five migrations, JSON functions, uniqueness constraints, foreign keys, conditional recovery updates and rollback behavior against the actual selected Turso database/driver; compatibility is not yet established by a benchmark.
3. Replace the Cloudflare-only rate-limit binding and trusted client-IP handling with a tested Netlify-supported equivalent. Keep registration closed and secrets server-side.
4. Give each feed check a total deadline below the 30-second scheduled limit, including fetch retries, body reading, database work and failure recording. The current two 15-second fetch attempts can already exhaust that allowance; copying the existing scheduled handler unchanged is unsuitable. Start with the single-user/single-feed pilot.
5. Run local unit/API/browser checks, then deploy sample data after review. Test native duration, repeat imports, failure retention, rate limiting, cookie/session isolation, recovery and real scheduled invocations while the PC is off. Export and restore a remote backup.
6. Only after the sample gate passes and the reviewed host/data transfer is approved, regenerate a fresh tenant-only migration, preserve the recovery hash, re-encrypt the feed, migrate without sessions/MCP tokens, verify records and test Windows/Android. Do not reuse the Cloudflare migration's encryption key without an explicit secret-transfer plan.

The existing Cloudflare staging deployment remains synthetic-only, with registration closed and cron disabled. No paid upgrade is authorized. Netlify/Turso account eligibility, actual current account plans, region availability, latency and live scheduled delivery must be checked during setup. This recommendation favors the existing SQLite data model; it is an engineering judgment, not a provider uptime guarantee.
