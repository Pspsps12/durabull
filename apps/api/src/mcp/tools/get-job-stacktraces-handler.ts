import { getQueue } from '../../lib/redis'
import { toRedisConnectionOptions } from '../../lib/connection-options'
import type {
  GetJobStacktracesHandlerInput,
  GetJobStacktracesHandlerOutput,
} from '@durabull/mcp'
import { decodeCursor, encodeCursor, resolveConnectionForPrincipal } from './shared'

export async function getJobStacktracesHandler(
  input: GetJobStacktracesHandlerInput
): Promise<GetJobStacktracesHandlerOutput> {
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
  const job = await queue.getJob(input.jobId)
  if (!job) {
    throw new Error(`Job ${input.jobId} not found in queue ${input.queueName}.`)
  }

  const allStacktraces = job.stacktrace ?? []
  const pageSize = Math.min(100, Math.max(1, input.pageSize))
  const offset = decodeCursor(input.cursor)
  const reversed = [...allStacktraces].reverse()
  const page = reversed.slice(offset, offset + pageSize)
  const nextOffset = offset + page.length

  return {
    connectionId: connection.id,
    queueName: input.queueName,
    jobId: input.jobId,
    total: allStacktraces.length,
    stacktraces: page.map((stacktrace, index) => ({
      attemptNumber: allStacktraces.length - (offset + index),
      stacktrace,
      isLatest: offset + index === 0,
    })),
    nextCursor: nextOffset < allStacktraces.length ? encodeCursor(nextOffset) : null,
  }
}
