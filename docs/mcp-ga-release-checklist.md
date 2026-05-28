# MCP Phase 1 — Release and Rollback Checklist

Use this checklist when enabling or announcing read-only MCP GA on Durabull Cloud or self-hosted installs.

## Pre-release

- [ ] `main` includes PR-02 through PR-08 (GA docs + ADR).
- [ ] Automated tests green:
  - [ ] `bun run --filter @durabull/mcp test`
  - [ ] `bun run --filter @durabull/api test src/mcp/`
  - [ ] `bun test packages/dal/src/repositories/mcp-policy.test.ts`
- [ ] [Compliance checklist](./mcp-ga-compliance-checklist.md) reviewed.
- [ ] [Security closure](./mcp-ga-security-closure.md) reviewed.
- [ ] Staging: PRM + health checks per [mcp-operations-runbook.md](./mcp-operations-runbook.md).
- [ ] Staging: `cd tooling/scripts && APP_BASE_URL=<staging> bun run mcp:e2e` (staging DB only).
- [ ] Production config: `APP_BASE_URL` matches public URL; `DURABULL_AUTHLESS=false`.
- [ ] Docs published: [MCP Server](https://github.com/durabullhq/durabull/blob/main/apps/docs/content/documentation/integrations/mcp-server.mdx), operator guides linked.

## Release steps

1. Deploy unified API/web service (MCP is always on at `/mcp`).
2. Verify `GET /.well-known/oauth-protected-resource` returns `resource: {APP_BASE_URL}/mcp`.
3. Verify `POST /mcp` without bearer returns `401` with `WWW-Authenticate`.
4. Smoke `ping` with a valid OAuth token scoped `mcp:discover`.
5. Enable customer comms / docs link for MCP integration.
6. Monitor `mcp_telemetry` for `policy_denied`, `rate_limited_*`, `tool_error` spikes (see runbook).

## Performance baseline (initial)

Observed in local CI-style runs (2026-05-28); treat as order-of-magnitude, not SLO contract:

| Suite | Duration | Count |
| --- | --- | --- |
| `@durabull/mcp` unit tests | ~105 ms | 41 tests |
| `@durabull/api` MCP integration | ~870 ms | 33 tests (includes PG migrations) |

**Proposed initial SLOs (operator tuning):**

| Signal | Target | Notes |
| --- | --- | --- |
| MCP tool p95 latency | < 5s for `list_jobs`; < 15s for `explain_job_failure` | Depends on Redis/queue size |
| MCP tool error rate | < 1% excluding client 4xx | Exclude 401/403 from SLO numerator |
| Auth failure rate | Stable vs baseline | Spike may indicate misconfigured clients |
| Rate limit 429 rate | < 0.1% of tool calls | Tune limits if legitimate automation hits ceiling |

## Rollback

MCP shares the API deployable — rollback is **revert/deploy previous API image**, not a separate MCP service.

| Scenario | Action |
| --- | --- |
| MCP-specific regression | Revert MCP commits or deploy previous release tag; `/api/*` rolls back with same artifact |
| Auth storm / abuse | Block `/mcp` at edge temporarily; rotate OAuth secrets; review `mcp_audit_event` |
| Data leak concern | Disable public ingress to app; rotate credentials; inspect audit + telemetry |
| Rate limit false positives | Set `DISABLE_RATE_LIMIT=true` only as **temporary** break-glass (not recommended) |

After rollback:

1. Confirm `GET /api/health` on previous version.
2. Confirm clients receive expected 404/401 if MCP removed (if full revert).
3. Post-incident: update compliance checklist and open follow-up PR.

## Post-release (7 days)

- [ ] Review `mcp_audit_event` volume and deny reasons.
- [ ] Review `mcp_telemetry` deny/limit rates vs baseline.
- [ ] Confirm no unexpected OAuth client registration volume.
- [ ] Capture customer feedback on scope/tool gaps for phase 2 planning.
