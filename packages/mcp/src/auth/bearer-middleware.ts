import { createMiddleware } from 'hono/factory'

import { buildWwwAuthenticateChallenge, mcpAuthResponseHeaders } from './www-authenticate'
import { extractBearerToken, validateMcpAccessTokenClaims } from './validate-token'
import type { McpAccessTokenClaims } from './types'

export interface McpBearerAuthMiddlewareOptions {
  canonicalResourceUri: string
  resourceMetadataUrl: string
  requiredScopes: readonly string[]
  verifyAccessToken: (accessToken: string) => Promise<McpAccessTokenClaims | null>
}

function unauthorizedJson(challenge: string) {
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
      headers: mcpAuthResponseHeaders(challenge),
    }
  )
}

function forbiddenJson(challenge: string, missingScopes: string[]) {
  return Response.json(
    {
      jsonrpc: '2.0',
      error: {
        code: -32_003,
        message: 'Forbidden: Insufficient scope',
        data: { required_scopes: missingScopes },
      },
      id: null,
    },
    {
      status: 403,
      headers: mcpAuthResponseHeaders(challenge),
    }
  )
}

export function createMcpBearerAuthMiddleware(options: McpBearerAuthMiddlewareOptions) {
  const baseChallenge = buildWwwAuthenticateChallenge({
    resourceMetadataUrl: options.resourceMetadataUrl,
  })

  return createMiddleware(async (c, next) => {
    const bearerToken = extractBearerToken(c.req.header('Authorization'))
    if (!bearerToken) {
      return unauthorizedJson(baseChallenge)
    }

    const claims = await options.verifyAccessToken(bearerToken)
    if (!claims) {
      return unauthorizedJson(
        buildWwwAuthenticateChallenge({
          resourceMetadataUrl: options.resourceMetadataUrl,
          error: 'invalid_token',
          errorDescription: 'The access token is invalid or expired',
        })
      )
    }

    const validation = validateMcpAccessTokenClaims(claims, {
      canonicalResourceUri: options.canonicalResourceUri,
      requiredScopes: options.requiredScopes,
    })

    if (!validation.ok) {
      if (validation.status === 403) {
        const scopeChallenge = buildWwwAuthenticateChallenge({
          resourceMetadataUrl: options.resourceMetadataUrl,
          error: 'insufficient_scope',
          errorDescription: 'The access token does not include the required MCP scopes',
          scope: (validation.missingScopes ?? options.requiredScopes).join(' '),
        })
        return forbiddenJson(scopeChallenge, validation.missingScopes ?? [...options.requiredScopes])
      }

      return unauthorizedJson(
        buildWwwAuthenticateChallenge({
          resourceMetadataUrl: options.resourceMetadataUrl,
          error: 'invalid_token',
          errorDescription: 'The access token is invalid for this MCP resource',
        })
      )
    }

    c.set('mcpAccessToken', validation.claims)
    return next()
  })
}

declare module 'hono' {
  interface ContextVariableMap {
    mcpAccessToken: McpAccessTokenClaims
  }
}
