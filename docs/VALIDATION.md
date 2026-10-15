# Validation · 15 October 2026

## Executed locally

- TypeScript strict type-check and Vite production build pass.
- 34 Vitest checks pass against pure core logic and the actual migration/SQL in in-memory SQLite. Coverage includes tenant isolation, course ownership, protected cookies, revocation, read-only tokens, unsafe URLs, invalid dates, canonical UTC dates, source locks, feed retry, encrypted credentials, import/reimport/change/failure, cancellations, DST, six-row months, PDF text date candidates, and quiet hours.
- Nine Playwright scenarios pass in headless Microsoft Edge on Windows: persisted personal-workspace CRUD/import/completion/preferences; real stdio MCP query against the local Worker; real PDF text extraction with page evidence and no external AI call; failed-check source-health refresh; and dashboard/calendar navigation at 320, 375, 414, 768 and 1280 pixels.
- Local D1 migration applied successfully. The browser workflow confirms database persistence across reloads; the MCP query reads the same Worker/D1 backend.
- Built assets served from Wrangler at port 8787. Service worker registration/control, offline shell reload, absence of cached API responses, and layout width checks verified in a real browser.
- Desktop/mobile screenshots visually inspected. Light and dark token-pair contrast checks meet 4.5:1 for tested text pairs. Keyboard focus styles, native modal focus/Escape, labels and reduced-motion styles are included; a complete assistive-technology audit is not claimed.
- Frozen dependency install succeeds. Source files were formatted; no secrets/local databases are committed. The Cloudflare peer type version was aligned with Wrangler.

## Not established

No real RWTH credentials or calendar feed were used. Scheduled feed ingestion was exercised with controlled test fetches and real SQL, not a live university account. No OpenAI request was made. Browser permission denial is handled in code, but actual OS notification delivery and Android/Linux installation were not tested on physical devices. Full cross-device behavior depends on a shared deployed backend; local loopback development does not provide remote-device access.

The GitHub Actions workflow is included; its hosted result must be checked after push. No production deployment, paid provisioning, load test, full security audit or external penetration test was performed. Build output contains harmless dependency comment-annotation warnings from Zod; compilation and bundling complete.
