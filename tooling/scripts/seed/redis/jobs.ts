/**
 * Job Creation with Various States
 *
 * Creates jobs in different states (waiting, completed, failed, delayed)
 * with realistic data, stacktraces, and return values.
 */

import type { Queue } from 'bullmq'
import type { Redis } from 'ioredis'
import {
  QUEUE_CONFIGS,
  JOB_DISTRIBUTION,
  DELAYED_TIME_DISTRIBUTION,
} from '../config'
import { generatePayload, generateReturnValue } from '../generators/payloads'
import { generateConsistentErrorData } from '../generators/errors'
import { generateJobLogs, generateErrorLogs } from '../generators/logs'
import {
  generateId,
  shortId,
  pickRandom,
  randomInRange,
  weightedRandom,
  randomBool,
  timeFromNow,
  randomPastTime,
  logItem,
  logSuccess,
} from '../utils'
import { getAllQueues } from './queues'

// ============================================================================
// Job Creation Helpers
// ============================================================================

interface JobStats {
  waiting: number
  completed: number
  failed: number
  delayed: number
  retryPending: number
}

const jobStats: JobStats = {
  waiting: 0,
  completed: 0,
  failed: 0,
  delayed: 0,
  retryPending: 0,
}

/**
 * Create a waiting job with random priority
 */
async function createWaitingJob(
  queue: Queue,
  queueConfig: (typeof QUEUE_CONFIGS)[number]
): Promise<void> {
  const jobType = weightedRandom(queueConfig.jobTypes)
  const payload = generatePayload(queueConfig.name, jobType.name)

  await queue.add(jobType.name, payload, {
    jobId: `${queueConfig.name}-${shortId()}`,
    priority: randomBool(0.3) ? randomInRange(1, 10) : 0,
    attempts: randomInRange(3, 5),
  })

  jobStats.waiting++
}

/**
 * Create a completed job with return value
 */
async function createCompletedJob(
  queue: Queue,
  queueConfig: (typeof QUEUE_CONFIGS)[number],
  redis: Redis
): Promise<void> {
  const jobType = weightedRandom(queueConfig.jobTypes)
  const payload = generatePayload(queueConfig.name, jobType.name)
  const jobId = `${queueConfig.name}-completed-${shortId()}`

  const job = await queue.add(jobType.name, payload, {
    jobId,
    attempts: randomInRange(1, 3),
  })

  // Simulate completion
  const prefix = queue.opts.prefix || 'bull'
  const processedOn = randomPastTime(60000, 3600000) // 1 min to 1 hour ago
  const processingDuration = randomInRange(100, 5000)
  const finishedOn = processedOn + processingDuration

  const returnValue = generateReturnValue(queueConfig.name, jobType.name)
  const logs = generateJobLogs(queueConfig.name)

  await redis.hset(`${prefix}:${queueConfig.name}:${job.id}`, {
    processedOn: String(processedOn),
    finishedOn: String(finishedOn),
    returnvalue: JSON.stringify(returnValue),
  })

  // Add job logs
  for (const log of logs) {
    await redis.rpush(`${prefix}:${queueConfig.name}:${job.id}:logs`, log)
  }

  // Move to completed set
  await redis.lrem(`${prefix}:${queueConfig.name}:wait`, 0, job.id!)
  await redis.zadd(`${prefix}:${queueConfig.name}:completed`, finishedOn, job.id!)

  jobStats.completed++
}

/**
 * Create a failed job with stacktraces
 */
