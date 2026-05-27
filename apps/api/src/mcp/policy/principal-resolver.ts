import { mcpPolicyRepository } from '@durabull/dal'

import type { McpSession } from '../auth/mcp-session-middleware'
import type { McpPrincipal } from './types'

/**
 * Resolves the authenticated MCP caller into a delegated-user or service-account principal.
 */
export async function resolveMcpPrincipal(session: McpSession): Promise<McpPrincipal | null> {
  if (session.userId) {
    return {
      type: 'delegated_user',
      principalId: session.userId,
      userId: session.userId,
      organizationId: null,
    }
  }

  const serviceAccount = await mcpPolicyRepository.findServiceAccountByOauthClientId(session.clientId)
  if (!serviceAccount) {
    return null
  }

  return {
    type: 'service_account',
    principalId: serviceAccount.id,
    serviceAccountId: serviceAccount.id,
    organizationId: serviceAccount.organizationId,
  }
}
