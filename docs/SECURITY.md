# Security and privacy boundaries

## Implemented

- Every academic API route requires an account session or, for selected GET routes only, a scoped read-only token. All record queries are tenant-scoped. Foreign course ownership is checked before writes. SQL uses bound parameters.
- Passwords use PBKDF2-SHA256 with random per-user salts and 100,000 iterations, the Workers Web Crypto supported ceiling. Validate deployed CPU cost and consider a stronger supported authentication service before public release.
- Sessions use signed HS256 tokens plus a server-side revocation record; cookies are HttpOnly, SameSite=Strict, Secure under HTTPS, expire after seven days, and are removed/revoked on logout. Local HTTP is loopback only.
- Authentication routes use a configured edge rate limiter (10 attempts per minute per source IP). Shared university networks may hit this threshold. API keys and subscription URLs are never put into logs by application code.
- Recovery keys require current-password reauthentication to generate or rotate. Only a SHA-256 digest is retained. A key can reset the password once; successful recovery atomically consumes it and revokes sessions and MCP tokens. In-flight sign-in/token issuance checks the current password/session version. Keep the key outside Gobbler. The private pilot disables new account registration with `REGISTRATION_OPEN=false`.
- Same-origin write checks block cross-site requests. External source links accept HTTP(S) only. Production static assets include restrictive content security and anti-framing headers.
- Calendar subscription URLs are AES-GCM encrypted with fresh nonces and an operator-held secret, never returned in API snapshots. Only the exact HTTPS Moodle calendar endpoint is fetched, without redirects, bounded by timeout and size.
- Imports use atomic batches, stable external IDs, hashes, per-source check locks, retained old data on failure, and explicit last-success/error information. Lack of an entry in a rolling feed is not treated as proof of deletion.
- PDFs are parsed locally. Reading a PDF does not send its text to the server. External AI receives text only after explicit consent. Source evidence must occur in that text; candidates remain unverified until a person reviews them.
- Service worker caches app-shell assets only; API routes bypass it. Private records and provider keys are not stored in browser offline caches. Notification suppression stores only account/event identifiers in localStorage.
- Read-only MCP tokens are random, stored hashed, expire after 30 days, and can all be revoked in Settings. No cookie or RWTH password must be copied into an AI client.
- Secrets, local database files, generated test results and build output are ignored by Git.
- The Windows local runner checks only its configured account and keeps seven verified online SQLite backups. These contain private records and matching session/feed secrets; the installer restricts the local operations folder to the Windows user and SYSTEM. Gobbler does not encrypt these backups at rest. Full-disk loss is outside local backup protection; see LOCAL_USE.md.

## Still required for public release

Email ownership verification, secure account/data deletion, deployed resource/abuse limits beyond login, operational alerts, remote backups/restore, a review of dependency vulnerabilities, and independent penetration/security testing. Account creation currently does not verify email ownership. Lost passwords without a previously saved recovery key have no self-service recovery path. The app is a tested development MVP, not a completed identity service.

The university remains authoritative for deadlines and submission receipts. Calendar-only coverage, explicit date extraction, stale sources, and unsupported recurrence are surfaced as limitations rather than hidden.
