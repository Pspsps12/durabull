import { describe, expect, it } from 'bun:test'

import type { McpSession } from '../auth/mcp-session-middleware'
import { evaluateMcpToolPolicy } from './policy-engine'
import type { McpPrincipal } from './types'

const baseSession: McpSession = {
  accessToken: 'token',
  refreshToken: 'refresh',
  accessTokenExpiresAt: new Date(),
  refreshTokenExpiresAt: new Date(),
  clientId: 'client-id',
  userId: 'user-1',
  scopes: 'mcp:discover mcp:jobs:read mcp:logs:read',
}

const delegatedPrincipal: McpPrincipal = {
  type: 'delegated_user',
  principalId: 'principal-1',
  userId: 'user-1',
  organizationId: null,
}

describe('evaluateMcpToolPolicy', () => {
  it('denies tools without explicit scope mapping', async () => {
    const decision = await evaluateMcpToolPolicy({
      correlationId: 'corr-1',
      principal: delegatedPrincipal,
      session: baseSession,
      call: {
        toolName: 'unmapped_future_tool',
        arguments: {},
        connectionId: null,
      },
    })

    expect(decision.granted).toBe(false)
    expect(decision.denialReason).toBe('policy_configuration_missing')
    expect(decision.requiredScopes).toEqual([])
  })
})
