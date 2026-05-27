# MCP Server Execution Playbook (Sequential PR Stack)

## Goal

Ship a production-safe, hosted MCP server for Durabull that supports read-only diagnostics for jobs, failures, logs, and root-cause context, with:

- Better Auth as the auth foundation.
- OAuth 2.1 + scoped bearer token authorization for remote MCP.
- Cloud-hosted and self-hosted deployment paths.
- Strict safety controls so destructive operations cannot run accidentally.

This playbook is designed for **sequential agent execution** with clear handoffs and a running history.

## Required Companion Document

Before executing any PR in this stack, agents must read:

- `tasks/mcp-implementation-master-plan.md`

Usage split:

- `tasks/mcp-implementation-master-plan.md` = technical implementation details ("how")
- `tasks/mcp-pr-execution-playbook.md` = sequencing, ownership, validation history ("when/who")

## Non-Negotiable Constraints

- Do not skip PR order.
- Every PR must be mergeable independently.
- Every PR must include tests and verification evidence.
- No write/destructive MCP tools in this stack (read-only GA target).
- Each PR must link to a Linear issue before merge.

## Hosting model (authoritative — read before PR-02)

MCP is **not** a separate deployable in phase 1. It runs on the **same origin and same process** as the main Durabull API + web app.

| Path | Handler |
| --- | --- |
| `/api/*` | API routes (`apps/api`) |
| `/mcp` | MCP Streamable HTTP (`apps/api/src/mcp/*` mounted in `createApiApp()`) |
| `/ingest/*` | PostHog proxy (existing) |
| `/`, `/assets/*` | Web SPA/static (`apps/api/src/index.ts`) |

Cloud example: `https://app.durabull.io/mcp` on the same Render web service as `https://app.durabull.io/api/*`.

**Agent rules:**

- Implement MCP under `apps/api/src/mcp/`, not as a standalone `apps/mcp` server.
- Mount `/mcp` in `apps/api/src/app.ts` before SPA/static fallbacks.
- Do not add a second public port (`3020`) or dual-process Docker entrypoints for MCP.
- OAuth canonical resource URI (PR-03+): `${APP_BASE_URL}/mcp`.
- Domain logic stays in shared services; MCP handlers are thin ingress only.

If a branch still has experimental `apps/mcp` or `tooling/docker/run-services.ts`, PR-02 must migrate/remove that layout as part of API ingress work (see master plan §13.1).

## Skateboard Approach (Incremental Product Slices)

Each PR must deliver a usable, testable increment:

1. Security model + contracts are explicit.
2. MCP transport is mounted at `/mcp` on the API app and is callable on the same origin.
3. Auth discovery and token validation work end-to-end.
4. Policy/scopes enforce least privilege.
5. Read-only tools deliver customer value.
6. Ops hardening and deployment complete production readiness.

---

## Global Agent Checklist (Run on Every PR)

- [ ] Agent startup checklist completed from `tasks/mcp-implementation-master-plan.md`.
- [ ] Branch is created from latest primary branch (`main`).
- [ ] PR references a Linear issue ID in branch name, PR title, or description.
- [ ] Scope is limited to this PR's checklist only.
- [ ] All new behavior has tests.
- [ ] Existing tests touched by scope still pass.
- [ ] Lint/typecheck pass for touched packages.
- [ ] Security-sensitive changes include negative tests (unauthorized/forbidden).
- [ ] Documentation updates included for behavior changes.
- [ ] PR description includes:
  - [ ] What changed
  - [ ] Why this is safe
  - [ ] How it was verified
  - [ ] Any follow-up work explicitly deferred

---

## PR Stack Overview