async function createFailedJob(
  queue: Queue,
  queueConfig: (typeof QUEUE_CONFIGS)[number],
  redis: Redis,
  exhausted: boolean = true
): Promise<void> {
  const jobType = weightedRandom(queueConfig.jobTypes)
  const payload = generatePayload(queueConfig.name, jobType.name)
  const jobId = `${queueConfig.name}-failed-${shortId()}`
  const maxAttempts = randomInRange(3, 5)
  const attemptsMade = exhausted ? maxAttempts : randomInRange(1, maxAttempts - 1)

  const job = await queue.add(jobType.name, payload, {
    jobId,
    attempts: maxAttempts,
    backoff: {
      type: randomBool(0.5) ? 'exponential' : 'fixed',
      delay: randomInRange(30000, 120000),
    },
  })

  // Generate consistent error data (same error type for reason and all stacktraces)
  const { failedReason, stacktraces } = generateConsistentErrorData(queueConfig.name, attemptsMade)
  const logs = generateErrorLogs(queueConfig.name, failedReason)

  // Simulate failure
  const prefix = queue.opts.prefix || 'bull'
  const processedOn = randomPastTime(60000, 3600000)
  const finishedOn = processedOn + randomInRange(100, 2000)

  await redis.hset(`${prefix}:${queueConfig.name}:${job.id}`, {
    failedReason,
    attemptsMade: String(attemptsMade),
    processedOn: String(processedOn),
    finishedOn: String(finishedOn),
    stacktrace: JSON.stringify(stacktraces),
  })

  // Add job logs
  for (const log of logs) {
    await redis.rpush(`${prefix}:${queueConfig.name}:${job.id}:logs`, log)
  }

  // Move to failed set
  await redis.lrem(`${prefix}:${queueConfig.name}:wait`, 0, job.id!)
  await redis.zadd(`${prefix}:${queueConfig.name}:failed`, finishedOn, job.id!)

  jobStats.failed++
}

/**
 * Create a delayed job
 */
async function createDelayedJob(
  queue: Queue,
  queueConfig: (typeof QUEUE_CONFIGS)[number],
  delayMs: number
): Promise<void> {
  const jobType = weightedRandom(queueConfig.jobTypes)
  const payload = generatePayload(queueConfig.name, jobType.name)

  await queue.add(jobType.name, payload, {
    jobId: `${queueConfig.name}-delayed-${shortId()}`,
    delay: delayMs,
    attempts: randomInRange(3, 5),
  })

  jobStats.delayed++
}

/**
 * Create a failed job with many attempts (for testing scroll in failed attempts UI)
 */
async function createManyFailedAttemptsJob(
  queue: Queue,
  queueConfig: (typeof QUEUE_CONFIGS)[number],
  redis: Redis,
  attemptCount: number
): Promise<void> {
  const jobType = weightedRandom(queueConfig.jobTypes)
  const payload = generatePayload(queueConfig.name, jobType.name)
  const jobId = `${queueConfig.name}-many-failures-${shortId()}`

  const job = await queue.add(jobType.name, payload, {
    jobId,
    attempts: attemptCount,
    backoff: {
      type: 'exponential',
      delay: 30000,
    },
  })

  // Generate consistent error data with many stacktraces (same error type for all)
  const { failedReason, stacktraces } = generateConsistentErrorData(queueConfig.name, attemptCount)
  const logs = generateErrorLogs(queueConfig.name, failedReason)

  // Simulate failure
  const prefix = queue.opts.prefix || 'bull'
  const processedOn = randomPastTime(60000, 3600000)
  const finishedOn = processedOn + randomInRange(100, 2000)

  await redis.hset(`${prefix}:${queueConfig.name}:${job.id}`, {
    failedReason,
    attemptsMade: String(attemptCount),
    processedOn: String(processedOn),
    finishedOn: String(finishedOn),
    stacktrace: JSON.stringify(stacktraces),
  })

  // Add job logs
  for (const log of logs) {
    await redis.rpush(`${prefix}:${queueConfig.name}:${job.id}:logs`, log)
  }

  // Move to failed set
  await redis.lrem(`${prefix}:${queueConfig.name}:wait`, 0, job.id!)
  await redis.zadd(`${prefix}:${queueConfig.name}:failed`, finishedOn, job.id!)

  jobStats.failed++
}

/**
 * Create a retry-pending job (failed but waiting for retry)
 * This is critical for testing the countdown feature
 */
