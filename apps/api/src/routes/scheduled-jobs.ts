import { Hono } from 'hono'
import { discoverQueues, getQueue } from '../lib/redis'

// Default and max page sizes for pagination
const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100

// Helper to get recent failed job stats for scheduled jobs in a queue
async function getScheduledJobFailureStats(
  queue: Awaited<ReturnType<typeof getQueue>>,
  schedulerJobNames: string[]
): Promise<Map<string, { count: number; lastFailedAt?: number }>> {
  const stats = new Map<string, { count: number; lastFailedAt?: number }>()

  // Initialize stats for all job names
  for (const name of schedulerJobNames) {
    stats.set(name, { count: 0, lastFailedAt: undefined })
  }

  if (schedulerJobNames.length === 0) {
    return stats
  }

  // Get recent failed jobs (last 100 to be efficient)
  const failedJobs = await queue.getJobs(['failed'], 0, 100)

  for (const job of failedJobs) {
    // Check if this job was from a scheduled job (job name matches)
    if (schedulerJobNames.includes(job.name)) {
      const current = stats.get(job.name) ?? { count: 0, lastFailedAt: undefined }
      current.count++

      // Track the most recent failure time
      const failedAt = job.finishedOn ?? job.timestamp
      if (!current.lastFailedAt || failedAt > current.lastFailedAt) {
        current.lastFailedAt = failedAt
      }

      stats.set(job.name, current)
    }
  }

  return stats
}

const app = new Hono()
  // List all scheduled jobs across all queues (paginated by queue)
  .get('/', async (c) => {
    const connectionId = c.get('connectionId')
    const connectionUrl = c.get('connectionUrl')
    const pageStr = c.req.query('page')
    const pageSizeStr = c.req.query('pageSize')

    const page = pageStr ? parseInt(pageStr, 10) : 1
    const pageSize = Math.min(
      pageSizeStr ? parseInt(pageSizeStr, 10) : DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    )

    const allQueueNames = await discoverQueues(connectionId, connectionUrl)
    const totalQueues = allQueueNames.length

    // Paginate at the queue level to prevent loading scheduled jobs from thousands of queues
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const paginatedQueueNames = allQueueNames.slice(start, end)

    const allScheduledJobs: Array<{
      schedulerId: string
      pattern: string
      queueName: string
      jobName: string
      nextRun?: number
      enabled: boolean
      data?: Record<string, unknown>
      recentFailedCount: number
      lastFailedAt?: number
    }> = []

    for (const queueName of paginatedQueueNames) {
      const queue = await getQueue(connectionId, connectionUrl, queueName)
      const schedulers = await queue.getJobSchedulers()

      // Get unique job names from schedulers
      const schedulerJobNames = [...new Set(schedulers.map((s) => s.name ?? '').filter(Boolean))]

      // Get failure stats for this queue's scheduled jobs
      const failureStats = await getScheduledJobFailureStats(queue, schedulerJobNames)

      for (const scheduler of schedulers) {
        const jobName = scheduler.name ?? ''
        const stats = failureStats.get(jobName)

        allScheduledJobs.push({
          schedulerId: scheduler.key,
          pattern: scheduler.pattern ?? '',
          queueName,
          jobName,
          nextRun: scheduler.next ? Number(scheduler.next) : undefined,
          enabled: true,
          data: scheduler.template?.data as Record<string, unknown> | undefined,
          recentFailedCount: stats?.count ?? 0,
          lastFailedAt: stats?.lastFailedAt,
        })
      }
    }

    return c.json({
      scheduledJobs: allScheduledJobs,
      total: allScheduledJobs.length,
      page,
      pageSize,
      totalQueuesScanned: paginatedQueueNames.length,
      totalQueues,
      hasMore: end < totalQueues,
    })
  })
  // List scheduled jobs for a specific queue
  .get('/queue/:queueName', async (c) => {
    const connectionId = c.get('connectionId')
    const connectionUrl = c.get('connectionUrl')
    const queueName = c.req.param('queueName')
    const queue = await getQueue(connectionId, connectionUrl, queueName)
    const schedulers = await queue.getJobSchedulers()

    // Get unique job names from schedulers
    const schedulerJobNames = [...new Set(schedulers.map((s) => s.name ?? '').filter(Boolean))]

    // Get failure stats for this queue's scheduled jobs
    const failureStats = await getScheduledJobFailureStats(queue, schedulerJobNames)

    const scheduledJobs = schedulers.map((scheduler) => {
      const jobName = scheduler.name ?? ''
      const stats = failureStats.get(jobName)

      return {
        schedulerId: scheduler.key,
        pattern: scheduler.pattern ?? '',
        queueName,
        jobName,
        nextRun: scheduler.next ? Number(scheduler.next) : undefined,
        enabled: true,
        data: scheduler.template?.data as Record<string, unknown> | undefined,
        recentFailedCount: stats?.count ?? 0,
        lastFailedAt: stats?.lastFailedAt,
      }
    })

    return c.json({ scheduledJobs, total: scheduledJobs.length })
  })
  // Remove scheduled job
  .delete('/queue/:queueName/:schedulerId', async (c) => {
    const connectionId = c.get('connectionId')
    const connectionUrl = c.get('connectionUrl')
    const queueName = c.req.param('queueName')
    const schedulerId = c.req.param('schedulerId')

    const queue = await getQueue(connectionId, connectionUrl, queueName)
    await queue.removeJobScheduler(schedulerId)
    return c.json({ success: true })
  })

export default app
