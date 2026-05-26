# MCP OAuth operator guide

Durabull hosts MCP on the same origin as the web app and API. Remote MCP clients must authenticate with OAuth 2.1 bearer tokens scoped for MCP.

## Canonical resource URI

Use this value for RFC 8707 resource indicators and audience checks:

```text
{APP_BASE_URL}/mcp
```

Example (production): `https://app.durabull.io/mcp`

Do not add a trailing slash unless your OAuth client library requires it consistently everywhere.

## Discovery endpoints (app origin)

| Endpoint | Purpose |
| --- | --- |
| `GET /.well-known/oauth-protected-resource` | Protected Resource Metadata (RFC 9728) |
| `GET /api/auth/.well-known/oauth-authorization-server` | Authorization Server Metadata (RFC 8414) |

Protected resource metadata advertises:

- `resource`: `{APP_BASE_URL}/mcp`
- `authorization_servers`: `{APP_ORIGIN}/api/auth`
- `scopes_supported`: phase-1 MCP read scopes (`mcp:discover`, `mcp:jobs:read`, …)

## Client configuration checklist

1. Register an OAuth client via `POST /api/auth/mcp/register` (or the Durabull UI when available).
2. Complete authorization code + PKCE against `/api/auth/mcp/authorize`.
3. Exchange the code at `/api/auth/mcp/token` with `resource={APP_BASE_URL}/mcp`.
4. Call MCP transport at `POST/GET/DELETE {APP_BASE_URL}/mcp` with `Authorization: Bearer <access_token>`.
5. Request at least the `mcp:discover` scope for transport smoke tools (`ping`). Diagnostic tools in later PRs require additional `mcp:*:read` scopes.

## HTTP semantics

| Condition | Status | Notes |
| --- | --- | --- |
| Missing / invalid bearer | `401` | Includes `WWW-Authenticate` with `resource_metadata` URL |
| Wrong resource binding | `401` | Token `resource` must match canonical URI when set |
| Missing required scope | `403` | `WWW-Authenticate` includes `error="insufficient_scope"` and required scopes |
| Invalid `Host` header | `403` | Host allowlist enforced before auth |

## Authless development

When `DURABULL_AUTHLESS=true`, use bearer token `durabull-authless-mcp` for local MCP requests only. Never enable authless mode in production deployments.
