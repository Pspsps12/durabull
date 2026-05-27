import { mcpPolicyRepository } from '@durabull/dal'
import { createMiddleware } from 'hono/factory'

import type { McpSession } from '../auth/mcp-session-middleware'
import { evaluateMcpToolPolicy } from './policy-engine'
import { resolveMcpPrincipal } from './principal-resolver'
import type { McpPolicyDecision, McpToolCallRequest, McpPrincipal } from './types'

interface JsonRpcToolCallBody {
  method?: string
  params?: {
    name?: string
    arguments?: Record<string, unknown>
  }
}

function parseToolCallBody(body: unknown): McpToolCallRequest | null {
  if (!body || typeof body !== 'object') return null
  const payload = body as JsonRpcToolCallBody
  if (payload.method !== 'tools/call') return null
  const toolName = payload.params?.name
  if (!toolName || typeof toolName !== 'string') return null
  const args = payload.params?.arguments
  const safeArgs: Record<string, unknown> = args && typeof args === 'object' ? args : {}
  const connectionId =
    typeof safeArgs.connectionId === 'string' && safeArgs.connectionId.trim().length > 0
      ? safeArgs.connectionId
      : null

  return { toolName, arguments: safeArgs, connectionId }
}

function buildCorrelationId(): string {
  return crypto.randomUUID()
}

export function createMcpPolicyMiddleware() {
  return createMiddleware(async (c, next) => {
    if (c.req.method !== 'POST') {
      return next()
    }

    const body = await c.req.raw
      .clone()
      .json()
      .catch(() => null)
    if (Array.isArray(body)) {
      return c.json(
        {
          error: 'Bad Request',
          message: 'Batch MCP requests are not supported on this endpoint.',
        },
        400
      )
    }
    const toolCall = parseToolCallBody(body)
    if (!toolCall) {
      return next()
    }

    const session = c.get('mcpSession')
    const principal = await resolveMcpPrincipal(session)
    const correlationId = c.req.header('x-request-id') ?? buildCorrelationId()

    if (!principal) {
      await mcpPolicyRepository.createAuditEvent({
        correlationId,
        principalType: 'service_account',
        principalId: session.clientId,
        organizationId: null,
        connectionId: toolCall.connectionId,
        toolName: toolCall.toolName,
        requiredScopes: [],
        granted: false,
        denialReason: 'principal_resolution_failed',
      })

      return c.json(
        {
          error: 'Forbidden',
          message: 'MCP principal resolution failed for this token.',
        },
        403
      )
    }

    const decision = await evaluateMcpToolPolicy({
      correlationId,
      principal,
      session,
      call: toolCall,
    })

    await mcpPolicyRepository.createAuditEvent({
      correlationId: decision.correlationId,
      principalType: decision.principalType,
      principalId: decision.principalId,
      organizationId: decision.organizationId,
      connectionId: decision.connectionId,
      toolName: decision.toolName,
      requiredScopes: decision.requiredScopes,
      granted: decision.granted,
      denialReason: decision.denialReason,
    })

    if (!decision.granted) {
      return c.json(
        {
          error: 'Forbidden',
          message: decision.denialReason ?? 'MCP policy denied this tool call.',
        },
        403
      )
    }

    c.set('mcpPrincipal', principal)
    c.set('mcpPolicyDecision', decision)
    return next()
  })
}

declare module 'hono' {
  interface ContextVariableMap {
    mcpPrincipal: McpPrincipal
    mcpPolicyDecision: McpPolicyDecision
    mcpSession: McpSession
  }
}