- PR-01: Security architecture + ADR + threat model + scope taxonomy
- PR-02: API-mounted MCP module (`/mcp`) + transport wiring + conformance harness
- PR-03: OAuth discovery (PRM/WWW-Authenticate) + MCP token validation middleware
- PR-04: Principal model (delegated users + service accounts) + policy engine
- PR-05: Read-only tool set for jobs/failures/logs/diagnostics
- PR-06: Output safety (redaction), rate limits, and audit logging
- PR-07: Cloud deployment path + self-host deployment path + runbooks
- PR-08: Production readiness verification, security review closure, GA docs

---

## Zero-Ambiguity PR Templates (Copy/Paste)

Use these templates exactly. Replace placeholders only.

### Global Naming Convention

- Branch format: `feat/<linear-id>-mcp-pr0x-<short-scope>`
- PR title format: `<linear-id>: MCP PR-0X <short scope>`

If a Linear issue is temporarily unavailable, use:

- branch: `feat/no-linear-mcp-pr0x-<short-scope>`
- title: `NO-LINEAR: MCP PR-0X <short scope>`

### Required PR Body Template (All PRs)

```md
## Objective
<copy objective from active PR section>

## Scope (In)
- [ ] <deliverable 1>
- [ ] <deliverable 2>
- [ ] <deliverable 3>

## Scope (Out)
- [ ] <explicitly deferred item 1>
- [ ] <explicitly deferred item 2>

## Implementation Notes
- <key design choices and touched files>

## Safety
- [ ] No destructive MCP tools introduced
- [ ] Org + connection boundary checks verified for touched paths
- [ ] Negative auth/authz tests added and passing
- [ ] Redaction/sensitive-output behavior preserved or improved

## Validation
- [ ] `bun run lint --filter <pkg-or-app>`
- [ ] `bun run typecheck --filter <pkg-or-app>`
- [ ] `<targeted tests command>`
- [ ] `<integration/security test command>`

## Evidence
- <paste key command outputs, test names, or screenshots/links>

## Handoff
- Next PR: `PR-0X`
- Known risks:
- Follow-ups intentionally deferred:
```

### PR-01 Template

- Branch: `feat/<linear-id>-mcp-pr01-security-baseline`
- Title: `<linear-id>: MCP PR-01 security architecture baseline`
- Must include:
  - [ ] ADR link path in PR body
  - [ ] Threat model section
  - [ ] Scope taxonomy table
  - [ ] Explicit statement: phase 1 is read-only only
- Acceptance statement to include verbatim:
  - `This PR defines security and scope contracts only; no MCP runtime behavior is introduced.`

### PR-02 Template

- Branch: `feat/<linear-id>-mcp-pr02-api-mcp-ingress`
- Title: `<linear-id>: MCP PR-02 API /mcp ingress and transport`
- Must include:
  - [ ] `apps/api/src/mcp/` module summary (not standalone `apps/mcp`)
  - [ ] mount point in `createApiApp()` at `/mcp` (before SPA fallback)
  - [ ] transport wiring explanation (`GET`/`POST`/`DELETE` on `/mcp`)
  - [ ] host-header validation proof (includes `APP_BASE_URL` host in cloud)
  - [ ] smoke tool call evidence (`ping`) against same port as API (for example `:3000/mcp`)
  - [ ] confirmation no second public MCP port in Docker/compose
- Acceptance statement to include verbatim:
  - `This PR establishes MCP transport at /mcp on the API app only and does not expose production domain tools.`

### PR-03 Template

- Branch: `feat/<linear-id>-mcp-pr03-oauth-discovery-token-validation`
- Title: `<linear-id>: MCP PR-03 OAuth discovery and token validation`
- Must include:
  - [ ] PRM endpoint proof (well-known paths on same origin as API)
  - [ ] canonical resource URI proof: `${APP_BASE_URL}/mcp`
  - [ ] `WWW-Authenticate` challenge example on `/mcp`
  - [ ] audience/resource validation proof
  - [ ] 401 vs 403 behavior evidence
- Acceptance statement to include verbatim:
  - `This PR enforces per-request bearer validation and OAuth discovery semantics for MCP transport.`

