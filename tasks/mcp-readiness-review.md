# MCP Readiness Review — Post PR-06 / PR-07 (2026-05-28)

**Branch:** `feat/no-linear-mcp-pr07-cloud-selfhost-ops`  
**Plan position:** PR-06 merged (#98); PR-07 deployment/ops in progress; PR-08 GA closure next.

---

## Executive summary

| Dimension | Verdict |
| --- | --- |
| **Read-only diagnostic catalog** | **Complete** — all 11 tools + `ping` merged on `main` (PR #94, #97). |
| **Authorization** | **Complete** — principals, policy engine, org/connection boundaries (PR #94). |
| **Safety hardening (PR-06)** | **Complete** — merged PR #98 (redaction, rate limits, audit, telemetry). |
| **Deployment / ops (PR-07)** | **In progress** — runbook + deployment docs (review fixes applied on branch). |
| **Production / GA** | **Not ready** — PR-07 smoke on staging + PR-08 security/E2E signoff remain. |

---

## What works today

- `/mcp` on same origin as API with OAuth bearer auth
- Full read-only diagnostic tool catalog with scope-gated policy enforcement
- Central output sanitization on all read-tool responses
- Ingress + per-tool rate limits (in-memory; per-process)
- Audit events with input hash + response class for tool invocations
- Structured `mcp_telemetry` logs for operational signals

---

## Remaining stack

| PR | Capability |
| --- | --- |
| PR-07 | Cloud/self-host deploy docs, env contract, operator runbooks (in progress) |
| PR-08 | Security review closure, GA docs, staged E2E verification |

---

## Quick commands

```bash
bun run --filter @durabull/mcp test
bun run --filter @durabull/api test src/mcp/

cd tooling/scripts && APP_BASE_URL=http://localhost:3001 bun run mcp:e2e   # API port in monorepo dev; use 3000 for Docker
```

See [MCP Server](/documentation/integrations/mcp-server) and the [MCP operations runbook](https://github.com/durabullhq/durabull/blob/main/docs/mcp-operations-runbook.md).
