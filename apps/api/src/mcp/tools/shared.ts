import { redisConnectionRepository } from '@durabull/dal'
import type { ListConnectionsHandlerInput } from '@durabull/mcp'

export type ToolPrincipal = ListConnectionsHandlerInput['principal']

export class McpToolError extends Error {
  readonly code: 'not_found' | 'validation_error' | 'internal_error'

  constructor(code: 'not_found' | 'validation_error' | 'internal_error', message: string) {
    super(message)
    this.name = 'McpToolError'
    this.code = code
  }
}

export async function resolveConnectionForPrincipal(principal: ToolPrincipal, connectionId: string) {
  if (principal.type === 'service_account') {
    return redisConnectionRepository.findById(connectionId, principal.organizationId)
  }
  return redisConnectionRepository.findByIdUnsafe(connectionId)
}

export async function requireConnectionForPrincipal(
  principal: ToolPrincipal,
  connectionId: string
) {
  const connection = await resolveConnectionForPrincipal(principal, connectionId)
  if (!connection) {
    throw new McpToolError('not_found', `Connection ${connectionId} not found.`)
  }
  return connection
}

export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0
  const parsed = Number.parseInt(cursor, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function encodeCursor(offset: number): string {
  return String(offset)
}