### PR-04 Template

- Branch: `feat/<linear-id>-mcp-pr04-principals-policy-engine`
- Title: `<linear-id>: MCP PR-04 principals and policy engine`
- Must include:
  - [ ] delegated principal flow evidence
  - [ ] service account flow evidence
  - [ ] schema migration references
  - [ ] policy decision log example
- Acceptance statement to include verbatim:
  - `This PR centralizes tool-level authorization decisions for delegated and machine principals.`

### PR-05 Template

- Branch: `feat/<linear-id>-mcp-pr05-readonly-tool-catalog`
- Title: `<linear-id>: MCP PR-05 read-only diagnostic tools`
- Must include:
  - [ ] list of tools implemented in this PR
  - [ ] per-tool schema references
  - [ ] pagination boundary tests
  - [ ] explain-job-failure deterministic behavior evidence
- Acceptance statement to include verbatim:
  - `This PR delivers read-only customer-facing MCP diagnostic value with bounded inputs/outputs.`

### PR-06 Template

- Branch: `feat/<linear-id>-mcp-pr06-safety-hardening`
- Title: `<linear-id>: MCP PR-06 safety hardening and auditability`
- Must include:
  - [ ] redaction strategy + tests
  - [ ] rate-limit policy + tests
  - [ ] audit event schema/example
  - [ ] anomaly signal metrics list
- Acceptance statement to include verbatim:
  - `This PR hardens MCP read operations against leakage and abuse while preserving diagnostic utility.`

### PR-07 Template

- Branch: `feat/<linear-id>-mcp-pr07-cloud-selfhost-ops`
- Title: `<linear-id>: MCP PR-07 deployment and operations`
- Must include:
  - [ ] cloud deploy evidence (single Render web service; `/mcp` on app domain)
  - [ ] self-host smoke evidence (`/api/health` and `/mcp` on same port)
  - [ ] env contract docs (`APP_BASE_URL`, optional `DURABULL_MCP_ENABLED`, no `MCP_PORT` publish)
  - [ ] operator runbook links
  - [ ] explicit note: no separate MCP container/service in phase 1
- Acceptance statement to include verbatim:
  - `This PR documents and verifies MCP on the unified API deployment at /mcp for cloud and self-hosted environments.`

### PR-08 Template

- Branch: `feat/<linear-id>-mcp-pr08-ga-readiness`
- Title: `<linear-id>: MCP PR-08 GA readiness and security closure`
- Must include:
  - [ ] spec compliance checklist completion
  - [ ] security review closure evidence
  - [ ] staged E2E delegated + service account flows
  - [ ] rollback checklist
- Acceptance statement to include verbatim:
  - `This PR closes GA readiness with verified compliance, security closure, and operational rollback readiness.`

### Merge Gate Checklist (Required in Every PR Body)

```md
## Merge Gate
- [ ] Objective achieved
- [ ] Exit criteria from playbook met
- [ ] Global agent checklist complete
- [ ] Ledger updated in `tasks/mcp-pr-execution-playbook.md`
- [ ] No unresolved critical/high security findings
- [ ] Reviewer signoff captured
```

---

## PR-01: Security Architecture Baseline

### Objective

Lock design and safety contracts before code transport/auth implementation starts.

### Deliverables

- [ ] ADR for MCP architecture and boundaries.
- [ ] Threat model for hosted MCP (token theft, confused deputy, scope escalation, tenancy boundary violations).
- [ ] Scope taxonomy (`mcp:discover`, `mcp:jobs:read`, `mcp:failures:read`, `mcp:logs:read`, `mcp:diagnostics:read`).
- [ ] Permission matrix for delegated users vs service accounts.
- [ ] Decision record for read-only GA and write-tool deferral.

### File Targets

- [ ] `docs/adr/` new ADR markdown
- [ ] `apps/docs/content/documentation/operations/` security doc updates
- [ ] `tasks/` implementation checklist references

