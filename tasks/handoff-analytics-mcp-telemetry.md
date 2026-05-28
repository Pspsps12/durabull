# Handoff: Analytics package split + MCP product telemetry

**Branch:** `cursor/analytics-collect-auth` (PR #110)  
**Last verified:** 2026-05-28 — run full suite after merge with `main` (see Verification)  
**Timeline:** #107 → #108 → #109 (merged to `main`) → **#110 open** (collect auth + XFF trust)

---

## Status timeline

| Stage | What shipped | State |
|-------|--------------|-------|
| **PR #107** | Server capture package + MCP PostHog telemetry | ✅ merged |
| **PR #108** | P0: server runtime on `/collect`, `/events` preflight, PostHog host allowlist | ✅ merged |
| **PR #109** | MCP org `$groups` fix, fetch timeouts, single-flight instance id, timestamp clamp, hygiene | ✅ merged |
| **PR #110** | P0-A `/collect` HMAC auth + trusted OSS runtime; P0-B XFF/proxy trust for rate limits | 🚧 **this branch** |

**Lesson:** Branch from latest `origin/main` before starting. PR #109 merged while #110 was in flight — rebase/merge required.

---

## Completed on PR #110

### P0-A — `/collect` authentication

- `DURABULL_TELEMETRY_COLLECT_SECRET` — HMAC-signed batches (`collect-auth.ts`)
- Unsigned/invalid → **401**; top-level `runtime` required; cloud uses authenticated client runtime
- OSS forward signs batches (preserves deployment attribution without reopening spoof hole)

### P0-B — Rate-limit proxy trust

- `TRUST_PROXY` (auto on `DURABULL_CLOUD`); ignore spoofable headers on untrusted ingress
- Trusted priority: CF-Connecting-IP → X-Real-IP → rightmost XFF hop

### Also merged from #109 (via `main`)

- Timestamp clamp ±24h on `/collect`
- Fetch timeouts + `redirect: 'manual'` on forward
- Single-flight + eager instance id warm
- MCP org `$groups` single-hash fix

### Parallel review on #110

Fixed Critical/High: poisoned inflight promise, XFF leftmost spoof, collect secret decoupled from ingest config, `/events` fire-and-forget (202 always), `apiRateLimiter` retryAfter.

---

## Remaining deferrals

| Priority | Item |
|----------|------|
| P1 | ✅ Done on `main` (2026-05-28): PostHog dedupe/coalesce, delegated connection query de-dup, async `/collect` queue, bounded `/events` queue |
| P2 | Dedicated `DURABULL_TELEMETRY_HMAC_SECRET` (drop `BETTER_AUTH_SECRET` fallback), signature replay LRU |
| P3 | Barrel migration, shared queue helper, telemetry signal docs |

**Parallel review loop:** Pass 1 found High items in `/events` backpressure, MCP RPC identity, policy/tools layering, and MCP analytics drop visibility. Fixed them, reran four-lens review, and pass 2 reported **no Critical/High issues**.

---

## Verification

```bash
bun test \
  packages/analytics/src/server/collect-auth.test.ts \
  packages/analytics/src/server/capture.test.ts \
  packages/analytics/src/server/validate.test.ts \
  packages/analytics/src/server/identifiers.test.ts \
  packages/analytics/src/server/posthog-batch.test.ts \
  apps/api/src/mcp/observability/mcp-analytics-queue.test.ts \
  apps/api/src/mcp/tools/shared.test.ts \
  apps/api/src/routes/telemetry-events-queue.test.ts \
  apps/api/src/routes/telemetry.test.ts \
  apps/api/src/routes/telemetry-collect.test.ts \
  apps/api/src/mcp/observability/mcp-analytics.test.ts \
  apps/api/src/middleware/rate-limit.test.ts
```

**Gotcha:** `apps/api/src/app.test.ts` fails in sandbox with `CI=true` / missing `MCP_AUTHLESS_BEARER_TOKEN`.

---

## Environment reference

| Variable | Purpose |
|----------|---------|
| `DURABULL_TELEMETRY_COLLECT_SECRET` | HMAC signing for `/collect` (OSS + cloud) |
| `TRUST_PROXY` | Honor forwarding headers for rate limits |
| `DURABULL_TELEMETRY_HMAC_SECRET` | distinct_id / instance_key HMAC |
| `DURABULL_CLOUD` | Enables `/collect` + trusted proxy |

---

## Lessons

- **Always `git fetch origin main` and rebase/merge before opening a telemetry PR** — parallel PRs (#109 vs #110) touched the same files.
- **Do not `git stash` to peek** while holding uncommitted work — use a worktree or WIP commit.
