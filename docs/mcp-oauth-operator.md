# MCP OAuth operator guide

Durabull hosts MCP on the same origin as the web app and API. Remote MCP clients must authenticate with OAuth 2.1 bearer tokens scoped for MCP.

Durabull uses the [Better Auth MCP plugin](https://better-auth.com/docs/plugins/mcp) for OAuth provider behavior, token validation (`getMcpSession` / `withMcpAuth`), and protected-resource metadata. Durabull adds phase-1 scope enforcement (`mcp:discover`, etc.) on top of Better Auth's session handling.

## Canonical resource URI

Use this value for RFC 8707 resource indicators and audience checks:

```text
{APP_BASE_URL}/mcp
```

Example (production): `https://app.durabull.io/mcp`

Do not add a trailing slash unless your OAuth client library requires it consistently everywhere.

`APP_BASE_URL` must be the **public origin clients use to reach `/mcp`** (same host/port as the API in production). If the API listens on port `3001` locally, set `APP_BASE_URL=http://localhost:3001`, not the Vite dev server port.

## Discovery endpoints

Better Auth serves OAuth metadata under `/api/auth/.well-known/*`. Durabull also exposes app-origin fallbacks for MCP clients that ignore `WWW-Authenticate` (per Better Auth docs):

| Endpoint | Purpose |
| --- | --- |
| `GET /.well-known/oauth-protected-resource` | PRM fallback (wraps `oAuthProtectedResourceMetadata`) |
| `GET /.well-known/oauth-authorization-server` | AS metadata fallback (wraps `oAuthDiscoveryMetadata`) |
| `GET /api/auth/.well-known/oauth-protected-resource` | PRM (Better Auth primary) |
| `GET /api/auth/.well-known/oauth-authorization-server` | Authorization Server Metadata (RFC 8414) |

Protected resource metadata advertises:

- `resource`: `{APP_BASE_URL}/mcp`
- `authorization_servers`: Better Auth base URL (e.g. `https://app.durabull.io/api/auth`); use `authorization_endpoint` from AS metadata for `/api/auth/mcp/authorize`
- `scopes_supported`: phase-1 MCP read scopes (`mcp:discover`, `mcp:jobs:read`, …) — prefer PRM over AS metadata for MCP scope discovery

## Client configuration checklist

1. Register an OAuth client via `POST /api/auth/mcp/register` (or the Durabull UI when available).
2. Complete authorization code + PKCE against `/api/auth/mcp/authorize`.
3. Exchange the code at `/api/auth/mcp/token` with `resource={APP_BASE_URL}/mcp`.
4. Call MCP transport at `POST/GET/DELETE {APP_BASE_URL}/mcp` with `Authorization: Bearer <access_token>`.
5. Request at least the `mcp:discover` scope for transport smoke (`ping`). Diagnostic tools require additional scopes (`mcp:jobs:read`, `mcp:logs:read`, `mcp:failures:read`, `mcp:diagnostics:read`) — see [MCP Server docs](https://github.com/durabullhq/durabull/blob/main/apps/docs/content/documentation/integrations/mcp-server.mdx).

Dynamic client registration (`POST /api/auth/mcp/register`) is rate-limited (**20 registrations/minute** per bearer or `cf-connecting-ip` / `x-real-ip`) but unauthenticated. Configure your edge to set one of those headers if you rely on per-IP limits behind a proxy. Monitor registration volume on public deployments and block at the edge if abused.

## HTTP semantics

| Condition | Status | Notes |
| --- | --- | --- |
| Missing / invalid bearer | `401` | Includes `WWW-Authenticate` with `resource_metadata` URL |
| Wrong resource binding | `401` | Token `resource` must match canonical URI when set |
| Missing required scope | `403` | `WWW-Authenticate` includes `error="insufficient_scope"` and required scopes |
| Invalid `Host` header | `403` | Host allowlist enforced before auth |

## Authless development

When `DURABULL_AUTHLESS=true`, use bearer token from `MCP_AUTHLESS_BEARER_TOKEN`. A built-in default exists only for **local non-production** dev (`durabull-authless-mcp`) — treat it as public knowledge and never expose authless on a reachable network without a strong rotated secret.

Never enable authless mode on Durabull Cloud (`DURABULL_CLOUD=true` refuses startup with authless enabled). **Internet-facing production must use OAuth** (`DURABULL_AUTHLESS=false`). Authless with `MCP_AUTHLESS_BEARER_TOKEN` is only for isolated lab networks, not DMZ or VPN-wide production substitutes.

Access tokens must include the RFC 8707 `resource` indicator matching `{APP_BASE_URL}/mcp` (Better Auth sets this on issuance; Durabull rejects tokens without it).

## Operations

MCP is enabled by default on every Durabull deployment. For post-deploy validation, telemetry signals, rate-limit behavior, and incident triage, see [mcp-operations-runbook.md](./mcp-operations-runbook.md).