### Verification

- [ ] Security design walkthrough completed and recorded in PR description.
- [ ] At least one reviewer signs off specifically on authz scope model.

### Exit Criteria

- [ ] All downstream PRs can reference this PR as source of truth.

---

## PR-02: API-Mounted MCP Ingress + Transport

### Objective

Mount MCP Streamable HTTP transport at `/mcp` on the existing `apps/api` Hono app (same deployment/port as API + web), with basic lifecycle and no privileged domain tools yet.

### Deliverables

- [ ] MCP module under `apps/api/src/mcp/` (server bootstrap, transport, route wiring).
- [ ] `/mcp` mounted in `createApiApp()` with correct middleware ordering (before SPA/static `*` fallbacks).
- [ ] Streamable HTTP on `/mcp` (`GET` + `POST` + `DELETE` per SDK).
- [ ] Host header validation including production host from `APP_BASE_URL`.
- [ ] MCP SDK dependencies on `@durabull/api` (not a separate MCP app package).
- [ ] Minimal smoke tool (non-domain `ping`) for transport validation.
- [ ] Remove or migrate any experimental standalone `apps/mcp` + dual-process Docker runner from the branch.

### File Targets

- [ ] `apps/api/src/mcp/server.ts` (McpServer + tool registration)
- [ ] `apps/api/src/mcp/routes.ts` or `apps/api/src/mcp/mount.ts` (transport + middleware)
- [ ] `apps/api/src/app.ts` (mount `/mcp`)
- [ ] `apps/api/package.json` (MCP SDK deps)
- [ ] `apps/api/src/mcp/*.test.ts` or `apps/api/src/app.mcp.test.ts`
- [ ] `tooling/docker/Dockerfile` (single API entrypoint; no MCP second port)
- [ ] `docs/adr/0001-mcp-security-architecture.md` (amend deployable wording if still saying `apps/mcp`)

### Out of scope (explicit)

- [ ] Standalone `apps/mcp` deployable package
- [ ] Separate public port `3020` in compose/production
- [ ] `tooling/docker/run-services.ts` dual-process supervisor
- [ ] Production diagnostic tools (PR-05)

### Tests

- [ ] API integration test via `createApiApp()`:
  - [ ] `POST /mcp` `initialize` succeeds with required MCP headers
  - [ ] `tools/list` includes `ping`
  - [ ] `tools/call` ping returns `pong`
- [ ] Invalid host header on `/mcp` returns 403
- [ ] Optional: stateful session header behavior test (`MCP_STATEFUL_SESSIONS` or equivalent)
- [ ] Regression: `/mcp` is not captured by SPA static fallback (`GET /mcp` not `index.html`)

### Verification Commands

- [ ] `bun run --filter @durabull/api test` (MCP tests)
- [ ] `bun run --filter @durabull/api typecheck`
- [ ] `bun run --filter @durabull/api lint`
- [ ] Local manual smoke: API port `POST http://localhost:3000/mcp` (initialize + ping)

### Exit Criteria

- [ ] Remote/local client can call `ping` at `{baseUrl}/mcp` on the **same port** as the API (for example `http://localhost:3000/mcp`).

---

## PR-03: OAuth Discovery + Token Validation Middleware

### Objective

Implement spec-aligned auth discovery and request authentication for remote MCP on `/mcp` (same origin as API).

### Deliverables

- [ ] Protected Resource Metadata endpoint (`.well-known/oauth-protected-resource` pathing on app origin).
- [ ] `WWW-Authenticate` challenge responses with metadata URL on unauthenticated `/mcp` requests.
- [ ] Bearer token requirement on **every** MCP request to `/mcp` (`GET`, `POST`, `DELETE`).
- [ ] Audience/resource binding validation against `${APP_BASE_URL}/mcp`.
- [ ] 401/403 semantics aligned to spec.
- [ ] Canonical resource URI handling documented for operators and client config.