async function createRetryPendingJob(
  queue: Queue,
  queueConfig: (typeof QUEUE_CONFIGS)[number],
  redis: Redis,
  delayMs: number
): Promise<void> {
  const jobType = weightedRandom(queueConfig.jobTypes)
  const payload = generatePayload(queueConfig.name, jobType.name)
  const jobId = `${queueConfig.name}-retry-${shortId()}`
  const maxAttempts = randomInRange(4, 6)
  const attemptsMade = randomInRange(1, maxAttempts - 1)
  const backoffType = randomBool(0.5) ? 'exponential' : 'fixed'
  const baseDelay = randomInRange(30000, 120000)

  const job = await queue.add(jobType.name, payload, {
    jobId,
    attempts: maxAttempts,
    backoff: {
      type: backoffType,
      delay: baseDelay,
    },
  })

  // Generate consistent error data (same error type for reason and all stacktraces)
  const { failedReason, stacktraces } = generateConsistentErrorData(queueConfig.name, attemptsMade)

  // Calculate backoff delay
  const backoffDelay = backoffType === 'exponential'
    ? baseDelay * Math.pow(2, attemptsMade - 1)
    : baseDelay

  // Simulate failed state waiting for retry
  const prefix = queue.opts.prefix || 'bull'
  const now = Date.now()
  const processedOn = now - randomInRange(1000, 10000)
  const finishedOn = processedOn + randomInRange(100, 1000)
  const nextRetryTime = now + delayMs // Use the provided delay for next retry

  await redis.hset(`${prefix}:${queueConfig.name}:${job.id}`, {
    failedReason,
    attemptsMade: String(attemptsMade),
    processedOn: String(processedOn),
    finishedOn: String(finishedOn),
    stacktrace: JSON.stringify(stacktraces),
  })

  // Move from waiting to delayed set (retry pending state)
  await redis.lrem(`${prefix}:${queueConfig.name}:wait`, 0, job.id!)
  await redis.zadd(`${prefix}:${queueConfig.name}:delayed`, nextRetryTime, job.id!)

  jobStats.retryPending++
}

// ============================================================================
// Main Job Seeding
// ============================================================================

/**
 * Seed jobs for a single queue
 */
async function seedQueueJobs(
  queue: Queue,
  queueConfig: (typeof QUEUE_CONFIGS)[number],
  redis: Redis
): Promise<void> {
  // Determine job counts for this queue (use random values within ranges)
  const waitingCount = randomInRange(JOB_DISTRIBUTION.waiting.min, JOB_DISTRIBUTION.waiting.max)
  const completedCount = randomInRange(JOB_DISTRIBUTION.completed.min, JOB_DISTRIBUTION.completed.max)
  const failedCount = randomInRange(JOB_DISTRIBUTION.failed.min, JOB_DISTRIBUTION.failed.max)

  // Create waiting jobs
  for (let i = 0; i < waitingCount; i++) {
    await createWaitingJob(queue, queueConfig)
  }

  // Create completed jobs
  for (let i = 0; i < completedCount; i++) {
    await createCompletedJob(queue, queueConfig, redis)
  }

  // Create failed jobs (exhausted retries)
  const exhaustedFailedCount = Math.floor(failedCount * 0.7)
  for (let i = 0; i < exhaustedFailedCount; i++) {
    await createFailedJob(queue, queueConfig, redis, true)
  }

  // Create failed jobs (still have retries left - for testing retry)
  const retriableFailedCount = failedCount - exhaustedFailedCount
  for (let i = 0; i < retriableFailedCount; i++) {
    await createFailedJob(queue, queueConfig, redis, false)
  }
}

/**
 * Seed delayed jobs with various time distributions
 */
async function seedDelayedJobs(redis: Redis): Promise<void> {
  const queues = getAllQueues()
  const queueNames = Array.from(queues.keys())

  logItem('Creating delayed jobs with various timeframes...')

  for (const timeConfig of DELAYED_TIME_DISTRIBUTION) {
    for (let i = 0; i < timeConfig.count; i++) {
      const queueName = pickRandom(queueNames)
      const queue = queues.get(queueName)!
      const config = QUEUE_CONFIGS.find((c) => c.name === queueName)!

      // Add some variance to the delay
      const variance = timeConfig.delay * 0.2 // 20% variance
      const actualDelay = timeConfig.delay + randomInRange(-variance, variance)

      await createDelayedJob(queue, config, Math.max(1000, actualDelay))
    }
    logItem(`  ⏰ ${timeConfig.label}: ${timeConfig.count} jobs`)
  }
}

