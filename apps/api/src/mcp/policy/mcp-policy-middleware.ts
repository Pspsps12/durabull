import { mcpPolicyRepository } from '@durabull/dal'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'

import type { McpSession } from '../auth/mcp-session-middleware'
import { evaluateMcpToolPolicy } from './policy-engine'
import { resolveMcpPrincipal } from './principal-resolver'
import type { McpPolicyDecision, McpToolCallRequest, McpPrincipal } from './types'

interface JsonRpcToolCallBody {
  id?: string | number | null
  method?: string
  params?: {
    name?: string
    arguments?: Record<string, unknown>
  }
}

interface McpAuditEventInput {
  correlationId: string
  principalType: 'delegated_user' | 'service_account'
  principalId: string
  organizationId?: string | null
  connectionId?: string | null
  toolName: string
  requiredScopes: string[]
  granted: boolean
  denialReason?: string | null
}

const MAX_AUDIT_IN_FLIGHT = 16
const MAX_AUDIT_QUEUE_DEPTH = 1024
const AUDIT_DROP_LOG_INTERVAL = 100
let auditInFlight = 0
let droppedAuditEvents = 0
const pendingAuditEvents: McpAuditEventInput[] = []

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
      ? safeArgs.connectionId.trim()
      : null

  return { toolName, arguments: safeArgs, connectionId }
}

function buildCorrelationId(): string {
  return crypto.randomUUID()
}

function dispatchAuditEvent(input: McpAuditEventInput): void {
  auditInFlight += 1
  void mcpPolicyRepository
    .createAuditEvent(input)
    .catch((error) => {
      console.error('[mcp-policy] failed to write audit event', error)
    })
    .finally(() => {
      auditInFlight -= 1
      flushPendingAuditEvents()
    })
}

function flushPendingAuditEvents(): void {
  while (auditInFlight < MAX_AUDIT_IN_FLIGHT && pendingAuditEvents.length > 0) {
    const next = pendingAuditEvents.shift()
    if (!next) break
    dispatchAuditEvent(next)
  }
}

function writeAuditEventNonBlocking(input: McpAuditEventInput): void {
  if (auditInFlight < MAX_AUDIT_IN_FLIGHT && pendingAuditEvents.length === 0) {
    dispatchAuditEvent(input)
    return
  }

  if (pendingAuditEvents.length >= MAX_AUDIT_QUEUE_DEPTH) {
    droppedAuditEvents += 1
    if (droppedAuditEvents === 1 || droppedAuditEvents % AUDIT_DROP_LOG_INTERVAL === 0) {
      console.warn(
        `[mcp-policy] dropping audit events due to backpressure (dropped=${droppedAuditEvents}, inFlight=${auditInFlight}, queued=${pendingAuditEvents.length})`
      )
    }
    return
  }

  pendingAuditEvents.push(input)
  flushPendingAuditEvents()
}

function jsonRpcErrorResponse(
  c: Context,
  status: 400 | 403,
  code: number,
  message: string,
  id: string | number | null,
  data?: Record<string, unknown>
) {
  return c.json(
    {
      jsonrpc: '2.0',
      error: {
        code,
        message,
        ...(data ? { data } : {}),
      },
      id,
    },
    status
  )
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
    if (body !== null) {
      c.set('mcpRequestJsonBody', body)
    }
    if (Array.isArray(body)) {
      return jsonRpcErrorResponse(
        c,
        400,
        -32_600,
        'Invalid Request: Batch MCP requests are not supported on this endpoint.',
        null
      )
    }
    const payloadId =
      body && typeof body === 'object' && 'id' in body
        ? (((body as JsonRpcToolCallBody).id as string | number | null | undefined) ?? null)
        : null
    const isToolsCallMethod =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as JsonRpcToolCallBody).method === 'tools/call'
        : false
    const toolCall = parseToolCallBody(body)
    if (isToolsCallMethod && !toolCall) {
      return jsonRpcErrorResponse(
        c,
        400,
        -32_600,
        'Invalid Request: tools/call requires a valid params.name and arguments object.',
        payloadId
      )
    }
    if (!toolCall) {
      return next()
    }

    const session = c.get('mcpSession')
    const principal = await resolveMcpPrincipal(session)
    const correlationId = c.req.header('x-request-id') ?? buildCorrelationId()

    if (!principal) {
      writeAuditEventNonBlocking({
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

      return jsonRpcErrorResponse(
        c,
        403,
        -32_003,
        'Forbidden: MCP principal resolution failed for this token.',
        payloadId
      )
    }

    const decision = await evaluateMcpToolPolicy({
      correlationId,
      principal,
      session,
      call: toolCall,
    })

    writeAuditEventNonBlocking({
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
      return jsonRpcErrorResponse(
        c,
        403,
        -32_003,
        decision.denialReason ?? 'Forbidden: MCP policy denied this tool call.',
        payloadId
      )
    }

    c.set('mcpPrincipal', principal)
    c.set('mcpPolicyDecision', decision)
    return next()
  })
}

declare module 'hono' {
  interface ContextVariableMap {
    mcpRequestJsonBody: unknown
    mcpPrincipal: McpPrincipal
    mcpPolicyDecision: McpPolicyDecision
    mcpSession: McpSession
  }
}