### File Targets

- [ ] `apps/api/src/mcp/auth/*` (or equivalent)
- [ ] `apps/api/src/app.ts` (well-known routes if mounted at app root)
- [ ] tests under `apps/api/src/mcp/` or `apps/api/src/routes/`

### Tests

- [ ] Unauthenticated request gets 401 + proper challenge header.
- [ ] Invalid token gets 401.
- [ ] Wrong audience/resource token gets 401.
- [ ] Missing scope gets 403 with precise scope challenge.
- [ ] Valid token path succeeds.

### Verification

- [ ] OAuth metadata and PRM docs render correctly.
- [ ] End-to-end auth flow test from a sample MCP client fixture.

### Exit Criteria

- [ ] MCP requests cannot execute without valid scoped bearer auth.

---

## PR-04: Principals + Policy Engine (Least Privilege Core)

### Objective

Add principal resolution and authorization policy enforcement for both identity models.

### Deliverables

- [ ] Principal types:
  - [ ] Delegated user principal
  - [ ] Service account principal (org-scoped)
- [ ] Policy engine for tool-level authorization.
- [ ] Org and connection ownership checks integrated into authorization context.
- [ ] Service account credential model (secure secret hashing, rotation path).
- [ ] Policy decision audit fields (`principal`, `org`, `connection`, `scope`, `tool`, `decision`).

### Data/Schema Work

- [ ] Add required DAL schema/migration for service accounts and policy bindings.
- [ ] Add repository methods with tests.

### Tests

- [ ] User principal with proper org access succeeds.
- [ ] Cross-org access denied.
- [ ] Service account with down-scoped token can only access allowed tools.
- [ ] Revoked/rotated service account secret fails auth.

### Exit Criteria

- [ ] Every tool call passes through a centralized policy decision point.

### File Targets

- [ ] `apps/api/src/mcp/policy/*` (or `apps/api/src/mcp/*`)
- [ ] `packages/dal/*` migrations/repositories for service accounts
- [ ] tests in `apps/api` and `packages/dal`

---

## PR-05: Read-Only Diagnostic Tool Surface (Customer Value Slice)

### Objective

Ship useful read-only tools using existing Durabull domain logic.

### Tool Set (Phase 1 GA)

- [ ] `list_connections`
- [ ] `list_queues`
- [ ] `get_queue`
- [ ] `list_jobs`
- [ ] `get_job`
- [ ] `get_job_logs`
- [ ] `get_job_stacktraces`
- [ ] `get_failure_events`
- [ ] `get_queue_metrics`
- [ ] `get_workers`
- [ ] `explain_job_failure` (composed diagnostic summary)

### Tool Implementation Rules

- [ ] Strict Zod schemas for every input.
- [ ] Pagination and upper bounds on list/log/stacktrace endpoints.
- [ ] Stable error taxonomy (`validation_error`, `forbidden`, `not_found`, etc.).
- [ ] Annotate read-only hints in tool metadata.
- [ ] Register tools in `apps/api/src/mcp/server.ts` (or sibling module); call shared domain services only.

### File Targets

- [ ] `apps/api/src/mcp/tools/*`
- [ ] shared domain adapters (`apps/api/src/lib/domain/*` or `packages/mcp-domain`)
- [ ] existing API route modules reused via adapters (not duplicated Hono handler logic)

### Tests

- [ ] Contract tests for each tool schema and response shape.
- [ ] Tool output tests for representative failed jobs.
- [ ] Large log pagination tests.
- [ ] Failure explanation composition tests.

### Exit Criteria

- [ ] MCP clients can perform real-world queue failure triage end-to-end.

---

## PR-06: Safety Hardening (Redaction + Rate Limits + Auditability)

### Objective

Prevent data leaks and abuse while preserving diagnostic utility.

### Deliverables

