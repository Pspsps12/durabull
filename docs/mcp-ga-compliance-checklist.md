# MCP Phase 1 — Spec Compliance Checklist

**GA target:** Read-only hosted MCP at `{APP_BASE_URL}/mcp`  
**Verified on branch:** `feat/no-linear-mcp-pr08-ga-readiness` (2026-05-28)  
**Stack:** PR-02 through PR-07 merged on `main`; PR-08 closes GA.

## Transport (Streamable HTTP)

| Requirement | Status | Evidence |
| --- | --- | --- |
| `GET` / `POST` / `DELETE` on `/mcp` | Done | `packages/mcp/src/routes.ts`, `apps/api/src/mcp/mount.test.ts` |
| MCP `initialize` + session handling | Done | `mount.test.ts` — initialize, tools/list, ping |
| Host header validation | Done | `allowed-hosts.test.ts`, `mount.test.ts` invalid Host → 403 |
| `/mcp` not captured by SPA static fallback | Done | `mount.test.ts` — GET /mcp without index.html |
| Request size limits (API app) | Done | API `1MB` body limit applies to `/mcp` ingress |

## OAuth discovery and bearer auth

| Requirement | Status | Evidence |
| --- | --- | --- |
| Protected Resource Metadata (PRM) | Done | `GET /.well-known/oauth-protected-resource` in `mount.test.ts` |
| `WWW-Authenticate` on missing bearer | Done | `bearer-middleware.test.ts`, `mount.test.ts` |
| Bearer required on all `/mcp` methods | Done | `routes.test.ts`, `mount.test.ts` |
| Canonical resource `{APP_BASE_URL}/mcp` | Done | `resource-uri.test.ts`, PRM in mount test |
| Wrong resource → 401 | Done | `bearer-middleware.test.ts`, `validate-token.test.ts` |
| Missing scope → 403 + scope challenge | Done | `validate-token.test.ts`, `mount.test.ts` |
| Expired token → 401 | Done | `session.test.ts`, `mount.test.ts` |

## Authorization and tenancy

| Requirement | Status | Evidence |
| --- | --- | --- |
| Per-tool scope mapping | Done | `policy-engine.ts`, `policy-engine.test.ts` |
| Delegated user connection boundary | Done | `mount.test.ts` cross-org deny |
| Service account policy bindings | Done | `mount.test.ts`, `mcp-policy.test.ts` |
| Fail closed on unmapped tools | Done | `policy-engine.test.ts` |
| Audit on allow/deny | Done | `mcp-audit.test.ts`, DAL repository tests |

## Read-only tool catalog

| Tool | Registered | Scoped | Tests |
| --- | --- | --- | --- |
| `ping` | Yes | `mcp:discover` | `routes.test.ts`, `mount.test.ts` |
| `list_connections` | Yes | `mcp:jobs:read` | `mount.test.ts` pagination + SA |
| `list_queues` | Yes | `mcp:jobs:read` | Handler + policy tests |
| `get_queue` | Yes | `mcp:jobs:read` | Handler tests |
| `list_jobs` | Yes | `mcp:jobs:read` | Handler tests |
| `get_job` | Yes | `mcp:jobs:read` | `job-read-handlers.test.ts` |
| `get_job_logs` | Yes | `mcp:logs:read` | `job-read-handlers.test.ts` |
| `get_job_stacktraces` | Yes | `mcp:logs:read` | `job-read-handlers.test.ts` |
| `get_failure_events` | Yes | `mcp:failures:read` | Scope deny in `mount.test.ts` |
| `get_queue_metrics` | Yes | `mcp:diagnostics:read` | Policy mapping test |
| `get_workers` | Yes | `mcp:jobs:read` | Policy mapping test |
| `explain_job_failure` | Yes | Composite scopes | `explain-job-failure-handler.test.ts` |
| Write/destructive tools | **None** | N/A | No registrations in `register-read-tools.ts` |

## Safety (PR-06)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Output sanitization on all read tools | Done | `sanitize-output.test.ts`, `mcp-sanitize.test.ts` |
| Per-tool rate limits | Done | `mcp-tool-rate-limit.test.ts` |
| Audit `input_hash` + `response_class` | Done | `mcp-audit.test.ts` |
| `mcp_telemetry` signals | Done | Mount tests emit policy_denied / tool_success |

## Deployment and operations (PR-07)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Unified `/mcp` cloud docs | Done | `deployment/render-and-demo.mdx` |
| Self-host single-port docs | Done | `deployment/docker.mdx`, compose comments |
| Operator runbook | Done | `docs/mcp-operations-runbook.md` |
| Env contract (`APP_BASE_URL`, telemetry) | Done | `environment-variables.mdx` |

## Staging / live validation (operator)

| Step | Status | Notes |
| --- | --- | --- |
| `mcp:e2e` on staging | **Operator** | Documented in runbook; mutates OAuth clients/tokens — not CI against prod |
| Delegated-user client E2E | **Operator** | Use supported MCP client + staging OAuth client |
| Service-account automation E2E | **Operator** | Create SA + bindings per runbook, then tool calls |

## Known non-blocking follow-ups

| Item | Tracking |
| --- | --- |
| Redis-backed rate limits for multi-replica | Phase 2 / ops note in security doc |
| `packages/mcp-domain` extraction | Master plan §2.2 optional |
| Pre-existing `alerts-global.test.ts` typecheck errors | Unrelated to MCP; blocks full `@durabull/api typecheck` |

## Sign-off

| Role | Name | Date | Notes |
| --- | --- | --- | --- |
| Engineering | | | Automated + integration suite green (see validation evidence) |
| Security | | | See `mcp-ga-security-closure.md` |
