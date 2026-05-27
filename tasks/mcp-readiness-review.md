# MCP Readiness Review — PR-03 Transport + OAuth (2026-05-26)

This document summarizes readiness after addressing live-test recommendations (expired-token handling, operator docs, automated e2e smoke) and re-running full MCP e2e checks.

**Branch:** `cursor/mcp-pr03-oauth-discovery-token-validation`  
**Draft PR:** https://github.com/durabullhq/durabull/pull/89  
**Plan position:** End of **PR-03** in the sequential MCP stack (PR-04+ not started).

---

## Executive summary

| Dimension | Verdict |
| --- | --- |
| **PR-03 merge readiness** | **Ready for review/merge** as the OAuth + transport-auth slice, pending Linear issue linkage and your sign-off on deferred items below. |
| **Production / customer diagnostics** | **Not ready** — only `ping` exists; no org-scoped tools, policy engine, redaction, rate limits, or deploy runbooks (PR-04–08). |
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
| PR-05 | `mcp:jobs:read`, failures, logs, diagnostics tools |
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

## Merge recommendation

**Approve PR #89** when:

1. Linear issue is attached (per playbook).
2. Reviewers accept deferred browser OAuth UX test and RFC 8707 issuance wiring.
3. Uncommitted follow-up commits on the branch include expiry fix + e2e script (push before merge).

**Do not** treat PR-03 merge as MCP GA or production customer diagnostics — that requires PR-04–08.

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