- [ ] Output redaction policy for sensitive fields (redis URLs, secrets, risky payload fields).
- [ ] Per-principal + per-tool rate limiting.
- [ ] Structured audit logs for all tool invocations.
- [ ] Correlation IDs and trace context through MCP call pipeline.
- [ ] Alerting hooks for 401/403/429 spikes and anomalous usage.

### Tests

- [ ] Redaction tests (sensitive values never returned).
- [ ] Rate-limit threshold tests.
- [ ] Audit event emission tests.
- [ ] Log integrity tests (decision + identity + scope recorded).

### Exit Criteria

- [ ] Safety controls are enforced even for valid authenticated callers.

---

## PR-07: Deployment + Operations (Cloud and Self-Host)

### Objective

Document and verify MCP on the **unified** Durabull deployment (API + web + `/mcp` on one service/port) for cloud and self-host.

### Deliverables

- [ ] Cloud deployment docs updated (Render single web service; `https://app.durabull.io/mcp`).
- [ ] Self-host Docker/compose docs: one port, `/mcp` path (remove `MCP_PORT` / `:3020` publish if present).
- [ ] Environment variable contract (`APP_BASE_URL`, optional MCP enable flag, host allowlist notes).
- [ ] TLS and ingress guidance: path-based `/mcp` on app domain (no second hostname required).
- [ ] Operator runbook for key rotation, auth failures, and MCP client URL configuration.
- [ ] Dashboards/metrics definitions for `/mcp` auth failures and tool error rates on unified service.

### File Targets

- [ ] `apps/docs/content/documentation/deployment/*`
- [ ] `apps/docs/content/documentation/getting-started/environment-variables.mdx`
- [ ] `tooling/docker/Dockerfile` and `tooling/docker/docker-compose.self-hosted.yaml`
- [ ] `render.yaml` or cloud blueprint references (if present in repo)

### Tests/Validation

- [ ] Staging deploy succeeds with `/mcp` reachable on app domain.
- [ ] Self-host smoke: `GET /api/health` and MCP `initialize` on same host/port.
- [ ] Runbook dry-run performed and documented.

### Exit Criteria

- [ ] Operators can deploy and maintain MCP at `{APP_BASE_URL}/mcp` without a separate MCP service.

---

## PR-08: GA Readiness + Security Closure

### Objective

Finalize production quality and confirm spec/safety compliance.

### Deliverables

- [ ] Spec compliance checklist completed (MCP auth discovery + OAuth semantics + transport behavior).
- [ ] Security review closure checklist completed.
- [ ] Performance baseline and error-budget/SLO proposal documented.
- [ ] Final user/operator docs published.
- [ ] Release checklist and rollback procedure included.

### Full Validation Suite

- [ ] End-to-end delegated-user flow from supported MCP client.
- [ ] End-to-end service-account automation flow.
- [ ] Negative test suite (invalid token, wrong audience, wrong scope, cross-org attempt).
- [ ] Regression suite across existing API behavior touched by shared modules.
- [ ] Soak test for logs/stacktrace-heavy usage.

### Exit Criteria

- [ ] MCP read-only GA approved for production rollout.

---

## Running History Ledger (Update Per PR)

> Copy this block for each PR and append entries as work progresses.

### PR Record Template

- PR ID: `PR-0X`
- Branch:
- Linear issue:
- PR URL:
- Status: `not started | in progress | in review | merged | blocked`
- Agent owner:
- Start date:
- Merge date:

#### Scope Completed

- [ ] Item 1
- [ ] Item 2
- [ ] Item 3

#### Verification Evidence

- [ ] Commands run:
  - [ ] `...`
  - [ ] `...`
- [ ] Tests added:
  - [ ] `...`
- [ ] Security checks:
  - [ ] `...`

#### Safety Signoff

- [ ] No destructive capability introduced.
- [ ] Authz boundaries verified.
- [ ] Sensitive output redaction verified.

#### Handoff To Next PR

