import { getQueue } from '../../lib/redis'
import { toRedisConnectionOptions } from '../../lib/connection-options'
import type { GetJobHandlerInput, GetJobHandlerOutput } from '@durabull/mcp'
import { resolveConnectionForPrincipal } from './shared'

export async function getJobHandler(input: GetJobHandlerInput): Promise<GetJobHandlerOutput> {
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

  return {
    connectionId: connection.id,
    queueName: input.queueName,
    job: {
      id: String(job.id ?? ''),
      name: job.name,
      status: await job.getState(),
      data: (job.data as Record<string, unknown>) ?? {},
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 1,
      failedReason: job.failedReason ?? null,
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null,
      timestamp: job.timestamp ?? null,
      delay: job.delay ?? 0,
      priority: job.opts.priority ?? 0,
      opts: (job.opts as Record<string, unknown>) ?? {},
      returnvalue: job.returnvalue,
      stacktraceCount: job.stacktrace?.length ?? 0,
    },
  }
}
