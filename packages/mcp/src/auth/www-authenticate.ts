export interface WwwAuthenticateChallengeOptions {
  resourceMetadataUrl: string
  error?: 'invalid_token' | 'insufficient_scope'
  errorDescription?: string
  scope?: string
}

/**
 * Builds a RFC 6750 / MCP-style WWW-Authenticate Bearer challenge value.
 */
export function buildWwwAuthenticateChallenge(options: WwwAuthenticateChallengeOptions): string {
  const parts = [`Bearer resource_metadata="${options.resourceMetadataUrl}"`]

  if (options.error) {
    parts.push(`error="${options.error}"`)
  }

  if (options.errorDescription) {
    parts.push(`error_description="${options.errorDescription}"`)
  }

  if (options.scope) {
    parts.push(`scope="${options.scope}"`)
  }

  return parts.join(', ')
}

export function mcpAuthResponseHeaders(challenge: string): Record<string, string> {
  return {
    'WWW-Authenticate': challenge,
    'Access-Control-Expose-Headers': 'WWW-Authenticate',
  }
}
