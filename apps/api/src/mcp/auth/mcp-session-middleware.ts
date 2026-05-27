import {
  createMcpTokenValidationCache,
  extractBearerToken,
  MCP_TRANSPORT_REQUIRED_SCOPES,
  missingScopes,
  parseScopeString,
  validateMcpAccessTokenClaims,
} from '@durabull/mcp/auth'
import {
  buildMcpInsufficientScopeResponse,
  buildMcpMissingBearerResponse,
  buildMcpUnauthorizedResponse,
} from '@durabull/mcp/auth'
import { createMiddleware } from 'hono/factory'

import { isAuthlessMode } from '../../lib/authless'
import {
  getAuthlessMcpBearerToken,
  getMcpAuthConfig,
} from './mcp-auth-config'
import { resolveMcpSessionFromAccessToken } from './resolve-mcp-session'

/** OAuth access token session resolved for MCP ingress (Better Auth `oauth_access_token` shape). */
export interface McpSession {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: Date
  refreshTokenExpiresAt: Date
  clientId: string
  userId: string | null
  scopes: string
}

const tokenCache = createMcpTokenValidationCache()

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
  }
}

/**
 * MCP bearer auth for Durabull API ingress.
 * Validates tokens via DAL + shared `validateMcpAccessTokenClaims` (RFC 8707 resource, scopes, expiry).
 *
 * @see https://better-auth.com/docs/plugins/mcp
 */
export async function createMcpSessionMiddleware(appBaseUrl: string) {
  const { canonicalResourceUri, resourceMetadataUrl } = getMcpAuthConfig(appBaseUrl)
  const requireResourceIndicator = true

  if (isAuthlessMode()) {
    const authlessBearer = getAuthlessMcpBearerToken()

    return createMiddleware(async (c, next) => {
      const token = extractBearerToken(c.req.header('Authorization'))
      if (!token || token !== authlessBearer) {
        return token
          ? buildMcpUnauthorizedResponse(resourceMetadataUrl)
          : buildMcpMissingBearerResponse(resourceMetadataUrl)
      }

      c.set('mcpSession', buildAuthlessMcpSession(token))
      return next()
    })
  }

  return createMiddleware(async (c, next) => {
    const bearerToken = extractBearerToken(c.req.header('Authorization'))
    if (!bearerToken) {
      return buildMcpMissingBearerResponse(resourceMetadataUrl)
    }

    const cacheKey = bearerToken
    const cached = tokenCache.get(cacheKey)
    if (cached) {
      c.set('mcpSession', sessionFromClaims(cached))
      return next()
    }

    const session = await resolveMcpSessionFromAccessToken(bearerToken)
    if (!session) {
      return buildMcpUnauthorizedResponse(resourceMetadataUrl)
    }

    const claims = {
      accessToken: bearerToken,
      clientId: session.clientId,
      userId: session.userId,
      scopes: parseScopeString(session.scopes),
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      resource: session.resource,
    }

    const validation = validateMcpAccessTokenClaims(claims, {
      canonicalResourceUri,
      requiredScopes: MCP_TRANSPORT_REQUIRED_SCOPES,
      requireResourceIndicator,
    })

    if (!validation.ok) {
      if (validation.status === 403) {
        return buildMcpInsufficientScopeResponse(
          resourceMetadataUrl,
          validation.missingScopes ?? missingScopes(claims.scopes, MCP_TRANSPORT_REQUIRED_SCOPES)
        )
      }

      return buildMcpUnauthorizedResponse(resourceMetadataUrl)
    }

    tokenCache.set(cacheKey, validation.claims)
    c.set('mcpSession', sessionFromClaims(validation.claims))
    return next()
  })
}

function sessionFromClaims(claims: {
  accessToken: string
  clientId: string
  userId: string | null
  scopes: string[]
  accessTokenExpiresAt: Date
}): McpSession {
  return {
    accessToken: claims.accessToken,
    refreshToken: 'cached',
    accessTokenExpiresAt: claims.accessTokenExpiresAt,
    refreshTokenExpiresAt: claims.accessTokenExpiresAt,
    clientId: claims.clientId,
    userId: claims.userId,
    scopes: claims.scopes.join(' '),
  }
}

declare module 'hono' {
  interface ContextVariableMap {
    mcpSession: McpSession
  }
}
