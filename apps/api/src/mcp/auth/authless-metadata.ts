import { getCanonicalMcpResourceUri, MCP_PHASE1_SCOPES } from '@durabull/mcp/auth'

import { getMcpAuthConfig } from './verify-access-token'

/** Static PRM for authless dev when Better Auth MCP endpoints are not used. */
export function buildAuthlessMcpProtectedResourceMetadata(appBaseUrl: string) {
  const { authorizationServerUrl, canonicalResourceUri } = getMcpAuthConfig(appBaseUrl)
  return {
    resource: canonicalResourceUri,
    authorization_servers: [authorizationServerUrl],
    jwks_uri: `${authorizationServerUrl}/mcp/jwks`,
    scopes_supported: [...MCP_PHASE1_SCOPES, 'openid', 'profile', 'email', 'offline_access'],
    bearer_methods_supported: ['header'],
    resource_signing_alg_values_supported: ['RS256', 'none'],
  }
}
