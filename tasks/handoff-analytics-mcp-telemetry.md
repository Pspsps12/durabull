# Handoff: Analytics package split + MCP product telemetry

**Branch:** `main` (uncommitted local changes only — not pushed)  
**Last verified:** 2026-05-28 — **23 tests pass** (see Verification)  
**Original goal:** Track MCP usage in PostHog (anonymous + identified), consolidate server analytics into `packages/analytics`, fix review findings until no Critical/High correctness issues remain.

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

### Review loop status

- **Two** full parallel-code-review cycles run (4× explore subagents each).
- **Critical/High correctness:** addressed; re-review reported **none** for sanitizer/validate/telemetry/MCP paths after fixes.
- **Not done:** Security/perf hardening items below (intentionally deferred).

---

## 4. Remaining work (prioritized for “perfection”)

Use `/parallel-code-review` after each batch; fix **Critical/High** before claiming done. User wanted loop until no serious issues — interpret **serious** as Critical + High **correctness** and **High security** in this diff’s scope.

### P0 — Trust & honest HTTP semantics (correctness + security)

| # | Task | Files | Acceptance criteria |
|---|------|-------|---------------------|
| 1 | **Server runtime on `/collect` ingest** | `capture.ts` `ingestTelemetryCollectBatch` | Pass `options.getRuntimeContext()` into `validateTelemetryPayload` for each event (same merge as `/events`). Update `telemetry-collect.test.ts` if tests assumed client-only `authless`/`environment`. |
| 2 | **Complete `/events` preflight** | `telemetry.ts`, optionally export helper from `capture.ts` | Return **503** when `collectEnabled` but `getDurabullTelemetryCollectConfig(options)` is null (includes **invalid PostHog host**). Today: key+HMAC checked but invalid URL → **202** + silent no-op in capture. Add test mirroring collect “invalid PostHog batch host”. |
| 3 | **Fix self-hosted forward runtime merge** | `capture.ts` `forwardAnonymousToCloudCollect` ~95–98 | Use `...input.properties, ...input.runtimeContext` (match validate). Add unit or route test. |
| 4 | **PostHog host allowlist** | `posthog-batch.ts`, align `app.ts` `getPosthogApiHost` | HTTPS only; allowlist `*.posthog.com` / `*.i.posthog.com`; reject private/link-local IPs. Test invalid host → 503 on collect and events. |

### P1 — MCP hot path & cost (performance)

| # | Task | Files | Notes |
|---|------|-------|-------|
| 5 | **Dedupe/coalesce PostHog** | `mcp-analytics.ts`, `capture.ts` | When same project/URL/key: one `sendPosthogBatch` per MCP event. Test: `dedupeIdentifiedPosthogEvents: true` → only identified capture called (`mcp-analytics.test.ts` currently mocks dedupe false). |
| 6 | **Remove duplicate connection access DB query** | `policy-engine.ts`, `mcp-policy-middleware.ts`, `tools/shared.ts` | Policy already calls `canDelegatedUserAccessConnection`; middleware calls it again in `resolveConnectionForPrincipal`. Set `mcpResolvedConnection` once after grant. |
| 7 | **Single-flight instance ID** | `configure-server-analytics.ts` | Prevent thundering herd on cold start; optional eager resolve in `app.ts` at bootstrap. |
| 8 | **Async `/collect`** | `telemetry.ts`, `capture.ts` | Return 202 immediately; flush via bounded worker (pattern: `mcp-analytics-queue.ts`). |

### P2 — Security hardening (separate PR acceptable)

| # | Task | Notes |
|---|------|-------|
| 9 | Require `DURABULL_TELEMETRY_HMAC_SECRET` in production collect mode | Remove `BETTER_AUTH_SECRET` fallback in `configure-server-analytics.ts` |
| 10 | Rate limit: trust `X-Forwarded-For` only when proxy trusted | `apps/api/src/middleware/rate-limit.ts` |
| 11 | `/collect` authentication | Signed batches or install token — larger design |
| 12 | Browser `client.ts` runtime merge | `...(properties), ...runtimeContext` before `/events` |
| 13 | Clamp or ignore client `timestamp` on collect | `telemetry.ts`, `capture.ts` |

### P3 — Maintainability (readability review)

| # | Task |
|---|------|
| 14 | Root `packages/analytics/src/index.ts`: stop re-exporting full browser SDK; migrate web to `/browser` |
| 15 | Unify `McpPrincipalType` from `@durabull/dal` in MCP modules |
| 16 | Extract shared `createBoundedAsyncQueue` (audit + analytics) |
| 17 | Remove dead `DEFAULT_POSTHOG_BATCH_HOST` from `server/config.ts`; dedupe with `posthog-batch.ts` |
| 18 | Add `AnalyticsProperties.REDACTION_COUNT`; use in `mcp-analytics.ts` |
| 19 | Remove deprecated `getTelemetryHmacSecret` from public `server/index.ts` exports; update test mocks |
| 20 | Document which `McpTelemetrySignal` values are counter/log-only vs PostHog |

### P4 — Test gaps to close

- `/events` 503 when collect misconfigured (secrets) — **partially done**; extend for invalid host.
- `/collect` 502 (`upstream_rejected`) and 503 (`upstream_unavailable`) — mock `fetch` failures.
- MCP dedupe integration test (real `validateTelemetryPayload` path, not only mocks).
- `capture.ts` / `posthog-batch.ts` unit tests (optional but valuable).
- Forward path runtime merge test.

---

## 5. Verification commands

```bash
# Core regression suite (fast)
bun test \
  packages/analytics/src/server/validate.test.ts \
  packages/analytics/src/server/identifiers.test.ts \
  apps/api/src/routes/telemetry.test.ts \
  apps/api/src/routes/telemetry-collect.test.ts \
  apps/api/src/mcp/observability/mcp-analytics.test.ts

# Broader API if touching app bootstrap / middleware
bun test apps/api/src/app.test.ts

# Typecheck analytics package
cd packages/analytics && bun run check  # or monorepo equivalent
```

**Expected:** 23 pass in the core suite (as of handoff date).

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

1. Read this file + skim `packages/analytics/src/server/capture.ts` and `apps/api/src/mcp/observability/mcp-analytics.ts`.
2. Implement **P0 items 1–4** in order; run verification commands after each.
3. Run **`/parallel-code-review`** (four explore subagents) on full file list from `git diff --name-only` + untracked list in §9.
4. Fix remaining **Critical/High**; repeat review until clean or only accepted architectural deferrals documented in PR.
5. Implement **P1** if time; otherwise list in PR “Follow-up”.
6. Update `tasks/todo.md` with checkboxes; add `tasks/lessons.md` entry if user corrects anything.

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

- Prior transcript: `.cursor/projects/Users-gregg-dev-durabull/agent-transcripts/d7d60e35-aacc-4edb-aaa8-52f8e3463c64/` (analytics consolidation + review-fix loop).
- User attached skills: `loop` (monitored shell for recurring review), `parallel-code-review` (4× explore Task tool).

**Definition of done (perfection):** P0 complete + parallel review shows no Critical/High correctness or High security findings in changed files + all tests green + PR description documents accepted deferrals.