- Next PR:
- Known risks:
- Follow-up tasks:
- Notes for next agent:

---

### PR Record: PR-01

- PR ID: `PR-01`
- Branch: `feat/no-linear-mcp-pr01-security-baseline`
- Linear issue: `NO-LINEAR (temporary; to be backfilled before merge if required)`
- PR URL:
- Status: `in progress`
- Agent owner: `codex`
- Start date: `2026-05-26`
- Merge date:

#### Scope Completed

- [x] ADR for MCP architecture boundaries, threat model, and scope taxonomy.
- [x] Decision record for phase-1 read-only GA and write-tool deferral.
- [x] Operations security docs updated with MCP baseline guidance.
- [ ] Permission matrix review signoff in PR thread.
- [ ] Security design walkthrough evidence captured in PR description.

#### Verification Evidence

- [x] Commands run:
  - [x] `bun run lint --filter @durabull/docs`
  - [x] `bun run typecheck --filter @durabull/docs`
  - [x] `git status --short --branch && git diff --name-only` (docs/tasks/adr scoped diff only)
- [x] Tests added:
  - [x] Documentation-only PR; no runtime tests introduced in PR-01.
- [x] Security checks:
  - [x] Explicitly confirmed no destructive MCP capability introduced.
  - [x] Scope taxonomy and principal boundaries documented.

#### Safety Signoff

- [x] No destructive capability introduced.
- [x] Authz boundaries verified.
- [ ] Sensitive output redaction verified.

#### Handoff To Next PR

- Next PR: `PR-02`
- Known risks: runtime enforcement is not in this PR and must be implemented in PR-02/03/04.
- Follow-up tasks:
  - backfill Linear issue link if merge policy requires it.
  - amend ADR-0001 deployable wording (dedicated `apps/mcp` → API `/mcp` ingress) when landing PR-02.
- Notes for next agent:
  - treat ADR-0001 as source of truth for phase-1 **security** boundaries.
  - **do not** build standalone `apps/mcp`; mount MCP on `apps/api` at `/mcp` (see Hosting model section above).
- PR-01 acceptance statement for PR body: `This PR defines security and scope contracts only; no MCP runtime behavior is introduced.`

---

### PR Record: PR-02

- PR ID: `PR-02`
- Branch: `cursor/mcp-pr02-api-ingress`
- Linear issue: `NO-LINEAR (temporary)`
- PR URL: https://github.com/durabullhq/durabull/pull/88
- Status: `merged`
- Agent owner: `cursor`
- Start date: `2026-05-26`
- Merge date: `2026-05-26`

#### Scope Completed

- [x] `@durabull/mcp` package with transport, host validation, server bootstrap, and `ping` smoke tool.
- [x] Thin ingress at `apps/api/src/mcp/mount.ts` mounted in `createApiApp()` at `/mcp`.
- [x] Streamable HTTP on `/mcp` (`GET` + `POST` + `DELETE` via `@hono/mcp`).
- [x] Host header validation including `APP_BASE_URL` host.
- [x] Integration tests via `createApiApp()` (initialize, tools/list, tools/call ping).
- [x] No standalone `apps/mcp` deployable or second public MCP port.

#### Verification Evidence

- [x] Commands run:
  - [x] `bun run --filter @durabull/mcp test`
  - [x] `bun run --filter @durabull/api test src/mcp/mount.test.ts`
  - [x] `bun run --filter @durabull/mcp typecheck`
  - [x] `bun run --filter @durabull/mcp lint`
- [x] Tests added:
  - [x] `packages/mcp/src/config/allowed-hosts.test.ts`
  - [x] `packages/mcp/src/routes.test.ts`
  - [x] `apps/api/src/mcp/mount.test.ts`

#### Handoff To Next PR

- Next PR: `PR-03`
- Known risks: MCP transport is currently unauthenticated (auth deferred to PR-03).
- Notes for next agent: add OAuth discovery + bearer validation on `/mcp`; canonical resource URI `${APP_BASE_URL}/mcp`.

