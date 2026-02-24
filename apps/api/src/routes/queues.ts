import { env } from '@durabull/env'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  collectQueueNativeMetrics,
  DEFAULT_METRICS_WINDOW_MINUTES,
  DEFAULT_PRIORITY_BUCKETS,
  MAX_METRICS_WINDOW_MINUTES,
} from '../lib/bullmq-metrics'
import { debugGetBullKeys, discoverQueues, getQueue } from '../lib/redis'

// Default and max page sizes for pagination
const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100
const CLEAN_BATCH_SIZE = 1000
const MAX_PURGE_BATCHES_PER_STATUS = 500
const MAX_REMOVED_JOB_IDS_IN_RESPONSE = 100

const PURGEABLE_QUEUE_STATUSES = [
  'waiting',
  'active',
  'delayed',
  'completed',
  'failed',
  'paused',
  'prioritized',
] as const
type PurgeableQueueStatus = (typeof PURGEABLE_QUEUE_STATUSES)[number]

const PURGE_STATUS_OPTIONS = ['all', ...PURGEABLE_QUEUE_STATUSES] as const
const queueMetricsQuerySchema = z.object({
  windowMinutes: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  includePrometheus: z.string().optional(),
  priorities: z.string().optional(),
})

const cleanStatusMap: Record<
  PurgeableQueueStatus,
  'completed' | 'failed' | 'delayed' | 'paused' | 'wait' | 'active' | 'prioritized'
> = {
  completed: 'completed',
  failed: 'failed',
  delayed: 'delayed',
  paused: 'paused',
  waiting: 'wait',
  active: 'active',
  prioritized: 'prioritized',
}

