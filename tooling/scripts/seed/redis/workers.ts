/**
 * Mock Workers
 *
 * Creates mock BullMQ workers for development.
 * Workers process jobs with realistic delays and occasional failures.
 */

import { Worker, type Job } from 'bullmq'
import type { Redis } from 'ioredis'
import { QUEUE_CONFIGS, REDIS_URL } from '../config'
import { generateReturnValue } from '../generators/payloads'
import { randomInRange, randomBool, logItem, logSuccess } from '../utils'

// Store active workers
const activeWorkers: Worker[] = []

// ============================================================================
// Worker Names
// ============================================================================

const WORKER_NAMES = [
  'worker-alpha',
  'worker-beta',
  'worker-gamma',
  'worker-delta',
  'worker-epsilon',
  'worker-zeta',
  'worker-eta',
  'worker-theta',
]

// ============================================================================
// Job Processing
// ============================================================================

/**
 * Create a job processor function for a queue
 */
function createJobProcessor(queueName: string) {
  return async (job: Job): Promise<Record<string, unknown>> => {
    // Simulate processing with random delay
    const delay = randomInRange(100, 800)
    await new Promise((resolve) => setTimeout(resolve, delay))

    // Log progress for some jobs
    if (randomBool(0.3)) {
      await job.updateProgress(randomInRange(20, 80))
      await new Promise((resolve) => setTimeout(resolve, randomInRange(50, 200)))
    }

    // Small chance of failure for realism (5%)
    if (randomBool(0.05)) {
      const errors = [
        'Simulated worker failure',
        'Connection timeout',
        'External service unavailable',
        'Rate limit exceeded',
      ]
      throw new Error(errors[Math.floor(Math.random() * errors.length)])
    }

    // Generate return value
    return generateReturnValue(queueName, job.name)
  }
}

// ============================================================================
// Worker Creation
// ============================================================================

/**
 * Create workers for a specific queue
 */
function createWorkersForQueue(
  queueName: string,
  workerConfig: { count: number; concurrency: number; rateLimit: { max: number; duration: number } },
  workerIndex: number
): Worker[] {
  const workers: Worker[] = []

  for (let i = 0; i < workerConfig.count; i++) {
    const workerName = WORKER_NAMES[(workerIndex + i) % WORKER_NAMES.length]

    const worker = new Worker(queueName, createJobProcessor(queueName), {
      connection: { url: REDIS_URL },
      name: workerName,
      concurrency: workerConfig.concurrency,
      limiter: workerConfig.rateLimit,
    })

    // Error handling
    worker.on('error', (err) => {
      // Ignore connection errors when shutting down
      if (!err.message.includes('ECONNREFUSED') && !err.message.includes('closed')) {
        console.error(`Worker ${workerName} error:`, err.message)
      }
    })

    worker.on('failed', (job, err) => {
      // Log failures for debugging (optional)
      // console.log(`Job ${job?.id} failed:`, err.message)
    })

    workers.push(worker)
  }

  return workers
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Start mock workers for all queues with worker configurations
 */
export async function startMockWorkers(redis: Redis): Promise<Worker[]> {
  logItem('Starting mock workers...')

  let workerIndex = 0
  let totalWorkers = 0

  for (const queueConfig of QUEUE_CONFIGS) {
    if (!queueConfig.workerConfig) continue

    const workers = createWorkersForQueue(
      queueConfig.name,
      queueConfig.workerConfig,
      workerIndex
    )

    activeWorkers.push(...workers)
    workerIndex += workers.length
    totalWorkers += workers.length

    logItem(`  👷 ${queueConfig.name}: ${workers.length} workers (concurrency: ${queueConfig.workerConfig.concurrency})`)
  }

  // Add some workers for queues without specific config (1 worker each)
  for (const queueConfig of QUEUE_CONFIGS) {
    if (queueConfig.workerConfig) continue
    if (queueConfig.isPaused) continue // Don't add workers to paused queues

    const defaultConfig = {
      count: 1,
      concurrency: 3,
      rateLimit: { max: 20, duration: 60000 },
    }

    const workers = createWorkersForQueue(
      queueConfig.name,
      defaultConfig,
      workerIndex
    )

    activeWorkers.push(...workers)
    workerIndex += workers.length
    totalWorkers += workers.length

    logItem(`  👷 ${queueConfig.name}: 1 worker (default config)`)
  }

  logSuccess(`Started ${totalWorkers} mock workers across ${QUEUE_CONFIGS.length} queues`)
  return activeWorkers
}

/**
 * Stop all mock workers
 */
export async function stopMockWorkers(): Promise<void> {
  logItem('Stopping mock workers...')

  for (const worker of activeWorkers) {
    await worker.close()
  }

  activeWorkers.length = 0
  logSuccess('All workers stopped')
}

/**
 * Get active workers
 */
export function getActiveWorkers(): Worker[] {
  return [...activeWorkers]
}

/**
 * Get worker statistics
 */
export function getWorkerStats(): { total: number; byQueue: Record<string, number> } {
  const byQueue: Record<string, number> = {}

  for (const worker of activeWorkers) {
    const queueName = worker.name
    byQueue[queueName] = (byQueue[queueName] || 0) + 1
  }

  return {
    total: activeWorkers.length,
    byQueue,
  }
}