---

### PR Record: PR-03

- PR ID: `PR-03`
- Branch: `cursor/mcp-pr03-oauth-discovery-token-validation`
- Linear issue: `NO-LINEAR (temporary)`
- PR URL: https://github.com/durabullhq/durabull/pull/89
- Status: `in review`
- Agent owner: `cursor`
- Start date: `2026-05-26`
- Merge date:

#### Scope Completed

- [x] Protected Resource Metadata at `GET /.well-known/oauth-protected-resource` on app origin.
- [x] `WWW-Authenticate` challenges on unauthenticated `/mcp` requests (`resource_metadata` URL).
- [x] Bearer required on all `/mcp` methods via Better Auth `getMcpSession` + Durabull scope middleware.
- [x] Expired access tokens rejected with `401` (`isMcpAccessTokenExpired` after `getMcpSession`).
- [x] Canonical resource URI `${APP_BASE_URL}/mcp` in PRM and validation helpers.
- [x] `401` / `403` semantics (invalid token vs insufficient scope).
- [x] Better Auth `mcp` plugin + `oauth_*` DAL tables/migration.
- [x] Session registry: new sessions only on `initialize`; cap at 256 sessions.
- [x] Operator doc `docs/mcp-oauth-operator.md`.

#### Verification Evidence

- [x] Commands run:
  - [x] `bun run --filter @durabull/mcp test` (30 pass)
  - [x] `bun run --filter @durabull/api test src/mcp/` (7 pass)
  - [x] `bun run --filter @durabull/mcp typecheck`
  - [x] `bun run --filter @durabull/auth typecheck`
  - [x] Live e2e: `cd tooling/scripts && APP_BASE_URL=http://localhost:3001 bun run mcp:e2e` (10/10 Better Auth, 9/9 authless)
- [x] Tests added:
  - [x] `packages/mcp/src/auth/validate-token.test.ts`
  - [x] `packages/mcp/src/auth/bearer-middleware.test.ts`
  - [x] `packages/mcp/src/auth/session.test.ts`
  - [x] Updated `packages/mcp/src/routes.test.ts` (401, session guard)
  - [x] Updated `apps/api/src/mcp/mount.test.ts` (401, PRM, ping flow, expired OAuth token)
  - [x] `tooling/scripts/mcp-e2e-smoke.ts` (repeatable live smoke)

#### Handoff To Next PR

- Next PR: `PR-04`
- Known risks: RFC 8707 `resource` binding on opaque tokens is not persisted at issuance yet (`resource` column ready; wire in token handler when enabling full OAuth client flows).
- Notes for next agent: add principal resolver + policy engine; enforce org/connection boundaries on tool calls.

---

## Live PR Tracker

- [ ] PR-01 Security architecture baseline (in progress on `feat/no-linear-mcp-pr01-security-baseline`)
- [x] PR-02 API `/mcp` ingress + transport (`@durabull/mcp` package + thin API mount)
- [ ] PR-03 OAuth discovery + token validation (in review — PR #89)
- [ ] PR-04 Principals + policy engine
- [ ] PR-05 Read-only diagnostic tools
- [ ] PR-06 Safety hardening
- [ ] PR-07 Deployment + operations
- [ ] PR-08 GA readiness + security closure

---

## Definition Of Done (Program-Level)

- [ ] Hosted MCP available at `{APP_BASE_URL}/mcp` on unified deployment (cloud + self-host).
- [ ] Read-only jobs/failures/logs/diagnostics tools fully functional.
- [ ] Delegated users and service accounts both supported.
- [ ] OAuth/tokening and least-privilege permissions enforced.
- [ ] Security review complete with no open critical findings.
- [ ] Operational dashboards/runbooks in place.
- [ ] Documentation complete for users, operators, and future implementers.
