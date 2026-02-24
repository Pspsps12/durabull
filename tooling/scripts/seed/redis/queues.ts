/**
 * Queue Creation and Management
 *
 * Creates BullMQ queues with proper configuration.
 */

import { Queue } from 'bullmq'
import type { Redis } from 'ioredis'
import { QUEUE_CONFIGS, type QueueConfig, getRedisUrl } from '../config'
import { logItem, logSuccess } from '../utils'

// Store created queues for later use
const createdQueues: Map<string, Queue> = new Map()

/**
 * Create a BullMQ queue with proper configuration
 */
export async function createQueue(config: QueueConfig): Promise<Queue> {
  const queue = new Queue(config.name, {
    connection: { 
      url: getRedisUrl(),
      family: 4, // Force IPv4 to avoid IPv6 resolution issues
    },
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 30000, // 30 seconds base delay
      },
      removeOnComplete: {
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        count: 500, // Keep last 500 failed jobs
      },
    },
  })

  createdQueues.set(config.name, queue)
  return queue
}

/**
 * Create all queues defined in config
 */
export async function createAllQueues(): Promise<Map<string, Queue>> {
  const redisUrl = getRedisUrl()
  // Log the Redis URL being used (mask any credentials)
  const maskedUrl = redisUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')
  logItem(`Creating queues using Redis: ${maskedUrl}`)

  for (const config of QUEUE_CONFIGS) {
    await createQueue(config)
    logItem(`  📦 ${config.name} (${config.category})`)
  }

  logSuccess(`Created ${QUEUE_CONFIGS.length} queues`)
  return createdQueues
}

/**
 * Get a queue by name
 */
export function getQueue(name: string): Queue | undefined {
  return createdQueues.get(name)
}

/**
 * Get all created queues
 */
export function getAllQueues(): Map<string, Queue> {
  return createdQueues
}

/**
 * Pause a queue (for testing pause/resume functionality)
 */
export async function pauseQueue(name: string): Promise<void> {
  const queue = createdQueues.get(name)
  if (queue) {
    await queue.pause()
    logItem(`  ⏸️  Paused queue: ${name}`)
  }
}

/**
 * Close all queues (cleanup)
 */
export async function closeAllQueues(): Promise<void> {
  for (const queue of createdQueues.values()) {
    await queue.close()
  }
  createdQueues.clear()
}

/**
 * Get queue configurations
 */
export function getQueueConfigs(): QueueConfig[] {
  return QUEUE_CONFIGS
}