/**
 * Seed retry-pending jobs for countdown testing
 */
async function seedRetryPendingJobs(redis: Redis): Promise<void> {
  const queues = getAllQueues()

  logItem('Creating retry-pending jobs for countdown testing...')

  // Create retry-pending jobs with specific delays for testing
  const retryDelays = [
    { delay: 30 * 1000, label: '30 seconds' },
    { delay: 60 * 1000, label: '1 minute' },
    { delay: 2 * 60 * 1000, label: '2 minutes' },
    { delay: 5 * 60 * 1000, label: '5 minutes' },
    { delay: 15 * 60 * 1000, label: '15 minutes' },
    { delay: 30 * 60 * 1000, label: '30 minutes' },
    { delay: 60 * 60 * 1000, label: '1 hour' },
    { delay: 2 * 60 * 60 * 1000, label: '2 hours' },
    { delay: 6 * 60 * 60 * 1000, label: '6 hours' },
    { delay: 24 * 60 * 60 * 1000, label: '1 day' },
  ]

  for (const { delay, label } of retryDelays) {
    // Pick a random queue
    const queueName = pickRandom(Array.from(queues.keys()))
    const queue = queues.get(queueName)!
    const config = QUEUE_CONFIGS.find((c) => c.name === queueName)!

    await createRetryPendingJob(queue, config, redis, delay)
    logItem(`  🔄 Retry in ${label}: 1 job`)
  }
}

/**
 * Seed jobs with many failed attempts (for testing scroll in failed attempts UI)
 */
async function seedManyFailedAttemptsJobs(redis: Redis): Promise<void> {
  const queues = getAllQueues()

  logItem('Creating jobs with many failed attempts for scroll testing...')

  // Use payment-processing queue for all high-attempt jobs (easy to find)
  const targetQueueName = 'payment-processing'
  const queue = queues.get(targetQueueName)
  const config = QUEUE_CONFIGS.find((c) => c.name === targetQueueName)

  if (!queue || !config) {
    logItem('  ⚠️ payment-processing queue not found, skipping many-failed-attempts jobs')
    return
  }

  // Create a few jobs with lots of failed attempts
  const testConfigs = [
    { attempts: 50, label: '50 attempts' },
    { attempts: 25, label: '25 attempts' },
    { attempts: 100, label: '100 attempts' },
  ]

  for (const { attempts, label } of testConfigs) {
    await createManyFailedAttemptsJob(queue, config, redis, attempts)
    logItem(`  💥 ${label}: 1 job in ${targetQueueName}`)
  }
}

/**
 * Seed all jobs for all queues
 */
export async function seedAllJobs(redis: Redis): Promise<void> {
  logItem('Creating jobs in various states...')

  const queues = getAllQueues()

  // Seed regular jobs for each queue
  for (const [name, queue] of queues) {
    const config = QUEUE_CONFIGS.find((c) => c.name === name)!
    await seedQueueJobs(queue, config, redis)
    logItem(`  📋 ${name}: jobs created`)
  }

  // Seed delayed jobs across all queues
  await seedDelayedJobs(redis)

  // Seed retry-pending jobs for countdown testing
  await seedRetryPendingJobs(redis)

  // Seed jobs with many failed attempts for scroll testing
  await seedManyFailedAttemptsJobs(redis)

  logSuccess(
    `Jobs seeded: ${jobStats.waiting} waiting, ${jobStats.completed} completed, ` +
    `${jobStats.failed} failed, ${jobStats.delayed} delayed, ${jobStats.retryPending} retry-pending`
  )
}

/**
 * Get job statistics
 */
export function getJobStats(): JobStats {
  return { ...jobStats }
}

/**
 * Reset job statistics (useful for re-seeding)
 */
export function resetJobStats(): void {
  jobStats.waiting = 0
  jobStats.completed = 0
  jobStats.failed = 0
  jobStats.delayed = 0
  jobStats.retryPending = 0
}
