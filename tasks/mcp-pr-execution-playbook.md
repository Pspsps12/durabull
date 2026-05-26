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

## Skateboard Approach (Incremental Product Slices)

Each PR must deliver a usable, testable increment:

1. Security model + contracts are explicit.
2. MCP service runs and is callable.
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
- PR-02: `apps/mcp` scaffold + MCP transport wiring + conformance harness
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

- Branch: `feat/<linear-id>-mcp-pr02-service-scaffold`
- Title: `<linear-id>: MCP PR-02 service scaffold and transport`
- Must include:
  - [ ] `apps/mcp` file tree summary
  - [ ] transport wiring explanation (`GET`/`POST`)
  - [ ] host-header validation proof
  - [ ] smoke tool call evidence (`ping`)
- Acceptance statement to include verbatim:
  - `This PR establishes MCP runtime scaffolding only and does not expose production domain tools.`

### PR-03 Template

- Branch: `feat/<linear-id>-mcp-pr03-oauth-discovery-token-validation`
- Title: `<linear-id>: MCP PR-03 OAuth discovery and token validation`
- Must include:
  - [ ] PRM endpoint proof
  - [ ] `WWW-Authenticate` challenge example
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
  - [ ] cloud deploy evidence
  - [ ] self-host smoke evidence
  - [ ] env contract docs
  - [ ] operator runbook links
- Acceptance statement to include verbatim:
  - `This PR makes the MCP service deployable and operable in cloud-hosted and self-hosted environments.`

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

## PR-02: MCP Service Scaffold + Transport

### Objective

Create a dedicated `apps/mcp` service that runs MCP Streamable HTTP transport with basic lifecycle, no privileged tools yet.

### Deliverables

- [ ] New `apps/mcp` package scaffold.
- [ ] MCP server bootstrap with server metadata and versioning.
- [ ] Streamable HTTP endpoints (`GET` + `POST`) wired.
- [ ] Host header validation and safe defaults.
- [ ] Health/readiness endpoints for orchestration.
- [ ] Minimal smoke tool (non-domain `ping`) for transport validation.

### File Targets

- [ ] `apps/mcp/src/index.ts`
- [ ] `apps/mcp/src/server.ts`
- [ ] `apps/mcp/package.json`
- [ ] workspace/turbo wiring as needed

### Tests

- [ ] Transport integration test (`initialize`, `tools/list`, `tools/call` ping).
- [ ] Session mode behavior test (stateful vs stateless decision).
- [ ] Invalid host header rejection test.

### Verification Commands

- [ ] Service starts locally.
- [ ] MCP smoke test script succeeds.
- [ ] Touched package lint/typecheck/tests pass.

### Exit Criteria

- [ ] Remote client can connect and call `ping` successfully.

---

## PR-03: OAuth Discovery + Token Validation Middleware

### Objective

Implement spec-aligned auth discovery and request authentication for remote MCP.

### Deliverables

- [ ] Protected Resource Metadata endpoint (`.well-known/oauth-protected-resource` pathing).
- [ ] `WWW-Authenticate` challenge responses with metadata URL.
- [ ] Bearer token requirement on **every** MCP request (`GET` and `POST`).
- [ ] Audience/resource binding validation.
- [ ] 401/403 semantics aligned to spec.
- [ ] Canonical resource URI handling.

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

Make the MCP service deployable and operable in both hosted modes.

### Deliverables

- [ ] Cloud deployment manifest/config updates.
- [ ] Self-host deployment path (docker/env/docs) for MCP service.
- [ ] Environment variable contract documentation.
- [ ] TLS and ingress guidance for remote MCP.
- [ ] Operator runbook for key rotation and incident response.
- [ ] Dashboards/metrics definitions for service health and auth failures.

### Tests/Validation

- [ ] Staging deploy succeeds.
- [ ] Self-host local smoke test succeeds.
- [ ] Runbook dry-run performed and documented.

### Exit Criteria

- [ ] Operators can deploy and maintain MCP in both hosting modes.

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

## Live PR Tracker

- [ ] PR-01 Security architecture baseline
- [ ] PR-02 MCP service scaffold + transport
- [ ] PR-03 OAuth discovery + token validation
- [ ] PR-04 Principals + policy engine
- [ ] PR-05 Read-only diagnostic tools
- [ ] PR-06 Safety hardening
- [ ] PR-07 Deployment + operations
- [ ] PR-08 GA readiness + security closure

---

## Definition Of Done (Program-Level)

- [ ] Hosted MCP server available (cloud + self-host).
- [ ] Read-only jobs/failures/logs/diagnostics tools fully functional.
- [ ] Delegated users and service accounts both supported.
- [ ] OAuth/tokening and least-privilege permissions enforced.
- [ ] Security review complete with no open critical findings.
- [ ] Operational dashboards/runbooks in place.
- [ ] Documentation complete for users, operators, and future implementers.
