# Handoff: Analytics package split + MCP product telemetry

**Branch:** `main` (P2 landed locally; open PR when ready)  
**Last verified:** 2026-05-28 — run full suite after merge with `main` (see Verification)  
**Timeline:** #107 → #108 → #109 → #110 → #112 (all merged) → **P2 complete** → P3 next

---

## Status timeline

| Stage | What shipped | State |
|-------|--------------|-------|
| **PR #107** | Server capture package + MCP PostHog telemetry | ✅ merged |
| **PR #108** | P0: server runtime on `/collect`, `/events` preflight, PostHog host allowlist | ✅ merged |
| **PR #109** | MCP org `$groups` fix, fetch timeouts, single-flight instance id, timestamp clamp, hygiene | ✅ merged |
| **PR #110** | P0-A `/collect` HMAC auth + trusted OSS runtime; P0-B XFF/proxy trust for rate limits | ✅ merged |
| **PR #112** | P1: PostHog dedupe/coalesce, connection query de-dup, async `/collect` queue, bounded `/events` queue | ✅ merged |
| **P2 (local)** | Dedicated `DURABULL_TELEMETRY_HMAC_SECRET`; `/collect` signature replay LRU | ✅ done |

**Lesson:** Branch from latest `origin/main` before starting. Parallel PRs (#109 vs #110) touched the same files — rebase/merge required.

---

## Completed on P2

### Dedicated telemetry HMAC secret

- `configure-server-analytics.ts` now uses **only** `DURABULL_TELEMETRY_HMAC_SECRET` for distinct_id / instance_key HMAC.
- `BETTER_AUTH_SECRET` fallback removed — cloud/OSS deploys must set the dedicated secret explicitly.
- `POSTHOG_KEY` fallback for Durabull telemetry PostHog key remains unchanged.

### `/collect` signature replay protection

- `collect-auth.ts`: bounded in-process replay LRU (4096 entries, TTL = signature tolerance window).
- Replayed signatures within ±300s return `{ ok: false, error: 'replay' }` → route responds **401**.
- `resetTelemetryCollectReplayCacheForTests()` exported for test isolation.

---

## Remaining deferrals

| Priority | Item |
|----------|------|
| P1 | ✅ Done (PR #112): PostHog dedupe/coalesce, delegated connection query de-dup, async `/collect` queue, bounded `/events` queue |
| P2 | ✅ Done (2026-05-28): Dedicated `DURABULL_TELEMETRY_HMAC_SECRET`, signature replay LRU |
| P3 | Barrel migration, shared queue helper, telemetry signal docs |

**Parallel review loop (P2):** Pass 1 found Medium replay-cache TTL misalignment and unguarded test reset exports. Fixed both, plus off-by-one at tolerance boundary. Pass 3 reported **no Critical/High issues**.

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
| `DURABULL_TELEMETRY_HMAC_SECRET` | **Required** for distinct_id / instance_key HMAC (no auth-secret fallback) |
| `TRUST_PROXY` | Honor forwarding headers for rate limits |
| `DURABULL_CLOUD` | Enables `/collect` + trusted proxy |

**Cloud deploy note:** Set `DURABULL_TELEMETRY_HMAC_SECRET` explicitly — it is no longer derived from `BETTER_AUTH_SECRET`.

---

## Lessons

- **Always `git fetch origin main` and rebase/merge before opening a telemetry PR** — parallel PRs (#109 vs #110) touched the same files.
- **Do not `git stash` to peek** while holding uncommitted work — use a worktree or WIP commit.
- **One deferral item per PR** — P3 should split barrel migration, shared queue helper, and signal docs if they grow large.
