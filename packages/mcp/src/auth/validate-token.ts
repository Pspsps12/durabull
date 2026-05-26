import { missingScopes, tokenHasScopes } from './scopes'
import type { McpAccessTokenClaims, McpTokenValidationResult } from './types'

export interface ValidateMcpAccessTokenOptions {
  canonicalResourceUri: string
  requiredScopes: readonly string[]
}

function normalizeResourceUri(uri: string): string {
  try {
    const url = new URL(uri)
    url.hash = ''
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    return `${url.origin}${pathname}`
  } catch {
    return uri.replace(/\/+$/, '')
  }
}

export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) return null
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) return null
  const token = match[1].trim()
  return token.length > 0 ? token : null
}

export function validateMcpAccessTokenClaims(
  claims: McpAccessTokenClaims,
  options: ValidateMcpAccessTokenOptions
): McpTokenValidationResult {
  const now = Date.now()
  if (claims.accessTokenExpiresAt.getTime() <= now) {
    return {
      ok: false,
      status: 401,
      error: 'invalid_token',
    }
  }

  const canonical = normalizeResourceUri(options.canonicalResourceUri)
  if (claims.resource) {
    const tokenResource = normalizeResourceUri(claims.resource)
    if (tokenResource !== canonical) {
      return {
        ok: false,
        status: 401,
        error: 'invalid_token',
      }
    }
  }

  if (!tokenHasScopes(claims.scopes, options.requiredScopes)) {
    return {
      ok: false,
      status: 403,
      error: 'insufficient_scope',
      missingScopes: missingScopes(claims.scopes, options.requiredScopes),
    }
  }

  return { ok: true, claims }
}
