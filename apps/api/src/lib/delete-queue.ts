import { and, eq, getDb, redisDiscoveredQueue } from '@durabull/dal'
import type { Queue } from 'bullmq'

type QueueDeletionTarget = Pick<Queue, 'obliterate'>

export async function deleteQueueWithDiscoveryCleanup(
  connectionId: string,
  queueName: string,
  queue: QueueDeletionTarget
): Promise<void> {
  const db = await getDb()

  await db.transaction(async (tx) => {
    await tx
      .delete(redisDiscoveredQueue)
      .where(
        and(
          eq(redisDiscoveredQueue.connectionId, connectionId),
          eq(redisDiscoveredQueue.name, queueName)
        )
      )

    await queue.obliterate({ force: true })
  })
}
