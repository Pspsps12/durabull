# MCP Phase 1 — Security Review Closure

**Review date:** 2026-05-28  
**Scope:** Read-only hosted MCP (PR-02–PR-07 on `main`, PR-08 GA closure)  
**ADR:** [0001-mcp-security-architecture.md](./adr/0001-mcp-security-architecture.md)

## Review summary

Phase 1 MCP is approved for **read-only GA** subject to the operational gates in [mcp-ga-release-checklist.md](./mcp-ga-release-checklist.md). No **critical** or **high** open findings block rollout. Medium/low items are documented as accepted debt or operator prerequisites.

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| SEC-01 | — | Missing formal ADR / threat model file | **Closed** — ADR-0001 added in PR-08 |
| SEC-02 | Low | In-memory rate limits are per-process | **Accepted** — documented; Redis-backed limits phase 2 |
| SEC-03 | Low | `mcp:e2e` registers OAuth clients and writes DB tokens | **Accepted** — staging/local only; runbook warnings |
| SEC-04 | Low | Dynamic OAuth client registration is unauthenticated (rate-limited) | **Accepted** — edge monitoring guidance in operator doc |
| SEC-05 | Info | Domain logic in API handlers vs `packages/mcp-domain` | **Accepted** — same tenancy checks as REST; extraction optional |
| SEC-06 | — | No write/destructive MCP tools in phase 1 | **Verified** — tool registry is read-only |
| SEC-07 | — | Cross-org `connectionId` denied for delegated users | **Verified** — `mount.test.ts` |
| SEC-08 | — | Service account requires policy binding + scopes | **Verified** — `mount.test.ts`, `mcp-policy.test.ts` |
| SEC-09 | — | Output redaction for secrets/Redis URLs | **Verified** — `sanitize-output.test.ts` |
| SEC-10 | — | RFC 8707 resource enforced on validation | **Verified** — `validate-token.test.ts`; issuance via Better Auth |

## Negative test coverage (automated)

| Scenario | Expected | Test location |
| --- | --- | --- |
| Missing bearer | 401 + WWW-Authenticate | `bearer-middleware.test.ts`, `mount.test.ts` |
| Invalid bearer | 401 | `mount.test.ts` |
| Expired token | 401 | `mount.test.ts` |
| Wrong resource | 401 | `bearer-middleware.test.ts` |
| Missing `mcp:discover` | 403 | `mount.test.ts` |
| Missing tool scope (`mcp:jobs:read`, etc.) | 403 | `mount.test.ts` |
| SA without policy binding | 403 policy deny | `mount.test.ts` |
| Delegated user wrong connection | 403 | `mount.test.ts` |
| Invalid Host | 403 | `mount.test.ts`, `routes.test.ts` |
| Per-tool rate limit | 429 JSON-RPC | `mcp-tool-rate-limit.test.ts` |

## Manual / staging gates (before production announcement)

1. Run [mcp-operations-runbook.md](./mcp-operations-runbook.md) post-deploy checks on **staging**.
2. Run `mcp:e2e` against staging only (`APP_BASE_URL` = staging origin).
3. Validate one **delegated-user** MCP client flow (real OAuth client + PKCE).
4. Validate one **service-account** flow (bindings + least-privilege scopes).
5. Confirm `DURABULL_AUTHLESS=false` and `APP_BASE_URL` match public ingress on production.

## Security sign-off

| Reviewer | Role | Date | Approved |
| --- | --- | --- | --- |
| | Engineering | 2026-05-28 | Yes — automated controls + tests |
| | Security / owner | | Pending human sign-off if required by release process |
