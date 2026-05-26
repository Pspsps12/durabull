import type { Auth } from '@durabull/auth'
import {
  getCanonicalMcpResourceUri,
  MCP_PHASE1_SCOPES,
} from '@durabull/mcp/auth'

import { getMcpAuthConfig } from './verify-access-token'

export interface McpProtectedResourceMetadata {
  resource: string
  authorization_servers: string[]
  jwks_uri: string
  scopes_supported: string[]
  bearer_methods_supported: string[]
  resource_signing_alg_values_supported: string[]
}

export function buildAuthlessMcpProtectedResourceMetadata(
  appBaseUrl: string
): McpProtectedResourceMetadata {
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

export async function getMcpProtectedResourceMetadata(
  auth: Auth | undefined,
  appBaseUrl: string
): Promise<McpProtectedResourceMetadata> {
  const { authorizationServerUrl, canonicalResourceUri } = getMcpAuthConfig(appBaseUrl)

  if (!auth) {
    return buildAuthlessMcpProtectedResourceMetadata(appBaseUrl)
  }

  const metadata = await auth.api.getMCPProtectedResource()
  return {
    ...metadata,
    resource: canonicalResourceUri,
    authorization_servers: [authorizationServerUrl],
    scopes_supported: [
      ...new Set([...metadata.scopes_supported, ...MCP_PHASE1_SCOPES]),
    ],
  }
}
