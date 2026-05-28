# Handoff: Analytics package split + MCP product telemetry

**Last verified:** 2026-05-28 — **40 tests pass** in the core suite (see §5 Verification)
**Goal:** Track MCP usage in PostHog (anonymous + identified), consolidate server analytics into `packages/analytics`, and keep telemetry bullet-proof across client + server until no Critical/High correctness or High-security findings remain in changed scope.

## Status timeline (read this first)

| Stage | What shipped | State |
|-------|--------------|-------|
| **PR #107** | Initial server capture package + MCP PostHog telemetry | Merged |
| **PR #108** (`fix(analytics): harden telemetry collect/events preflight and PostHog host trust`) | **All P0**: server runtime on `/collect` ingest, fail-closed `/events` preflight incl. invalid PostHog host, forward merge order, HTTPS-only PostHog host allowlist + private-IP rejection + `redirect: 'manual'` | Merged into `main` |
| **PR #109** (`fix(analytics): correct MCP org grouping and harden telemetry robustness`) | Found via 4-lens parallel review of merged `main`. Fixes **MCP org `$groups` double-hash** (real bug), fetch timeouts + forward `redirect: 'manual'`, single-flight/eager instance id, `/collect` timestamp clamp, `/events` 503 guard, hygiene cleanups | Branch `cursor/telemetry-bulletproof-followups`, **open** |

