# Handoff: Analytics package split + MCP product telemetry

**Branch:** `cursor/analytics-collect-auth`  
**Last verified:** 2026-05-28 — **46 tests pass** in telemetry + rate-limit suite (see Verification)  
**Timeline:** #107 (merged) → #108 P0 hardening (merged) → **#109 open** (this branch)

---

## Status

| Phase | State |
|-------|--------|
| #107 MCP PostHog + server capture package | ✅ merged |
| #108 P0 runtime merge, /events 503, PostHog host allowlist | ✅ merged |
| **#109 P0-A `/collect` HMAC auth + trusted OSS runtime** | ✅ **this branch** |
| **#109 P0-B XFF trust for rate limiting** | ✅ **this branch** |
| P1 single-flight instance ID + eager bootstrap | ✅ **this branch** |
| P1 dedupe/coalesce, dup connection query, async collect | ⏳ deferred |
| P2 dedicated HMAC secret (no BETTER_AUTH fallback) | ⏳ deferred |
| P3 maintainability cleanups | ⏳ deferred |

**Start new work from:** `git fetch origin && git checkout -b <branch> origin/main`

---

## Completed on this branch

### P0-A — `/collect` authentication

- New env: `DURABULL_TELEMETRY_COLLECT_SECRET` — shared HMAC signing secret for OSS → cloud `/collect`.
- `packages/analytics/src/server/collect-auth.ts` — webhook-style `sha256=` signatures with 5-minute tolerance.
- `/collect` requires valid signature headers; unsigned → **401**.
- Collect payload includes top-level `runtime` (required). Cloud ingest uses **authenticated client runtime**, not cloud server runtime.
- OSS forward signs batches and sends `runtime` separately from event properties.

**Deploy note:** Cloud and self-hosted installs need matching `DURABULL_TELEMETRY_COLLECT_SECRET` before ship, or OSS→cloud forwarding stops (console warning).

### P0-B — XFF trust (rate limiting)

- New env: `TRUST_PROXY` (optional). Auto-enabled when `DURABULL_CLOUD=true`.
- `getClientKey` / MCP ingress keys ignore `X-Forwarded-For`, `X-Real-IP`, and `CF-Connecting-IP` unless proxy is trusted.
- Removed production bypass for `unknown-client` — untrusted ingress shares one bucket instead of skipping limits or minting per-spoofed-IP keys.
- Tests: `apps/api/src/middleware/rate-limit.test.ts` (3 cases).
- Docs: `security-and-hardening.mdx` updated.

### P1 (partial) — Single-flight instance ID

- `resolveAnonymousInstanceId` deduplicates concurrent DB reads via in-flight promise.
- Eager warm at `bootstrapServerAnalytics()` in production (non-blocking).

---

## Remaining work (one PR each recommended)

### P1 — Performance

| Task | Files | Notes |
|------|-------|-------|
| Single-flight instance ID | `configure-server-analytics.ts`, `app.ts` | ✅ done this branch |
| Dedupe/coalesce PostHog when same project | `mcp-analytics.ts`, `capture.ts` | One `sendPosthogBatch` per MCP event when keys match |
| Remove duplicate connection access DB query | `policy-engine.ts`, `mcp-policy-middleware.ts`, `tools/shared.ts` | Set `mcpResolvedConnection` once after grant |
| Async `/collect` flush | `telemetry.ts`, `capture.ts` | Bounded worker like MCP analytics queue |

### P2 — Security hardening

| Task | Notes |
|------|-------|
| Require `DURABULL_TELEMETRY_HMAC_SECRET` in prod collect mode | Remove `BETTER_AUTH_SECRET` fallback |
| Clamp/ignore client `timestamp` on collect | Anti-replay enrichment |
| Browser `client.ts` runtime merge | Before `/events` |

### P3 — Maintainability

See original handoff §4 P3 table (barrel exports, `McpPrincipalType`, shared queue helper, etc.)

---

## Verification commands

```bash
bun test \
  packages/analytics/src/server/collect-auth.test.ts \
  packages/analytics/src/server/validate.test.ts \
  packages/analytics/src/server/identifiers.test.ts \
  packages/analytics/src/server/posthog-batch.test.ts \
  apps/api/src/routes/telemetry.test.ts \
  apps/api/src/routes/telemetry-collect.test.ts \
  apps/api/src/mcp/observability/mcp-analytics.test.ts \
  apps/api/src/middleware/rate-limit.test.ts
```

**Expected:** 46 pass.

**Gotcha:** `apps/api/src/app.test.ts` may fail locally with `CI=true` or missing `MCP_AUTHLESS_BEARER_TOKEN` — not a telemetry regression.

---

## Environment reference

| Variable | Purpose |
|----------|---------|
| `DURABULL_TELEMETRY_COLLECT_SECRET` | HMAC signing for `/collect` batches (OSS + cloud) |
| `TRUST_PROXY` | Honor forwarding headers for rate limits (auto on `DURABULL_CLOUD`) |
| `DURABULL_TELEMETRY_HMAC_SECRET` | distinct_id / instance_key HMAC |
| `DURABULL_TELEMETRY_POSTHOG_KEY` | Durabull product PostHog key |
| `DURABULL_TELEMETRY_POSTHOG_HOST` | Batch ingest host (HTTPS allowlist) |
| `DURABULL_CLOUD` | Enables `/collect` on cloud API + trusted proxy |

---

## Lessons

- **Do not `git stash` to peek while holding uncommitted work** — a failed pop can silently strip edits. Use a worktree or WIP commit instead.

---

## Definition of done (#109)

P0 complete ✅ — parallel review + PR still needed before merge claim.
