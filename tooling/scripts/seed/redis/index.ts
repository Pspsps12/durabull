/**
 * Redis Seeding Orchestrator
 *
 * Coordinates all Redis seeding operations including queues, jobs,
 * scheduled jobs, Redis keys, and workers.
 */

import type { Redis } from 'ioredis'
import type { Worker } from 'bullmq'
import { QUEUE_CONFIGS } from '../config'
import { logSection, logSuccess, logItem } from '../utils'
import { createAllQueues, pauseQueue, closeAllQueues, getAllQueues } from './queues'
import { seedAllJobs, getJobStats } from './jobs'
import { seedScheduledJobs } from './scheduled-jobs'
import { seedRedisKeys } from './redis-keys'
import { startMockWorkers } from './workers'

const SEED_MARKER_KEY = 'durabull:seed:enhanced:v1'

// ============================================================================
// Check if Already Seeded
// ============================================================================

async function isAlreadySeeded(redis: Redis): Promise<boolean> {
  // Use a dedicated marker written only by this seed script.
  // Queue meta keys can exist from other processes (for example workload generators).
  return (await redis.exists(SEED_MARKER_KEY)) === 1
}

// ============================================================================
// Main Seeding Function
// ============================================================================

/**
 * Seed Redis with all development data
 */
export async function seedRedis(redis: Redis): Promise<void> {
  logSection('Seeding Redis')

  // Check if already seeded
  if (await isAlreadySeeded(redis)) {
    logItem('Redis already contains seed data, skipping queue/job seeding...')
    logItem('(Delete Redis data to re-seed)')

    // Still seed Redis keys as they may have expired
    await seedRedisKeys(redis)
    return
  }

  try {
    // 1. Create all queues
    logItem('Phase 1: Creating queues')
    await createAllQueues()

    // 2. Pause queues that should be paused
    const pausedQueues = QUEUE_CONFIGS.filter((q) => q.isPaused)
    for (const queue of pausedQueues) {
      const q = getAllQueues().get(queue.name)
      if (q) {
        await pauseQueue(queue.name)
      }
    }

    // 3. Seed jobs in various states
    logItem('Phase 2: Creating jobs')
    await seedAllJobs(redis)

    // 4. Seed scheduled jobs
    logItem('Phase 3: Creating scheduled jobs')
    await seedScheduledJobs(redis)

    // 5. Seed general Redis keys
    logItem('Phase 4: Creating Redis keys')
    await seedRedisKeys(redis)

    // 6. Mark this Redis DB as successfully seeded by this script.
    await redis.set(SEED_MARKER_KEY, new Date().toISOString())

    // Print summary
    const jobStats = getJobStats()
    const queues = getAllQueues()

    logSection('Seed Summary')
    logSuccess(`Queues: ${queues.size}`)
    logSuccess(`Jobs: ${Object.values(jobStats).reduce((a, b) => a + b, 0)} total`)
    logItem(`  - Waiting: ${jobStats.waiting}`)
    logItem(`  - Completed: ${jobStats.completed}`)
    logItem(`  - Failed: ${jobStats.failed}`)
    logItem(`  - Delayed: ${jobStats.delayed}`)
    logItem(`  - Retry Pending: ${jobStats.retryPending}`)

    // Close queue connections (they'll be reopened by the app)
    await closeAllQueues()

  } catch (error) {
    // Clean up on error
    await closeAllQueues()
    throw error
  }
}

/**
 * Start mock workers (exported for use by main script)
 */
export { startMockWorkers }
