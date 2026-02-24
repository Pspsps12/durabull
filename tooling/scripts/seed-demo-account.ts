#!/usr/bin/env bun
/**
 * Demo Account Redis Seed Script
 *
 * This script is designed to run as a cron job (every 12 hours) to maintain
 * a fresh demo account with realistic data for showcasing Durabull's features.
 *
 * Features:
 * - Complete Redis wipe and reseed for demo account
 * - Production-grade error handling and logging
 * - Structured JSON logging for monitoring integration
 * - Graceful shutdown handling
 * - Execution metrics and timing
 *
 * Environment Variables:
 *   DURABULL_DEMO_ACCOUNT_REDIS_CONNECTION_STRING (required)
 *     - The Redis connection URL for the demo account
 *     - Example: redis://user:pass@host:6379
 *
 * Usage:
 *   bun run seed-demo-account.ts
 *   bun run seed:demo (via package.json)
 *
 * @module seed-demo-account
 * @see DEMO_ACCOUNT_SETUP.md for full documentation
 */

import '@durabull/env'
import { Redis } from 'ioredis'
import { QUEUE_CONFIGS, REDIS_KEY_PREFIXES, DELAYED_TIME_DISTRIBUTION } from './seed/config'
import { createAllQueues, pauseQueue, closeAllQueues, getAllQueues } from './seed/redis/queues'
import { seedAllJobs, getJobStats, resetJobStats } from './seed/redis/jobs'
import { seedScheduledJobs } from './seed/redis/scheduled-jobs'
import { seedRedisKeys } from './seed/redis/redis-keys'

// ============================================================================
// Configuration
// ============================================================================

const DEMO_REDIS_URL = process.env.DURABULL_DEMO_ACCOUNT_REDIS_CONNECTION_STRING
const SCRIPT_VERSION = '1.0.0'
const SCRIPT_NAME = 'seed-demo-account'

// ============================================================================
// Structured Logging
// ============================================================================

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  timestamp: string
  level: LogLevel
  script: string
  version: string
  message: string
  data?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    script: SCRIPT_NAME,
    version: SCRIPT_VERSION,
    message,
    data,
  }

  // In production (CI/cron), output JSON for log aggregation
  // In development (tty), output human-readable format
  if (process.stdout.isTTY) {
    const prefix = {
      info: '✅',
      warn: '⚠️',
      error: '❌',
      debug: '🔍',
    }[level]
    console.log(`${prefix} [${entry.timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  } else {
    console.log(JSON.stringify(entry))
  }
}

function logError(message: string, error: Error, data?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    script: SCRIPT_NAME,
    version: SCRIPT_VERSION,
    message,
    data,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  }

  if (process.stdout.isTTY) {
    console.error(`❌ [${entry.timestamp}] ${message}`)
    console.error(`   Error: ${error.message}`)
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`)
    }
    if (data) {
      console.error(`   Data: ${JSON.stringify(data, null, 2)}`)
    }
  } else {
    console.log(JSON.stringify(entry))
  }
}

// ============================================================================
// Execution Metrics
// ============================================================================

interface ExecutionMetrics {
  startTime: number
  endTime?: number
  durationMs?: number
  phases: {
    name: string
    durationMs: number
    success: boolean
    details?: Record<string, unknown>
  }[]
  jobStats?: ReturnType<typeof getJobStats>
  queueCount?: number
  success: boolean
  errorMessage?: string
}

const metrics: ExecutionMetrics = {
  startTime: Date.now(),
  phases: [],
  success: false,
}

async function trackPhase<T>(
  name: string,
  fn: () => Promise<T>,
  detailsFn?: (result: T) => Record<string, unknown>
): Promise<T> {
  const phaseStart = Date.now()
  log('info', `Starting phase: ${name}`)

  try {
    const result = await fn()
    const durationMs = Date.now() - phaseStart
    const details = detailsFn ? detailsFn(result) : undefined

    metrics.phases.push({ name, durationMs, success: true, details })
    log('info', `Completed phase: ${name}`, { durationMs, ...details })

    return result
  } catch (error) {
    const durationMs = Date.now() - phaseStart
    metrics.phases.push({ name, durationMs, success: false })
    throw error
  }
}

// ============================================================================
// Environment Validation
// ============================================================================

