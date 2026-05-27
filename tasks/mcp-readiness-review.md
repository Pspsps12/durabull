# MCP Readiness Review — PR-03 Transport + OAuth (2026-05-26)

This document summarizes readiness after addressing live-test recommendations (expired-token handling, operator docs, automated e2e smoke) and re-running full MCP e2e checks.

**Branch at review time:** `cursor/mcp-pr03-oauth-discovery-token-validation`  
**PR:** https://github.com/durabullhq/durabull/pull/89 (**merged**)  
**Plan position:** Post-merge PR-03 baseline, with PR-04 principal/policy implementation now in progress.

---

## Executive summary

| Dimension | Verdict |
| --- | --- |
| **PR-03 merge readiness** | **Merged** (PR #89); transport + OAuth discovery/auth slice is landed on `main`. |
| **Production / customer diagnostics** | **Not ready** — only `ping` exists; policy + principals are now being added in PR-04, while diagnostic tools/redaction/deploy remain PR-05–08. |
| **Full OAuth UX (browser PKCE)** | **Not manually verified** — registration + DB-seeded tokens exercised; authorize/consent UI flow not run in this pass. |

---

## Recommendations addressed (this session)

| Item | Status |
| --- | --- |
| Expired access tokens returned 200 via `getMcpSession` | **Fixed** — `isMcpAccessTokenExpired()` in `@durabull/mcp`; API middleware rejects expired sessions with `401` + `invalid_token` before scope checks. |
| Operator doc `APP_BASE_URL` vs dev port | **Updated** — `docs/mcp-oauth-operator.md` |
| Repeatable live e2e | **Added** — `tooling/scripts/mcp-e2e-smoke.ts` (`bun run mcp:e2e` from `tooling/scripts`) |
| Integration test for expired token | **Added** — `apps/api/src/mcp/mount.test.ts` |

---

## Automated verification (2026-05-26)

### Unit / integration tests

| Command | Result |
| --- | --- |
| `bun run --filter @durabull/mcp test` | **30 pass** (includes `session.test.ts`, validate-token, bearer-middleware, routes) |
| `bun run --filter @durabull/api test src/mcp/` | **7 pass** (includes expired OAuth token → 401) |

### Live e2e smoke (`APP_BASE_URL=http://localhost:3001`)

Run from `tooling/scripts`:

```bash
# Better Auth (default server config)
APP_BASE_URL=http://localhost:3001 bun run mcp:e2e

# Authless local dev
DURABULL_AUTHLESS=true APP_BASE_URL=http://localhost:3001 bun run mcp:e2e
```

| Mode | Checks | Result |
| --- | --- | --- |
| Better Auth (`DURABULL_AUTHLESS=false`) | 10 | **10/10 PASS** |
| Authless (`DURABULL_AUTHLESS=true`) | 9 (scope/expiry skipped) | **9/9 PASS** |

**Better Auth checklist exercised:**

1. PRM at app origin (`resource=http://localhost:3001/mcp`)
2. `POST /mcp` without bearer → `401` + `WWW-Authenticate`
3. Dynamic client registration (`POST /api/auth/mcp/register`)
4. Token without `mcp:discover` → `403`
5. Expired DB token → `401` (post-fix; required server restart)
6. Valid token: `initialize` → `notifications/initialized` → `tools/list` → `tools/call ping` → `pong`
7. `tools/list` without session → `400`
8. Wrong `Host` → `403`

---

## What works today (PR-02 + PR-03)

- **Hosting:** `/mcp` on same origin as API (`apps/api`), not a separate service.
- **Transport:** Streamable HTTP, session id on `initialize`, session required after init.
- **Discovery:** PRM + AS metadata (Better Auth + app-origin fallbacks).
- **Auth:** Bearer required; Better Auth `getMcpSession` / `withMcpAuth`; phase-1 `mcp:discover` scope gate.
- **Tools:** `ping` only (conformance / connectivity).
- **Dev:** Authless bearer `durabull-authless-mcp` when `DURABULL_AUTHLESS=true`.

---

## Current update (PR-04 in progress)

- Added principal-resolution path for delegated users + OAuth-linked service accounts.
- Added centralized policy middleware on MCP `tools/call` with audit-event writes.
- Added org/connection boundary checks and service-account policy-binding enforcement.
- Added DAL schema + migration for `mcp_service_account*`, `mcp_policy_binding`, and `mcp_audit_event`.
- Added integration coverage in `apps/api/src/mcp/mount.test.ts` for service-account allow/deny and delegated cross-org denial.

## Current update (PR-05 kickoff)

- Added MCP read-tool registration plumbing in `@durabull/mcp` and request-context propagation for tool handlers.
- Added first customer-facing read tool: `list_connections` with bounded `pageSize` and cursor pagination.
- Added next diagnostic tools: `list_queues`, `get_queue`, `list_jobs`, `get_job`, `get_job_logs`, and `get_job_stacktraces` behind the same policy/principal context path.
- Added API handler implementation constrained by principal type:
  - delegated users: only connections in org memberships
  - service accounts: only connections in bound organization
- Added integration coverage for delegated pagination, service-account scoped list access, and `get_job*` authorization/error paths.

---

## Known gaps and deferred work

### PR-03 follow-ups (non-blocking for merge if accepted)

| Gap | Risk | Suggested follow-up |
| --- | --- | --- |
| Full OAuth code + PKCE + consent in browser | Medium — clients may fail in real Cursor/Claude flows until exercised | Manual or Playwright flow against `/api/auth/mcp/authorize`; document redirect URI setup |
| RFC 8707 `resource` not enforced at token issuance | Low until multi-resource AS | Wire `resource` column + validation when enabling production clients |
| AS metadata `scopes_supported` may list OIDC scopes only | Low — PRM lists MCP scopes | Confirm client libraries read PRM; align AS metadata if needed |
| `packages/mcp` bearer middleware vs Better Auth path | Low — API uses Better Auth only | Keep package middleware for tests/future split; document single production path |

### Stack blockers for “customer-ready MCP”

| PR | Missing capability |
| --- | --- |
| PR-04 | Principal model, org/connection policy on tool calls |
| PR-05 | Remaining diagnostics tools (`get_failure_events`, `get_queue_metrics`, `get_workers`, `explain_job_failure`) |
| PR-06 | Redaction, rate limits, audit logging |
| PR-07 | Cloud/self-host deploy, runbooks |
| PR-08 | Security review closure, GA docs |

---

## Security posture (phase-1 transport)

| Control | Status |
| --- | --- |
| No anonymous `/mcp` | Enforced |
| Host allowlist | Enforced (`403`) |
| Scope least privilege (`mcp:discover` for transport) | Enforced (`403`) |
| Expired tokens | Enforced (`401`) after fix |
| Session fixation / unbounded sessions | Mitigated (init-only sessions, 256 cap) |
| Write/destructive tools | None shipped |
| Authless mode | Dev-only; must be off in production |

---

## Post-merge recommendation

- Keep PR-03 treated as transport/auth foundation only.
- Complete PR-04 policy/principal merge next, then proceed with PR-05 read-only diagnostic tools.
- Do not treat merged PR-03 as MCP GA or production customer diagnostics — that still requires PR-04–08.

---

## Quick commands for reviewers

```bash
# Tests
bun run --filter @durabull/mcp test
bun run --filter @durabull/api test src/mcp/

# Local server (Better Auth)
DURABULL_AUTHLESS=false APP_BASE_URL=http://localhost:3001 PORT=3001 bun apps/api/src/index.ts

# Live smoke
cd tooling/scripts && APP_BASE_URL=http://localhost:3001 bun run mcp:e2e
```
