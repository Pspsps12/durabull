# MCP Readiness Review — Post PR-05 / PR-06 (2026-05-28)

**Branch:** `feat/no-linear-mcp-pr06-safety-hardening`  
**Plan position:** PR-06 safety hardening in progress; PR-07 deployment/ops is next.

---

## Executive summary

| Dimension | Verdict |
| --- | --- |
| **Read-only diagnostic catalog** | **Complete** — all 11 tools + `ping` merged on `main` (PR #94, #97). |
| **Authorization** | **Complete** — principals, policy engine, org/connection boundaries (PR #94). |
| **Safety hardening (PR-06)** | **In progress** — redaction, per-tool rate limits, expanded audit, telemetry. |
| **Production / GA** | **Not ready** — deployment runbooks (PR-07) and security closure (PR-08) remain. |

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
| PR-07 | Cloud/self-host deploy docs, env contract, operator runbooks |
| PR-08 | Security review closure, GA docs, staged E2E verification |

---

## Quick commands

```bash
bun run --filter @durabull/mcp test
bun run --filter @durabull/api test src/mcp/

cd tooling/scripts && APP_BASE_URL=http://localhost:3001 bun run mcp:e2e
```

See [MCP Server docs](/documentation/integrations/mcp-server) in the docs app for operator-facing guidance.