function validateEnvironment(): void {
  log('info', 'Validating environment configuration')

  // Debug: Log what we received (mask credentials)
  const maskedUrl = DEMO_REDIS_URL 
    ? DEMO_REDIS_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
    : '<undefined>'
  log('info', 'DURABULL_DEMO_ACCOUNT_REDIS_CONNECTION_STRING', { 
    isDefined: !!DEMO_REDIS_URL,
    length: DEMO_REDIS_URL?.length ?? 0,
    maskedUrl,
  })

  if (!DEMO_REDIS_URL) {
    throw new Error(
      'DURABULL_DEMO_ACCOUNT_REDIS_CONNECTION_STRING environment variable is required. ' +
      'This should be set to the Redis connection URL for the demo account.'
    )
  }

  // Validate Redis URL format (basic check)
  try {
    const url = new URL(DEMO_REDIS_URL)
    if (!['redis:', 'rediss:'].includes(url.protocol)) {
      throw new Error('Invalid protocol')
    }
    log('info', 'Environment validation passed', {
      redisHost: url.hostname,
      redisPort: url.port || '6379',
      usesTls: url.protocol === 'rediss:',
    })
  } catch (error) {
    throw new Error(
      `Invalid DURABULL_DEMO_ACCOUNT_REDIS_CONNECTION_STRING format. ` +
      `Expected format: redis://[user:pass@]host:port or rediss://[user:pass@]host:port`
    )
  }
}

// ============================================================================
// Redis Connection Management
// ============================================================================

let redis: Redis | null = null

async function connectToRedis(): Promise<Redis> {
  log('info', 'Connecting to demo Redis instance')

  redis = new Redis(DEMO_REDIS_URL!, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 5) {
        log('error', 'Max Redis connection retries exceeded')
        return null // Stop retrying
      }
      const delay = Math.min(times * 1000, 5000)
      log('warn', `Redis connection attempt ${times} failed, retrying in ${delay}ms`)
      return delay
    },
    lazyConnect: true,
    enableReadyCheck: true,
    connectTimeout: 30000,
    family: 4, // Force IPv4 to avoid IPv6 resolution issues
  })

  // Add error handler
  redis.on('error', (err) => {
    logError('Redis connection error', err)
  })

  await redis.connect()

  // Verify connection with PING
  const pong = await redis.ping()
  if (pong !== 'PONG') {
    throw new Error(`Unexpected PING response: ${pong}`)
  }

  log('info', 'Successfully connected to demo Redis instance')
  return redis
}

async function disconnectFromRedis(): Promise<void> {
  if (redis) {
    log('info', 'Disconnecting from Redis')
    await redis.quit().catch((err) => {
      log('warn', 'Error during Redis disconnect', { error: err.message })
    })
    redis = null
  }
}

// ============================================================================
// Redis Wipe
// ============================================================================

async function wipeRedis(redisClient: Redis): Promise<{ keysDeleted: number }> {
  log('info', 'Wiping Redis database')

  // Get key count before wipe for metrics
  const keyCountBefore = await redisClient.dbsize()
  log('info', `Found ${keyCountBefore} keys to delete`)

  // Use FLUSHDB to clear the current database
  // This is atomic and faster than deleting keys individually
  await redisClient.flushdb()

  // Verify the wipe
  const keyCountAfter = await redisClient.dbsize()
  if (keyCountAfter !== 0) {
    log('warn', 'Some keys remain after FLUSHDB', { remainingKeys: keyCountAfter })
  }

  log('info', 'Redis database wiped successfully', { keysDeleted: keyCountBefore })
  return { keysDeleted: keyCountBefore }
}

// ============================================================================
// Redis Seeding (Demo Account Specific)
// ============================================================================

/**
 * Override the REDIS_URL for the seed operations to use the demo account URL
 */
function setupDemoRedisEnvironment(): void {
  // The seed scripts read from process.env.REDIS_URL
  // Override it temporarily for the demo seeding
  process.env.REDIS_URL = DEMO_REDIS_URL
}

/**
 * Write health check metadata to Redis
 * This allows external systems to verify the demo account is fresh
 */
async function writeHealthMetadata(redisClient: Redis, startTime: number): Promise<void> {
  const metadata = {
    lastSeedAt: new Date().toISOString(),
    lastSeedTimestamp: Date.now(),
    scriptVersion: SCRIPT_VERSION,
    durationMs: Date.now() - startTime,
    nodeEnv: process.env.NODE_ENV || 'development',
  }

  // Write metadata with 24-hour TTL (longer than 12-hour interval as buffer)
  await redisClient.set(
    'durabull:demo:seed-metadata',
    JSON.stringify(metadata),
    'EX',
    24 * 60 * 60
  )

  // Also write a simple "last seeded" timestamp for quick checks
  await redisClient.set(
    'durabull:demo:last-seeded',
    Date.now().toString(),
    'EX',
    24 * 60 * 60
  )

  log('info', 'Health metadata written to Redis', metadata)
}

