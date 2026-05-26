import type { Auth } from '@durabull/auth'
import {
  extractBearerToken,
  isMcpAccessTokenExpired,
  MCP_TRANSPORT_REQUIRED_SCOPES,
  missingScopes,
  parseScopeString,
  tokenHasScopes,
} from '@durabull/mcp/auth'
import { withMcpAuth } from 'better-auth/plugins'
import { createMiddleware } from 'hono/factory'

import { getAuth } from '../../lib/auth'
import { isAuthlessMode } from '../../lib/authless'
import { AUTHLESS_MCP_BEARER_TOKEN, getMcpAuthConfig } from './verify-access-token'

export type McpSession = NonNullable<Awaited<ReturnType<Auth['api']['getMcpSession']>>>

function buildInvalidTokenResponse(resourceMetadataUrl: string): Response {
  const wwwAuthenticateValue = `Bearer error="invalid_token", error_description="The access token is invalid or expired", resource_metadata="${resourceMetadataUrl}"`

  return Response.json(
    {
      jsonrpc: '2.0',
      error: {
        code: -32_000,
        message: 'Unauthorized: Authentication required',
      },
      id: null,
    },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': wwwAuthenticateValue,
        'Access-Control-Expose-Headers': 'WWW-Authenticate',
      },
    }
  )
}

function buildInsufficientScopeResponse(
  resourceMetadataUrl: string,
  requiredScopes: readonly string[]
): Response {
  const scopeList = requiredScopes.join(' ')
  const wwwAuthenticateValue = `Bearer error="insufficient_scope", scope="${scopeList}", resource_metadata="${resourceMetadataUrl}"`

  return Response.json(
    {
      jsonrpc: '2.0',
      error: {
        code: -32_003,
        message: 'Forbidden: Insufficient scope',
        data: { required_scopes: [...requiredScopes] },
      },
      id: null,
    },
    {
      status: 403,
      headers: {
        'WWW-Authenticate': wwwAuthenticateValue,
        'Access-Control-Expose-Headers': 'WWW-Authenticate',
      },
    }
  )
}

function buildAuthlessMcpSession(accessToken: string): McpSession {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
  return {
    accessToken,
    refreshToken: 'authless-refresh',
    accessTokenExpiresAt: expiresAt,
    refreshTokenExpiresAt: expiresAt,
    clientId: 'authless-mcp-client',
    userId: 'authless-user',
    scopes: MCP_TRANSPORT_REQUIRED_SCOPES.join(' '),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/**
 * MCP bearer auth using Better Auth's `getMcpSession` / `withMcpAuth` (same-process).
 * Adds Durabull phase-1 scope checks (`mcp:discover`) on top of token validation.
 *
 * @see https://better-auth.com/docs/plugins/mcp
 */
export async function createMcpSessionMiddleware(appBaseUrl: string) {
  const { resourceMetadataUrl } = getMcpAuthConfig(appBaseUrl)

  if (isAuthlessMode()) {
    return createMiddleware(async (c, next) => {
      const token = extractBearerToken(c.req.header('Authorization'))
      if (token !== AUTHLESS_MCP_BEARER_TOKEN) {
        const wwwAuthenticateValue = `Bearer resource_metadata="${resourceMetadataUrl}"`
        return Response.json(
          {
            jsonrpc: '2.0',
            error: {
              code: -32_000,
              message: 'Unauthorized: Authentication required',
            },
            id: null,
          },
          {
            status: 401,
            headers: {
              'WWW-Authenticate': wwwAuthenticateValue,
              'Access-Control-Expose-Headers': 'WWW-Authenticate',
            },
          }
        )
      }

      c.set('mcpSession', buildAuthlessMcpSession(token))
      return next()
    })
  }

  const auth = await getAuth()

  return createMiddleware(async (c, next) => {
    const session = await auth.api.getMcpSession({ headers: c.req.raw.headers })

    if (!session) {
      return withMcpAuth(auth, async () => new Response(null, { status: 204 }))(c.req.raw)
    }

    if (isMcpAccessTokenExpired(session.accessTokenExpiresAt)) {
      return buildInvalidTokenResponse(resourceMetadataUrl)
    }

    const grantedScopes = parseScopeString(session.scopes)
    if (!tokenHasScopes(grantedScopes, MCP_TRANSPORT_REQUIRED_SCOPES)) {
      return buildInsufficientScopeResponse(
        resourceMetadataUrl,
        missingScopes(grantedScopes, MCP_TRANSPORT_REQUIRED_SCOPES)
      )
    }

    c.set('mcpSession', session)
    return next()
  })
}

declare module 'hono' {
  interface ContextVariableMap {
    mcpSession: McpSession
  }
}
