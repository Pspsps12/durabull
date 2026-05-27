import { redisConnectionRepository } from '@durabull/dal'
import type { ListConnectionsHandlerInput } from '@durabull/mcp'

export type ToolPrincipal = ListConnectionsHandlerInput['principal']

export async function resolveConnectionForPrincipal(principal: ToolPrincipal, connectionId: string) {
  if (principal.type === 'service_account') {
    return redisConnectionRepository.findById(connectionId, principal.organizationId)
  }
  return redisConnectionRepository.findByIdUnsafe(connectionId)
}

export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0
  const parsed = Number.parseInt(cursor, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function encodeCursor(offset: number): string {
  return String(offset)
}
