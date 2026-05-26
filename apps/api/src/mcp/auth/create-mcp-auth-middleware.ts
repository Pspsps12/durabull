import type { Auth } from '@durabull/auth'
import {
  createMcpBearerAuthMiddleware,
  MCP_TRANSPORT_REQUIRED_SCOPES,
} from '@durabull/mcp/auth'

import { getAuth } from '../../lib/auth'
import { isAuthlessMode } from '../../lib/authless'
import { getMcpAuthConfig, verifyMcpAccessToken } from './verify-access-token'

export async function createMcpAuthMiddleware(appBaseUrl: string) {
  const authConfig = getMcpAuthConfig(appBaseUrl)
  const auth = isAuthlessMode() ? undefined : await getAuth()

  return createMcpBearerAuthMiddleware({
    canonicalResourceUri: authConfig.canonicalResourceUri,
    resourceMetadataUrl: authConfig.resourceMetadataUrl,
    requiredScopes: MCP_TRANSPORT_REQUIRED_SCOPES,
    verifyAccessToken: (token) => verifyMcpAccessToken(auth, token, appBaseUrl),
  })
}