function parseInteger(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function parseBoolean(value: string | undefined): boolean {
  return value === '1' || value === 'true'
}

function parsePriorities(value: string | undefined): number[] {
  if (!value) {
    return [...DEFAULT_PRIORITY_BUCKETS]
  }

  const parsed = Array.from(
    new Set(
      value
        .split(',')
        .map((segment) => Number.parseInt(segment.trim(), 10))
        .filter((priority) => Number.isFinite(priority) && priority > 0 && priority <= 2097152)
    )
  )

  return parsed.length > 0 ? parsed.sort((a, b) => a - b) : [...DEFAULT_PRIORITY_BUCKETS]
}

const app = new Hono()
  // Debug: List all bull:* keys to understand Redis structure
  // SECURITY: Only available in development mode
  .get('/debug/keys', async (c) => {
    if (env.NODE_ENV === 'production') {
      return c.json({ error: 'Debug endpoints are disabled in production' }, 403)
    }

    const connectionId = c.get('connectionId')
    const connectionUrl = c.get('connectionUrl')
    const keys = await debugGetBullKeys(connectionId, connectionUrl)

    // Group keys by pattern to make it easier to understand
    const metaKeys = keys.filter((k) => k.endsWith(':meta'))
    const queuePrefixes = new Set(
      metaKeys
        .map((k) => {
          const match = k.match(/^bull:(.+):meta$/)
          return match ? match[1] : null
        })
        .filter(Boolean)
    )

    return c.json({
      totalKeys: keys.length,
      metaKeys,
      discoveredQueueNames: Array.from(queuePrefixes),
      sampleKeys: keys.slice(0, 50),
    })
  })
  // List all queues (paginated)
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
    const total = allQueueNames.length

    // Paginate the queue names BEFORE fetching details
    // This prevents loading thousands of queue details at once
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const paginatedQueueNames = allQueueNames.slice(start, end)

    const queuesData = await Promise.all(
      paginatedQueueNames.map(async (name) => {
        const queue = await getQueue(connectionId, connectionUrl, name)
        const [counts, isPaused] = await Promise.all([queue.getJobCounts(), queue.isPaused()])

        const status: 'paused' | 'active' = isPaused ? 'paused' : 'active'
        return {
          name,
          status,
          jobCounts: {
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            delayed: counts.delayed ?? 0,
            completed: counts.completed ?? 0,
            failed: counts.failed ?? 0,
            paused: counts.paused ?? 0,
            prioritized: counts.prioritized ?? 0,
          },
          isPaused,
        }
      })
    )

    return c.json({
      queues: queuesData,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: end < total,
    })
  })
  // Get queue detail
  .get('/:queueName', async (c) => {
    const connectionId = c.get('connectionId')
    const connectionUrl = c.get('connectionUrl')
    const queueName = c.req.param('queueName')
    const queue = await getQueue(connectionId, connectionUrl, queueName)
    const [counts, isPaused, workers, schedulers] = await Promise.all([
      queue.getJobCounts(),
      queue.isPaused(),
      queue.getWorkers(),
      queue.getJobSchedulers(),
    ])

    const status: 'paused' | 'active' = isPaused ? 'paused' : 'active'

    return c.json({
      name: queueName,
      status,
      jobCounts: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        paused: counts.paused ?? 0,
        prioritized: counts.prioritized ?? 0,
      },
      isPaused,
      scheduledJobsCount: schedulers.length,
      workers: workers.map((w) => ({
        id: w.id ?? '',
        name: w.name ?? '',
        addr: w.addr ?? '',
        age: Number(w.age) || 0,
        idle: Number(w.idle) || 0,
      })),
    })
  })
  // Get queue metrics
  .get('/:queueName/metrics', zValidator('query', queueMetricsQuerySchema), async (c) => {
    const connectionId = c.get('connectionId')
    const connectionUrl = c.get('connectionUrl')
    const queueName = c.req.param('queueName')
    const query = c.req.valid('query')

    const startParam = parseInteger(query.start)
    const endParam = parseInteger(query.end)
    const windowParam = parseInteger(query.windowMinutes)

    if (startParam !== null && startParam < 0) {
      return c.json({ error: '`start` must be greater than or equal to 0' }, 400)
    }

    if (endParam !== null && endParam < -1) {
      return c.json({ error: '`end` must be -1 or greater' }, 400)
    }

    const requestedWindowMinutes =
      windowParam !== null
        ? Math.min(Math.max(windowParam, 1), MAX_METRICS_WINDOW_MINUTES)
        : DEFAULT_METRICS_WINDOW_MINUTES

    const start = startParam ?? 0
    const end =
      endParam !== null
        ? endParam
        : startParam !== null
          ? -1
          : Math.max(requestedWindowMinutes - 1, 0)

    if (end !== -1 && end < start) {
      return c.json({ error: '`end` must be -1 or greater than or equal to `start`' }, 400)
    }

    const includePrometheus = parseBoolean(query.includePrometheus)
    const priorities = parsePriorities(query.priorities)

    const queue = await getQueue(connectionId, connectionUrl, queueName)
    const metrics = await collectQueueNativeMetrics(queue, {
      queueName,
      start,
      end,
      priorities,
      includePrometheus,
      requestedWindowMinutes: query.windowMinutes ? requestedWindowMinutes : null,
    })

    return c.json(metrics)
  })
  // Pause queue
  .post('/:queueName/pause', async (c) => {
    const connectionId = c.get('connectionId')
    const connectionUrl = c.get('connectionUrl')
    const queueName = c.req.param('queueName')
    const queue = await getQueue(connectionId, connectionUrl, queueName)
    await queue.pause()
    return c.json({ success: true })
  })
  // Resume queue
  .post('/:queueName/resume', async (c) => {
    const connectionId = c.get('connectionId')
    const connectionUrl = c.get('connectionUrl')
    const queueName = c.req.param('queueName')
    const queue = await getQueue(connectionId, connectionUrl, queueName)
    await queue.resume()
    return c.json({ success: true })
  })
  // Clean queue
  .post(
    '/:queueName/clean',
    zValidator(
      'json',
      z.object({
        status: z.string(),
        gracePeriod: z.number().optional(),
        limit: z.number().optional(),
      })
    ),
    async (c) => {
      const connectionId = c.get('connectionId')
      const connectionUrl = c.get('connectionUrl')
      const queueName = c.req.param('queueName')
      const { status, gracePeriod = 0, limit = 1000 } = c.req.valid('json')
      const queue = await getQueue(connectionId, connectionUrl, queueName)

      const cleanStatus = cleanStatusMap[status as PurgeableQueueStatus]
      if (!cleanStatus) {
        return c.json({ error: `Invalid status: ${status}` }, 400)
      }

      const removedJobIds = await queue.clean(
        gracePeriod,
        limit,
        cleanStatus as Parameters<typeof queue.clean>[2]
      )
      return c.json({ removed: removedJobIds.length, removedJobIds })
    }
  )
  // Purge queue by selected statuses (or all statuses)
  .post(
    '/:queueName/purge',
    zValidator(
      'json',
      z.object({
        confirmName: z.string().min(1),
        statuses: z.array(z.enum(PURGE_STATUS_OPTIONS)).min(1),
      })
    ),
    async (c) => {
      const connectionId = c.get('connectionId')
      const connectionUrl = c.get('connectionUrl')
      const queueName = c.req.param('queueName')
      const { confirmName, statuses } = c.req.valid('json')

      if (confirmName !== queueName) {
        return c.json(
          {
            error: 'Queue name confirmation does not match',
            canPurge: false,
          },
          400
        )
      }

      const requestedStatuses = Array.from(new Set(statuses))
      const statusesToPurge: PurgeableQueueStatus[] = requestedStatuses.includes('all')
        ? [...PURGEABLE_QUEUE_STATUSES]
        : requestedStatuses.filter((status): status is PurgeableQueueStatus => status !== 'all')

      if (statusesToPurge.length === 0) {
        return c.json({ error: 'At least one status must be selected for purge' }, 400)
      }

      const queue = await getQueue(connectionId, connectionUrl, queueName)
      const removedByStatus = Object.fromEntries(
        statusesToPurge.map((status) => [status, 0])
      ) as Record<PurgeableQueueStatus, number>
      const removedJobIdsSample: string[] = []
      let totalRemoved = 0

      for (const status of statusesToPurge) {
        let removedForStatus = 0
        let reachedSafetyLimit = true

        if (status === 'prioritized') {
          for (let batch = 0; batch < MAX_PURGE_BATCHES_PER_STATUS; batch++) {
            const prioritizedJobs = (
              await queue.getJobs(['prioritized'], 0, CLEAN_BATCH_SIZE - 1)
            ).filter((job): job is NonNullable<typeof job> => job != null)

            if (prioritizedJobs.length === 0) {
              reachedSafetyLimit = false
              break
            }

            for (const job of prioritizedJobs) {
              try {
                await job.remove()
              } catch (err) {
                return c.json(
                  {
                    error: `Failed to remove prioritized job "${String(job.id ?? '')}": ${String(
                      err
                    )}`,
                    status,
                    canPurge: true,
                  },
                  409
                )
              }

              removedForStatus += 1
              totalRemoved += 1

              if (removedJobIdsSample.length < MAX_REMOVED_JOB_IDS_IN_RESPONSE) {
                removedJobIdsSample.push(String(job.id ?? ''))
              }
            }
          }

          if (reachedSafetyLimit) {
            return c.json(
              {
                error: `Purge safety limit reached for status "${status}". Please retry the purge.`,
                status,
                canPurge: true,
              },
              409
            )
          }

          removedByStatus[status] = removedForStatus
          continue
        }

        const cleanStatus = cleanStatusMap[status]

        for (let batch = 0; batch < MAX_PURGE_BATCHES_PER_STATUS; batch++) {
          const removedJobIds = await queue.clean(
            0,
            CLEAN_BATCH_SIZE,
            cleanStatus as Parameters<typeof queue.clean>[2]
          )
          const removedCount = removedJobIds.length

          if (removedCount === 0) {
            reachedSafetyLimit = false
            break
          }

          removedForStatus += removedCount
          totalRemoved += removedCount

          if (removedJobIdsSample.length < MAX_REMOVED_JOB_IDS_IN_RESPONSE) {
            const remainingSlots = MAX_REMOVED_JOB_IDS_IN_RESPONSE - removedJobIdsSample.length
            removedJobIdsSample.push(
              ...removedJobIds.slice(0, remainingSlots).map((jobId) => String(jobId))
            )
          }
        }

        if (reachedSafetyLimit) {
          return c.json(
            {
              error: `Purge safety limit reached for status "${status}". Please retry the purge.`,
              status,
              canPurge: true,
            },
            409
          )
        }

        removedByStatus[status] = removedForStatus
      }

      return c.json({
        success: true,
        queueName,
        statusesPurged: statusesToPurge,
        totalRemoved,
        removedByStatus,
        removedJobIdsSample,
      })
    }
  )
  // Obliterate queue
  .post('/:queueName/obliterate', async (c) => {
    const connectionId = c.get('connectionId')
    const connectionUrl = c.get('connectionUrl')
    const queueName = c.req.param('queueName')
    const queue = await getQueue(connectionId, connectionUrl, queueName)
    await queue.obliterate({ force: true })
    return c.json({ success: true })
  })
  // Delete queue (only if empty)
  .delete(
    '/:queueName',
    zValidator(
      'json',
      z.object({
        confirmName: z.string(),
      })
    ),
    async (c) => {
      const connectionId = c.get('connectionId')
      const connectionUrl = c.get('connectionUrl')
      const queueName = c.req.param('queueName')
      const { confirmName } = c.req.valid('json')

      // Verify the confirmation name matches
      if (confirmName !== queueName) {
        return c.json({ error: 'Queue name confirmation does not match', canDelete: false }, 400)
      }

      const queue = await getQueue(connectionId, connectionUrl, queueName)
      const counts = await queue.getJobCounts()

      // Calculate total jobs (excluding completed as they can be cleaned)
      const totalActiveJobs =
        (counts.waiting ?? 0) +
        (counts.active ?? 0) +
        (counts.delayed ?? 0) +
        (counts.failed ?? 0) +
        (counts.paused ?? 0) +
        (counts.prioritized ?? 0)

      if (totalActiveJobs > 0) {
        return c.json(
          {
            error: `Cannot delete queue with ${totalActiveJobs} jobs. Remove all jobs first.`,
            canDelete: false,
            jobCounts: {
              waiting: counts.waiting ?? 0,
              active: counts.active ?? 0,
              delayed: counts.delayed ?? 0,
              failed: counts.failed ?? 0,
              paused: counts.paused ?? 0,
              prioritized: counts.prioritized ?? 0,
            },
          },
          400
        )
      }

      // Queue is empty, safe to delete
      await queue.obliterate({ force: true })
      return c.json({ success: true, deleted: queueName })
    }
  )
  // Check if queue can be deleted (pre-flight check)
  .get('/:queueName/can-delete', async (c) => {
    const connectionId = c.get('connectionId')
    const connectionUrl = c.get('connectionUrl')
    const queueName = c.req.param('queueName')
    const queue = await getQueue(connectionId, connectionUrl, queueName)
    const counts = await queue.getJobCounts()

    const totalActiveJobs =
      (counts.waiting ?? 0) +
      (counts.active ?? 0) +
      (counts.delayed ?? 0) +
      (counts.failed ?? 0) +
      (counts.paused ?? 0) +
      (counts.prioritized ?? 0)

    return c.json({
      canDelete: totalActiveJobs === 0,
      totalJobs: totalActiveJobs,
      jobCounts: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
        paused: counts.paused ?? 0,
        prioritized: counts.prioritized ?? 0,
      },
    })
  })

export default app
