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
- `authorization_servers`: app origin (e.g. `https://app.durabull.io`); use `authorization_endpoint` from AS metadata (`/api/auth/mcp/authorize`) for the OAuth server base path
- `scopes_supported`: phase-1 MCP read scopes (`mcp:discover`, `mcp:jobs:read`, …) — prefer PRM over AS metadata for MCP scope discovery

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

When `DURABULL_AUTHLESS=true`, use bearer token from `MCP_AUTHLESS_BEARER_TOKEN` (or the dev default `durabull-authless-mcp` when unset in non-production). Never enable authless mode on Durabull Cloud (`DURABULL_CLOUD=true` refuses startup with authless enabled). Self-hosted production images may use authless only on private networks with a custom `MCP_AUTHLESS_BEARER_TOKEN`.

Access tokens must include the RFC 8707 `resource` indicator matching `{APP_BASE_URL}/mcp` (Better Auth sets this on issuance; Durabull rejects tokens without it).
