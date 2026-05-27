import { getQueue } from '../../lib/redis'
import { toRedisConnectionOptions } from '../../lib/connection-options'
import type { GetJobLogsHandlerInput, GetJobLogsHandlerOutput } from '@durabull/mcp'
import { decodeCursor, encodeCursor, resolveConnectionForPrincipal } from './shared'

export async function getJobLogsHandler(
  input: GetJobLogsHandlerInput
): Promise<GetJobLogsHandlerOutput> {
  const connection = await resolveConnectionForPrincipal(input.principal, input.connectionId)
  if (!connection) {
    throw new Error(`Connection ${input.connectionId} not found.`)
  }

  const queue = await getQueue(
    connection.id,
    connection.url,
    input.queueName,
    connection.prefix,
    toRedisConnectionOptions(connection.allowSelfSignedCerts)
  )

  const pageSize = Math.min(100, Math.max(1, input.pageSize))
  const offset = decodeCursor(input.cursor)
  const end = offset + pageSize - 1
  const logs = await queue.getJobLogs(input.jobId, offset, end)
  const nextOffset = offset + pageSize

  return {
    connectionId: connection.id,
    queueName: input.queueName,
    jobId: input.jobId,
    logs: logs.logs ?? [],
    total: logs.count ?? 0,
    nextCursor: nextOffset < (logs.count ?? 0) ? encodeCursor(nextOffset) : null,
  }
}
