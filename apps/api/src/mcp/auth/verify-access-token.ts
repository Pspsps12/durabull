import type { Auth } from '@durabull/auth'
import {
  getCanonicalMcpResourceUri,
  type McpAccessTokenClaims,
  parseScopeString,
} from '@durabull/mcp/auth'
import { env } from '@durabull/env'

import { AUTHLESS_USER_ID, isAuthlessMode } from '../../lib/authless'

/** Dev-only bearer accepted when `DURABULL_AUTHLESS=true`. */
export const AUTHLESS_MCP_BEARER_TOKEN = 'durabull-authless-mcp'

export function getMcpAuthConfig(appBaseUrl: string) {
  const canonicalResourceUri = getCanonicalMcpResourceUri(appBaseUrl)
  const appOrigin = new URL(appBaseUrl).origin
  return {
    canonicalResourceUri,
    resourceMetadataUrl: `${appOrigin}/.well-known/oauth-protected-resource`,
    authorizationServerUrl: `${appOrigin}/api/auth`,
  }
}

function authlessMcpClaims(accessToken: string): McpAccessTokenClaims {
  return {
    accessToken,
    clientId: 'authless-mcp-client',
    userId: AUTHLESS_USER_ID,
    scopes: ['mcp:discover', 'mcp:jobs:read', 'mcp:failures:read', 'mcp:logs:read', 'mcp:diagnostics:read'],
    accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    resource: getCanonicalMcpResourceUri(env.APP_BASE_URL ?? 'http://localhost:3000'),
  }
}

export async function verifyMcpAccessToken(
  auth: Auth | undefined,
  accessToken: string,
  appBaseUrl: string
): Promise<McpAccessTokenClaims | null> {
  if (isAuthlessMode()) {
    return accessToken === AUTHLESS_MCP_BEARER_TOKEN ? authlessMcpClaims(accessToken) : null
  }

  if (!auth) {
    return null
  }

  const session = await auth.api.getMcpSession({
    headers: new Headers({ Authorization: `Bearer ${accessToken}` }),
  })

  if (!session) {
    return null
  }

  const expiresAt =
    session.accessTokenExpiresAt instanceof Date
      ? session.accessTokenExpiresAt
      : new Date(session.accessTokenExpiresAt)

  return {
    accessToken: session.accessToken,
    clientId: session.clientId,
    userId: session.userId ?? null,
    scopes: parseScopeString(session.scopes),
    accessTokenExpiresAt: expiresAt,
    resource: null,
  }
}
