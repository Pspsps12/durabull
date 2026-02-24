/**
 * Scheduled Jobs Seeding
 *
 * Creates scheduled/repeatable jobs with various cron patterns.
 * Some scheduled jobs will have recent failures for UI testing.
 */

import type { Queue } from 'bullmq'
import type { Redis } from 'ioredis'
import { QUEUE_CONFIGS } from '../config'
import { generatePayload } from '../generators/payloads'
import { generateConsistentErrorData } from '../generators/errors'
import {
  shortId,
  randomBool,
  randomInRange,
  randomPastTime,
  logItem,
  logSuccess,
} from '../utils'
import { getAllQueues } from './queues'

// ============================================================================
// Scheduled Job Configuration
// ============================================================================

interface ScheduledJobConfig {
  queueName: string
  jobName: string
  pattern: string
  description: string
  hasFailures?: boolean
}

/**
 * Get all scheduled job configurations from queue configs
 */
function getScheduledJobConfigs(): ScheduledJobConfig[] {
  const configs: ScheduledJobConfig[] = []

  for (const queueConfig of QUEUE_CONFIGS) {
    if (queueConfig.scheduledJobs) {
      for (const scheduledJob of queueConfig.scheduledJobs) {
        configs.push({
          queueName: queueConfig.name,
          jobName: scheduledJob.name,
          pattern: scheduledJob.pattern,
          description: scheduledJob.description,
          // Some scheduled jobs will have failures
          hasFailures: randomBool(0.3),
        })
      }
    }
  }

  return configs
}

// ============================================================================
// Scheduled Job Creation
// ============================================================================

/**
 * Create a scheduled/repeatable job
 */
async function createScheduledJob(
  queue: Queue,
  config: ScheduledJobConfig,
  redis: Redis
): Promise<void> {
  const queueConfig = QUEUE_CONFIGS.find((c) => c.name === config.queueName)!
  const jobType = queueConfig.jobTypes[0] // Use first job type for scheduled jobs
  const payload = generatePayload(config.queueName, config.jobName)

  // Create repeatable job
  // Note: BullMQ job IDs cannot contain colons, so we use underscores
  await queue.add(config.jobName, payload, {
    repeat: {
      pattern: config.pattern,
    },
    jobId: `${config.queueName}_${config.jobName}`,
  })

  // If this scheduled job should have failures, create some failed instances
  if (config.hasFailures) {
    await createFailedScheduledJobInstances(queue, config, redis)
  }
}

/**
 * Create failed instances of a scheduled job for UI testing
 */
async function createFailedScheduledJobInstances(
  queue: Queue,
  config: ScheduledJobConfig,
  redis: Redis
): Promise<void> {
  const failureCount = randomInRange(1, 5)
  const prefix = queue.opts.prefix || 'bull'

  for (let i = 0; i < failureCount; i++) {
    const payload = generatePayload(config.queueName, config.jobName)
    // Note: BullMQ job IDs cannot contain colons, so we use underscores
    const jobId = `repeat_${config.queueName}_${config.jobName}_${Date.now() - randomInRange(1, 24) * 60 * 60 * 1000}`

    const job = await queue.add(config.jobName, payload, {
      jobId,
      attempts: 3,
    })

    // Simulate failure with consistent error data
    const { failedReason, stacktraces } = generateConsistentErrorData(config.queueName, randomInRange(1, 3))
    const processedOn = randomPastTime(3600000, 86400000) // 1 hour to 1 day ago
    const finishedOn = processedOn + randomInRange(100, 2000)

    await redis.hset(`${prefix}:${config.queueName}:${job.id}`, {
      failedReason,
      attemptsMade: '3',
      processedOn: String(processedOn),
      finishedOn: String(finishedOn),
      stacktrace: JSON.stringify(stacktraces),
    })

    // Move to failed set
    await redis.lrem(`${prefix}:${config.queueName}:wait`, 0, job.id!)
    await redis.zadd(`${prefix}:${config.queueName}:failed`, finishedOn, job.id!)
  }
}

// ============================================================================
// Main Seeding Function
// ============================================================================

/**
 * Seed all scheduled jobs
 */
export async function seedScheduledJobs(redis: Redis): Promise<void> {
  const queues = getAllQueues()
  const scheduledConfigs = getScheduledJobConfigs()

  logItem('Creating scheduled jobs...')

  let totalScheduled = 0
  let withFailures = 0

  for (const config of scheduledConfigs) {
    const queue = queues.get(config.queueName)
    if (!queue) continue

    await createScheduledJob(queue, config, redis)
    totalScheduled++

    if (config.hasFailures) {
      withFailures++
    }

    logItem(`  📅 ${config.queueName}/${config.jobName} (${config.pattern})${config.hasFailures ? ' [has failures]' : ''}`)
  }

  logSuccess(`Created ${totalScheduled} scheduled jobs (${withFailures} with failures)`)
}

/**
 * Get scheduled job statistics
 */
export function getScheduledJobStats(): { total: number; withFailures: number } {
  const configs = getScheduledJobConfigs()
  return {
    total: configs.length,
    withFailures: configs.filter((c) => c.hasFailures).length,
  }
}