async function seedDemoRedis(redisClient: Redis): Promise<void> {
  log('info', 'Starting Redis seeding for demo account')

  // Reset job stats from any previous runs
  resetJobStats()

  // 1. Create all queues
  log('info', 'Phase 1: Creating queues')
  await createAllQueues()

  // 2. Pause queues that should be paused (for demo purposes)
  const pausedQueues = QUEUE_CONFIGS.filter((q) => q.isPaused)
  for (const queue of pausedQueues) {
    const q = getAllQueues().get(queue.name)
    if (q) {
      await pauseQueue(queue.name)
      log('debug', `Paused queue: ${queue.name}`)
    }
  }

  // 3. Seed jobs in various states
  log('info', 'Phase 2: Creating jobs')
  await seedAllJobs(redisClient)

  // 4. Seed scheduled jobs
  log('info', 'Phase 3: Creating scheduled jobs')
  await seedScheduledJobs(redisClient)

  // 5. Seed general Redis keys (for key browser demo)
  log('info', 'Phase 4: Creating Redis keys')
  await seedRedisKeys(redisClient)

  // Close queue connections
  await closeAllQueues()

  // Write health metadata (for monitoring)
  await writeHealthMetadata(redisClient, metrics.startTime)

  log('info', 'Redis seeding completed successfully')
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

let isShuttingDown = false

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return
  isShuttingDown = true

  log('warn', `Received ${signal}, initiating graceful shutdown`)

  try {
    await closeAllQueues().catch(() => {})
    await disconnectFromRedis()
  } catch (error) {
    logError('Error during graceful shutdown', error as Error)
  }

  // Record final metrics
  metrics.endTime = Date.now()
  metrics.durationMs = metrics.endTime - metrics.startTime

  log('info', 'Shutdown complete', {
    totalDurationMs: metrics.durationMs,
    success: metrics.success,
  })

  process.exit(metrics.success ? 0 : 1)
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('uncaughtException', async (error) => {
  logError('Uncaught exception', error)
  await gracefulShutdown('uncaughtException')
})
process.on('unhandledRejection', async (reason) => {
  logError('Unhandled rejection', reason as Error)
  await gracefulShutdown('unhandledRejection')
})

// ============================================================================
// Main Execution
// ============================================================================

async function main(): Promise<void> {
  log('info', '='.repeat(60))
  log('info', 'Durabull Demo Account Seed Job Starting', {
    version: SCRIPT_VERSION,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
  log('info', '='.repeat(60))

  try {
    // Phase 1: Validate environment
    await trackPhase('environment-validation', async () => {
      validateEnvironment()
    })

    // Phase 2: Connect to Redis
    const redisClient = await trackPhase(
      'redis-connection',
      async () => connectToRedis(),
      () => ({ connected: true })
    )

    // Setup environment for seed scripts
    setupDemoRedisEnvironment()

    // Phase 3: Wipe Redis
    await trackPhase(
      'redis-wipe',
      async () => wipeRedis(redisClient),
      (result) => result
    )

    // Phase 4: Seed Redis
    await trackPhase('redis-seed', async () => seedDemoRedis(redisClient))

    // Collect final metrics
    const jobStats = getJobStats()
    const queues = getAllQueues()

    metrics.jobStats = jobStats
    metrics.queueCount = queues.size
    metrics.success = true
    metrics.endTime = Date.now()
    metrics.durationMs = metrics.endTime - metrics.startTime

    // Log summary
    log('info', '='.repeat(60))
    log('info', 'Demo Account Seed Completed Successfully', {
      totalDurationMs: metrics.durationMs,
      queuesCreated: metrics.queueCount,
      jobsCreated: {
        total: Object.values(jobStats).reduce((a, b) => a + b, 0),
        waiting: jobStats.waiting,
        completed: jobStats.completed,
        failed: jobStats.failed,
        delayed: jobStats.delayed,
        retryPending: jobStats.retryPending,
      },
      phases: metrics.phases.map((p) => ({
        name: p.name,
        durationMs: p.durationMs,
        success: p.success,
      })),
    })
    log('info', '='.repeat(60))

    // Clean up
    await disconnectFromRedis()

    process.exit(0)
  } catch (error) {
    metrics.success = false
    metrics.errorMessage = (error as Error).message
    metrics.endTime = Date.now()
    metrics.durationMs = metrics.endTime - metrics.startTime

    logError('Demo account seed failed', error as Error, {
      durationMs: metrics.durationMs,
      completedPhases: metrics.phases.filter((p) => p.success).map((p) => p.name),
      failedPhase: metrics.phases.find((p) => !p.success)?.name,
    })

    // Clean up
    await closeAllQueues().catch(() => {})
    await disconnectFromRedis()

    process.exit(1)
  }
}

// Run the script
main()