**Current branch for in-flight work:** `cursor/telemetry-bulletproof-followups` (PR #109).
**Next agent:** branch fresh from `origin/main` (after #109 merges) for the deferred items in §4.

---

## 1. What this change set does

### Product intent

- **Before:** Browser telemetry via `@durabull/analytics` + relay `POST /api/telemetry/events` → cloud `/api/telemetry/collect`. MCP had **ops-only** signals (`mcp_telemetry` stdout + `mcp_audit_event` DB) — **no PostHog product events for MCP**.
- **After:** Shared `@durabull/analytics/server` for capture/validate/HMAC; MCP maps telemetry signals → PostHog events (`mcp_tool_called`, `mcp_auth_failed`, etc.); consent page uses `/browser` + `/events` subpaths.

### Architecture (high level)

```
Browser / self-hosted API          Durabull Cloud API
─────────────────────────          ───────────────────
trackEvent → POST /events    →     POST /collect → ingestTelemetryCollectBatch
  (validate + runtime)               (validate per event, HMAC distinct_id)
  → forward to cloud OR              → sendPosthogBatch (Durabull PostHog key)

MCP request path
────────────────
policy/mount/auth → recordMcpTelemetry (ops) → recordMcpTelemetryAnalytics
  → enqueueMcpAnalytics → processMcpAnalytics
  → captureAnonymousServerEvent + captureIdentifiedServerEvent (parallel)
```

---

## 2. File map (what to read first)

| Path | Role |
|------|------|
| `packages/analytics/src/server/capture.ts` | Anonymous/identified capture, cloud forward, **`ingestTelemetryCollectBatch`** |
| `packages/analytics/src/server/validate.ts` | `validateTelemetryPayload` — runtime merge: `{ ...properties, ...runtimeContext }` (server wins) |
| `packages/analytics/src/sanitizer.ts` | Allow/deny lists; **`undefined` values skipped** (not dropped) |
| `packages/analytics/src/server/config.ts` | `configureServerAnalytics`, `resetServerAnalyticsForTests` |
| `packages/analytics/src/server/posthog-batch.ts` | `resolvePosthogBatchUrl`, `sendPosthogBatch` |
| `packages/analytics/src/server/identifiers.ts` | HMAC distinct IDs, MCP session hash |
| `packages/analytics/src/events.ts` | Event + property name constants |
| `apps/api/src/lib/configure-server-analytics.ts` | Env → `configureServerAnalytics`, cached instance ID |
| `apps/api/src/routes/telemetry.ts` | `/status`, `/collect`, `/events` |
| `apps/api/src/mcp/observability/mcp-analytics.ts` | MCP → PostHog mapping |
| `apps/api/src/mcp/observability/mcp-analytics-queue.ts` | Bounded async queue (512 depth, 8 in-flight) |
| `apps/api/src/mcp/observability/mcp-telemetry.ts` | Ops signals + fan-out to analytics |
| `apps/api/src/mcp/observability/mcp-telemetry-signals.ts` | Signal union type |
| `packages/dal/src/repositories/telemetry-installation.ts` | `readAnonymousInstanceId`, `getOrCreateAnonymousInstanceId` (no per-event UPDATE) |

**Deleted:** `apps/api/src/lib/posthog-server.ts` (logic moved to package).

---

## 3. Completed work (do not redo blindly)

### Package structure

- `packages/analytics` exports: `./server`, `./browser`, `./react` (alias), `./client` (legacy), `./events`, `./sanitizer`.
- Removed **duplicate** `./events` block in `package.json` (was listed twice).
- `packages/analytics/src/server/index.ts` exports `resetServerAnalyticsForTests`.

### MCP product analytics

- Events in `events.ts`: `mcp_rpc_requested`, `mcp_tool_called`, `mcp_tool_denied`, `mcp_auth_failed`, `mcp_rate_limited`, consent events, etc.
- `mcp-analytics.ts` wired from auth middleware, policy (RPC: `initialize`, `tools/list` only), mount (tool success/error), audit (denials).
- **No double `mcp_tool_called` for redaction** — `redaction_applied` / audit signals no-op in analytics switch; `redaction_count` on tool success only.
- Uses `options.hmacSecret` (not deprecated `getTelemetryHmacSecret` in production path).
- `Promise.all` for anonymous + identified when both run; dedupe skips anonymous when `shouldDedupeIdentifiedPosthogEvents()` && identified distinct id exists.

### Server capture / routes

- `/collect` returns 404 when `!collectEnabled || !enabled`.
- `ingestTelemetryCollectBatch` returns `{ error: 'disabled' }` when `!options.enabled`.
- Collect ingest uses `sendPosthogBatch(..., { mergeRuntime: false })` to avoid cloud host stamping OSS batches incorrectly.
- `/events` returns **503** when `collectEnabled` but missing PostHog key or HMAC secret.
- Strict validation on `/events` and `/collect` — unknown events / forbidden properties → **400**.
- Identified distinct IDs hashed (`hashIdentifiedUserDistinctId`, `hashIdentifiedOrganizationDistinctId`).
- Cached anonymous instance ID via `telemetryInstallationRepository.readAnonymousInstanceId()` + process cache in `configure-server-analytics.ts`.

### Correctness fixes (verified)

- Sanitizer skips `undefined` optional MCP properties (was causing silent drop of entire events).
- `validateTelemetryPayload` merge order: server runtime overrides client on `/events`.
- Telemetry tests split: forbidden props → 400; valid props → 202 + forward.
- `packages/analytics/src/server/validate.test.ts` added.
- Dead code removed: `principalToAnalyticsIdentity` in policy middleware; unused `telemetryInstallationRepository` import in `telemetry.ts`; route re-exports of `hashTelemetryIdentifier`.
- `apps/web/src/routes/consent.tsx` imports `@durabull/analytics/events` + `@durabull/analytics/browser`.

### Correctness/robustness fixes in PR #109 (open)

- **MCP org `$groups` double-hash fixed.** `resolveIdentifiedDistinctIds()` returns an already-HMAC-hashed `organizationGroup`; `mcp-analytics.ts` previously passed it into `captureIdentifiedServerEvent({ organizationId })`, which hashed it **again** → `hash(hash(orgId))`. Now passes **raw** `identity.organizationId`; capture hashes once. New `packages/analytics/src/server/capture.test.ts` asserts `$groups.organization === hashIdentifiedOrganizationDistinctId(orgId, secret)` exactly once.
- **Fetch timeouts** (`POSTHOG_FETCH_TIMEOUT_MS = 5_000`, `AbortSignal.timeout`) on `sendPosthogBatch` and `forwardAnonymousToCloudCollect`; **`redirect: 'manual'`** added to the cloud forward (SSRF parity).
- **Single-flight + eager bootstrap** of anonymous instance id in `configure-server-analytics.ts` (no thundering herd; removed redundant cold-start `SELECT`; `/events` no longer blocks on cold DB).
- **`/collect` timestamp clamp** to server time ±24h (`resolveCollectTimestamp` in `capture.ts`) — stops back/future-dated client events polluting time series.
- **`/events` 503 guard** around `resolveAnonymousInstanceId` (was an unhandled 500 on DB failure).
- **Hygiene:** removed dead `DEFAULT_POSTHOG_BATCH_HOST` (config.ts) and deprecated `getTelemetryHmacSecret` export; added `AnalyticsProperties.REDACTION_COUNT`; unified `McpPrincipalType` import from `@durabull/dal`.

### Review loop status

- Three full parallel-code-review cycles run (4× explore subagents each); the third was over **merged `main`** post-#108.
- **Critical:** none in telemetry scope. **High correctness:** the org double-hash — fixed in #109.
- **Still open (deferred):** see §4 — `/collect` auth (subsumes OSS-forward fidelity), XFF trust, dedicated HMAC secret, async `/collect`, dedupe/coalesce, queue-drop metric, barrel migration.

---

## 4. Remaining work (for the next agent)

Everything in **P0 is merged (#108)**. The contained correctness/robustness/hygiene items are in **#109 (open)**. What remains below is genuinely larger-design or cross-cutting — each is worth its own PR. Use `/parallel-code-review` after each batch; fix **Critical/High** before claiming done.

### ✅ Already done (do NOT redo)

| Item | Where |
|------|-------|
| Server runtime on `/collect` ingest; `/events` invalid-host preflight; forward merge order; PostHog HTTPS allowlist + private-IP reject + `redirect: 'manual'` | **#108** |
| MCP org `$groups` double-hash; fetch timeouts + forward `redirect: 'manual'`; single-flight + eager instance id; `/collect` timestamp clamp; `/events` 503 guard | **#109** |
| Browser `client.ts` runtime merge (server still authoritative via re-validate) | already in `client.ts` `sendDurabullTelemetry`/`withRuntimeContext` |
| Hygiene: dead `DEFAULT_POSTHOG_BATCH_HOST`, deprecated `getTelemetryHmacSecret`, `AnalyticsProperties.REDACTION_COUNT`, unify `McpPrincipalType` | **#109** |

### P0 (deferred) — Trust & honest semantics

| # | Task | Files | Acceptance criteria |
|---|------|-------|---------------------|
| A | **`/collect` authentication / signed batches** | `telemetry.ts`, `capture.ts`, `configure-server-analytics.ts`, new verify util | Distinguish **trusted OSS forwards** from **untrusted public posts**. Signed/HMAC'd batch or install token. **This also fixes the OSS→cloud runtime re-stamp** (see Known issue below). AC: verified forwards keep their originating runtime; unverified posts still get server-runtime override (anti-spoof); unauthenticated/invalid signature → 401/403; tests for both paths. |
| B | **Rate-limit `X-Forwarded-For` trust** | `apps/api/src/middleware/rate-limit.ts` | Only trust XFF behind a configured trusted proxy (use rightmost trusted hop or `cf-connecting-ip`/`x-real-ip`). MCP ingress already avoids XFF — mirror it. Cross-cutting: affects all `/api/*` limiters, so test broadly. **High security.** |

**Known issue resolved-by-A:** cloud `/collect` re-stamps OSS-forwarded runtime with the cloud node's `getRuntimeContext()` because `validateTelemetryPayload` merges server runtime over event properties (intended anti-spoof for public posts). For legit OSS forwards this clobbers `authless`/`persistence`/`stateless`/`env_connections`, mis-attributing self-hosted deployments. Do **not** "fix" by trusting client runtime on `/collect` — that reopens the spoofing hole #108 closed. Fix via the signed/auth channel in A.

### P1 — Performance

| # | Task | Files | Notes |
|---|------|-------|-------|
| 5 | **Dedupe/coalesce PostHog** | `mcp-analytics.ts`, `capture.ts` | When anonymous + identified share the same `{posthogBatchUrl, posthogKey}`, emit **one** `sendPosthogBatch` (two captures) instead of 2 HTTP calls. Add integration test with `dedupeIdentifiedPosthogEvents: true` (currently mocked false). |
| 6 | **Remove duplicate connection-access DB query** (not telemetry, but on MCP hot path) | `policy-engine.ts`, `mcp-policy-middleware.ts`, `tools/shared.ts` | Policy already calls `canDelegatedUserAccessConnection`; middleware re-checks in `resolveConnectionForPrincipal`. Resolve once after grant. |
| 8 | **Async `/collect`** | `telemetry.ts`, `capture.ts` | Return 202 immediately, flush via bounded worker (pattern: `mcp-analytics-queue.ts`). The #109 fetch timeout mitigates the worst hang. |

### P2 — Security hardening

| # | Task | Notes |
|---|------|-------|
| 9 | Require dedicated `DURABULL_TELEMETRY_HMAC_SECRET` in prod collect mode | Remove `BETTER_AUTH_SECRET` fallback in `configure-server-analytics.ts:~bootstrap`; fail collect bootstrap (or 503) if missing. Coordinate env across cloud + self-host docs. |

### P3 — Maintainability

| # | Task |
|---|------|
| 14 | Root `packages/analytics/src/index.ts`: stop re-exporting full browser SDK (barrel); migrate ~31 web call sites to `@durabull/analytics/browser` + `/events`. |
| 16 | Extract shared `createBoundedAsyncQueue` (audit `mcp-audit.ts` + analytics `mcp-analytics-queue.ts`). |
| 20 | Document which `McpTelemetrySignal` values are counter/log-only vs PostHog. |
| 21 | Analytics queue drops silently at depth 512 — add a drop counter/structured log (audit queue already logs drops). Optional `scope_count` constant (consent.tsx uses a raw literal). |

### P4 — Test gaps still worth closing

- MCP dedupe integration test (real `shouldDedupeIdentifiedPosthogEvents: true` path, not mocked).
- `/collect` `502` (`upstream_rejected`) + `503` (`upstream_unavailable`) already covered in `telemetry-collect.test.ts`; extend if A changes status mapping.
- Concurrent `resolveAnonymousInstanceId` single-flight test (one create, same id).
- `forwardAnonymousToCloudCollect` runtime-merge + new timeout behavior.

---

## 5. Verification commands

```bash
# Core regression suite (fast) — 40 pass as of #109
bun test \
  packages/analytics/src/server/validate.test.ts \
  packages/analytics/src/server/identifiers.test.ts \
  packages/analytics/src/server/posthog-batch.test.ts \
  packages/analytics/src/server/capture.test.ts \
  apps/api/src/routes/telemetry.test.ts \
  apps/api/src/routes/telemetry-collect.test.ts \
  apps/api/src/mcp/observability/mcp-analytics.test.ts

# Lint changed files with the repo-pinned Biome (NOT `bunx biome` — wrong version)
./node_modules/.bin/biome lint <changed paths>
./node_modules/.bin/biome format <changed paths>   # check; add --write to fix

# Typecheck (test files error on `bun:test` import — PRE-EXISTING/environmental, ignore)
cd apps/api && bun run typecheck
```

**Expected:** 40 pass in the core suite (as of #109).

**Sandbox gotcha:** `apps/api/src/app.test.ts` "api app config" cases fail in the agent sandbox shell — it has `CI=true` and no `MCP_AUTHLESS_BEARER_TOKEN`, so `createApiApp` throws in MCP auth assertion and the `enabled` env gate flips. These are **environmental, not caused by telemetry changes**. To run them: `MCP_AUTHLESS_BEARER_TOKEN=test-token CI= bun test apps/api/src/app.test.ts`.

---

## 6. Environment & configuration reference

| Variable | Purpose |
|----------|---------|
| `DURABULL_TELEMETRY_POSTHOG_KEY` | Durabull product analytics PostHog key |
| `DURABULL_TELEMETRY_POSTHOG_HOST` | Batch ingest host |
| `DURABULL_TELEMETRY_HMAC_SECRET` | HMAC for distinct_id / instance_key (falls back to `BETTER_AUTH_SECRET` today — **change in P2**) |
| `POSTHOG_KEY` / `POSTHOG_HOST` | App/customer PostHog (identified events) |
| `DURABULL_CLOUD` / managed host | Enables `/collect` on cloud API |
| `MCP_TELEMETRY_LOG` | Set `false` to disable sync stdout MCP telemetry |

**Dedupe:** `dedupeIdentifiedPosthogEvents` in `configure-server-analytics.ts` when app and Durabull telemetry keys match (cloud).

---

## 7. Non-obvious behaviors (read before changing)

1. **`validateTelemetryPayload` failure in capture** — `captureAnonymousServerEvent` / `captureIdentifiedServerEvent` return void on invalid input (no throw). Route-level validation is required for honest HTTP status codes.

2. **`/collect` vs `/events` validation** — After P0 #1, both should merge server runtime. Until then, collect accepts client `authless`/`environment` (documented High security finding).

3. **Double PostHog events** — When `dedupeIdentifiedPosthogEvents` is false, each identified MCP event sends **two** HTTP requests (anonymous + identified). Intentional for separate projects; bug if same project.

4. **RPC analytics** — `recordMcpRpcAnalytics` from policy middleware **without** identity for `initialize` / `tools/list`; session id falls back to `'mcp-server'`. Product metrics are coarse unless you pass session/principal (P2/low).

5. **MCP analytics queue** — Drops silently at depth 512; audit queue logs drops. Add metric if fixing P2.

6. **Barrel exports** — Workspace rule: avoid new barrel files; prefer direct imports. Do not add new `index.ts` re-exports in app code.

7. **Commits** — User rules: **only commit when explicitly asked**. This handoff is uncommitted work on `main`.

8. **Linear** — Tie PR to Linear issue when creating PR (workspace rule).

---

## 8. Suggested workflow for next agent

1. Read this file (esp. §0 status timeline + §4) and skim `packages/analytics/src/server/capture.ts` and `apps/api/src/mcp/observability/mcp-analytics.ts`.
2. After **#109 merges**, branch fresh from `origin/main` (workspace rule: follow-up PRs branch from latest primary).
3. Pick **one** §4 item per PR. Recommended order: **P0-A (`/collect` auth — unlocks the OSS-forward fidelity fix)** → **P0-B (XFF trust)** → P1 dedupe/coalesce → P2 HMAC secret → P3 cleanups.
4. Run **`/parallel-code-review`** (four explore subagents) on the changed file list; fix Critical/High before claiming done.
5. Update `tasks/todo.md` checkboxes; add `tasks/lessons.md` if the user corrects anything; tie the PR to a Linear issue (workspace rule — needed for release-note automation).

**Lesson captured this round:** never use `git stash`/`stash pop` to "peek" at clean state while you have uncommitted work — a failed pop silently strips your edits (it happened; recovered from `stash@{0}`). Use a throwaway `git worktree` or commit a WIP first instead.

### Parallel review file list (copy-paste)

```
apps/api/src/app.ts
apps/api/src/lib/configure-server-analytics.ts
apps/api/src/mcp/audit/mcp-audit.ts
apps/api/src/mcp/auth/mcp-session-middleware.ts
apps/api/src/mcp/json-rpc-tool-call.ts
apps/api/src/mcp/mount.ts
apps/api/src/mcp/observability/mcp-analytics-queue.ts
apps/api/src/mcp/observability/mcp-analytics.ts
apps/api/src/mcp/observability/mcp-analytics.test.ts
apps/api/src/mcp/observability/mcp-telemetry-signals.ts
apps/api/src/mcp/observability/mcp-telemetry.ts
apps/api/src/mcp/policy/mcp-policy-middleware.ts
apps/api/src/routes/telemetry-collect.test.ts
apps/api/src/routes/telemetry.test.ts
apps/api/src/routes/telemetry.ts
apps/web/src/routes/consent.tsx
packages/analytics/package.json
packages/analytics/src/browser.ts
packages/analytics/src/events.ts
packages/analytics/src/index.ts
packages/analytics/src/react.ts
packages/analytics/src/sanitizer.ts
packages/analytics/src/server/capture.ts
packages/analytics/src/server/capture.test.ts
packages/analytics/src/server/config.ts
packages/analytics/src/server/identifiers.ts
packages/analytics/src/server/index.ts
packages/analytics/src/server/posthog-batch.ts
packages/analytics/src/server/validate.ts
packages/analytics/src/server/validate.test.ts
packages/dal/src/repositories/telemetry-installation.ts
packages/mcp/src/request-context.ts
packages/mcp/src/tools/register-read-tools.ts
```

---

## 9. PR description starter

**Title:** feat(analytics): server capture package + MCP PostHog product telemetry

**Summary:**
- Add `@durabull/analytics/server` for validated, HMAC-scoped PostHog capture and cloud collect ingest.
- Emit MCP product events (`mcp_tool_called`, auth failures, rate limits, etc.) with bounded async queue.
- Harden `/events` validation and fail-closed when collect is misconfigured.

**Test plan:**
- [ ] `bun test` on telemetry + mcp-analytics + server validate/identifiers
- [ ] Manual: MCP tool call on dev stack → events in PostHog (anonymous + identified as configured)
- [ ] `/collect` rejects spoofed forbidden keys; server runtime applied after P0
- [ ] Invalid PostHog host returns 503 on `/events` and `/collect` after P0

**Known follow-ups:** P1–P3 table above; `/collect` signing not in scope unless P2 #11 done.

---

## 10. Conversation context

- Analytics consolidation + first review-fix loop: PR #107.
- P0 hardening: PR #108 (merged).
- Post-#108 review + fixes: PR #109 (`cursor/telemetry-bulletproof-followups`, open) — found via a 4-lens `/parallel-code-review` over merged `main`.
- Skills in play: `parallel-code-review` (4× explore Task tool), `loop` (monitored shell for recurring review).

**Definition of done (perfection):** P0 complete (#108 ✅) + no Critical/High correctness or High-security findings in changed scope (org double-hash fixed in #109 ✅; remaining High-security = XFF trust, deferred to P0-B) + all tests green + each PR documents accepted deferrals and links a Linear issue.
