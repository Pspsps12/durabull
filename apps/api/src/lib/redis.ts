import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

// Cache for Redis connections keyed by connection ID
const redisConnections = new Map<string, Redis>()
// Cache for queues keyed by "connectionId:queueName"
const queues = new Map<string, Queue>()

function extractQueueNameFromMetaKey(key: string): string | null {
  // BullMQ meta keys end with ":meta". Queue names cannot contain ":".
  // This means the queue name is always the segment just before "meta",
  // even when prefixes are namespaced (for example "bull:prod-east:<queue>:meta").
  const parts = key.split(':')
  if (parts.length < 3) return null
  if (parts[parts.length - 1] !== 'meta') return null

  const queueName = parts[parts.length - 2]
  if (!queueName) return null
  return queueName
}

/**
 * Get or create a Redis connection for the given connection ID and URL.
 * The connection ID is used for caching, the URL is the actual Redis connection string.
 */
export async function getRedis(
  connectionId: string,
  connectionUrl: string,
  connectionName?: string
): Promise<Redis> {
  if (!redisConnections.has(connectionId)) {
    const redis = new Redis(connectionUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    })

    redis.on('error', (err) =>
      console.error(`❌ Redis error (${connectionName ?? connectionId}):`, err)
    )

    await redis.connect()
    console.log(`✅ Connected to Redis: ${connectionName ?? connectionId}`)

    redisConnections.set(connectionId, redis)
  }

  return redisConnections.get(connectionId)!
}

/**
 * Discover queues for a specific Redis connection.
 */
export async function discoverQueues(
  connectionId: string,
  connectionUrl: string
): Promise<Array<string>> {
  const redisClient = await getRedis(connectionId, connectionUrl)

  // Auto-discover BullMQ queues by scanning Redis keys
  const queueNames = new Set<string>()
  let cursor = '0'

  do {
    const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', 'bull:*:meta', 'COUNT', 100)
    cursor = nextCursor

    for (const key of keys) {
      const queueName = extractQueueNameFromMetaKey(key)
      if (queueName) {
        queueNames.add(queueName)
      }
    }
  } while (cursor !== '0')

  return Array.from(queueNames)
}

/**
 * Debug: Get all bull:* keys to understand the Redis structure.
 */
export async function debugGetBullKeys(
  connectionId: string,
  connectionUrl: string
): Promise<string[]> {
  const redisClient = await getRedis(connectionId, connectionUrl)
  const keys: string[] = []
  let cursor = '0'

  do {
    const [nextCursor, foundKeys] = await redisClient.scan(cursor, 'MATCH', 'bull:*', 'COUNT', 100)
    cursor = nextCursor
    keys.push(...foundKeys)
  } while (cursor !== '0')

  return keys.sort()
}

/**
 * Get or create a Queue instance for the given connection and queue name.
 */
export async function getQueue(
  connectionId: string,
  connectionUrl: string,
  name: string
): Promise<Queue> {
  const cacheKey = `${connectionId}:${name}`

  if (!queues.has(cacheKey)) {
    // Create a new queue with its own connection (BullMQ manages this internally)
    const queue = new Queue(name, {
      connection: {
        url: connectionUrl,
        maxRetriesPerRequest: null,
      },
    })
    queues.set(cacheKey, queue)
  }

  return queues.get(cacheKey)!
}
