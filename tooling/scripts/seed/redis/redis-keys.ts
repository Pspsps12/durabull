/**
 * Redis Keys Seeding
 *
 * Creates realistic Redis keys for testing the key browser feature.
 * Keys include various types (string, hash, list, set) with different TTLs.
 */

import type { Redis } from 'ioredis'
import { REDIS_KEY_PREFIXES } from '../config'
import {
  shortId,
  prefixedId,
  generateId,
  pickRandom,
  randomInRange,
  randomEmail,
  randomIp,
  randomUserAgent,
  logItem,
  logSuccess,
} from '../utils'

// ============================================================================
// Key Value Generators
// ============================================================================

/**
 * Generate session data
 */
function generateSessionData(): Record<string, unknown> {
  return {
    userId: prefixedId('usr'),
    email: randomEmail(),
    roles: pickRandom([['user'], ['user', 'admin'], ['user', 'moderator']]),
    createdAt: Date.now() - randomInRange(0, 86400000),
    lastActivity: Date.now() - randomInRange(0, 3600000),
    ipAddress: randomIp(),
    userAgent: randomUserAgent(),
    metadata: {
      loginMethod: pickRandom(['password', 'oauth', 'sso']),
      twoFactorEnabled: Math.random() > 0.7,
    },
  }
}

/**
 * Generate user profile cache data
 */
function generateUserProfileCache(): Record<string, unknown> {
  const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer']
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia']
  const firstName = pickRandom(firstNames)
  const lastName = pickRandom(lastNames)

  return {
    id: prefixedId('usr'),
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
    name: `${firstName} ${lastName}`,
    avatar: `https://avatars.example.com/${shortId()}.jpg`,
    plan: pickRandom(['free', 'starter', 'professional', 'enterprise']),
    createdAt: Date.now() - randomInRange(86400000, 31536000000),
    preferences: {
      theme: pickRandom(['light', 'dark', 'system']),
      language: pickRandom(['en', 'es', 'fr', 'de', 'ja']),
      timezone: pickRandom(['America/New_York', 'Europe/London', 'Asia/Tokyo']),
    },
  }
}

/**
 * Generate API response cache data
 */
function generateApiCache(): Record<string, unknown> {
  const endpoints = [
    { path: '/api/products', data: { products: Array(randomInRange(5, 20)).fill({ id: shortId() }) } },
    { path: '/api/users', data: { users: Array(randomInRange(10, 50)).fill({ id: shortId() }) } },
    { path: '/api/orders', data: { orders: Array(randomInRange(5, 30)).fill({ id: shortId() }) } },
    { path: '/api/analytics', data: { metrics: { views: randomInRange(1000, 100000) } } },
  ]

  const endpoint = pickRandom(endpoints)
  return {
    endpoint: endpoint.path,
    data: endpoint.data,
    cachedAt: Date.now() - randomInRange(0, 300000),
    ttl: randomInRange(60, 3600),
    etag: shortId(),
  }
}

/**
 * Generate rate limit data
 */
function generateRateLimitData(): Record<string, unknown> {
  return {
    key: `${pickRandom(['api', 'auth', 'upload'])}:${prefixedId('usr')}`,
    count: randomInRange(1, 100),
    limit: randomInRange(50, 200),
    windowStart: Date.now() - randomInRange(0, 60000),
    windowSize: 60000,
    remaining: randomInRange(0, 50),
  }
}

/**
 * Generate lock data
 */
function generateLockData(): Record<string, unknown> {
  const resources = ['payment', 'order', 'inventory', 'user', 'report']
  return {
    resource: pickRandom(resources),
    resourceId: shortId(),
    owner: prefixedId('worker'),
    acquiredAt: Date.now() - randomInRange(0, 30000),
    expiresAt: Date.now() + randomInRange(5000, 30000),
    renewable: Math.random() > 0.5,
  }
}

/**
 * Generate config data
 */
function generateConfigData(): Record<string, unknown> {
  const configs = [
    {
      key: 'feature:flags',
      value: {
        newDashboard: true,
        betaFeatures: false,
        maintenanceMode: false,
        signupEnabled: true,
      },
    },
    {
      key: 'limits:uploads',
      value: {
        maxFileSize: 104857600,
        allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        maxFilesPerRequest: 10,
      },
    },
    {
      key: 'integrations:stripe',
      value: {
        enabled: true,
        webhookEndpoint: '/api/webhooks/stripe',
        apiVersion: '2023-10-16',
      },
    },
    {
      key: 'cache:settings',
      value: {
        defaultTtl: 3600,
        maxSize: '1GB',
        evictionPolicy: 'lru',
      },
    },
  ]

  return pickRandom(configs).value
}

/**
 * Generate analytics data
 */
function generateAnalyticsData(): Record<string, unknown> {
  const date = new Date(Date.now() - randomInRange(0, 7 * 86400000))
  const dateStr = date.toISOString().split('T')[0]

  return {
    date: dateStr,
    metrics: {
      pageViews: randomInRange(1000, 100000),
      uniqueVisitors: randomInRange(500, 50000),
      sessions: randomInRange(800, 80000),
      bounceRate: randomInRange(20, 60) / 100,
      avgSessionDuration: randomInRange(60, 600),
    },
    topPages: Array(5)
      .fill(null)
      .map(() => ({
        path: `/${pickRandom(['home', 'products', 'about', 'pricing', 'blog'])}`,
        views: randomInRange(100, 10000),
      })),
    sources: {
      organic: randomInRange(30, 50),
      direct: randomInRange(20, 40),
      referral: randomInRange(10, 20),
      social: randomInRange(5, 15),
    },
  }
}

// ============================================================================
// Key Generation Map
// ============================================================================

const KEY_GENERATORS: Record<string, () => Record<string, unknown>> = {
  'session:': generateSessionData,
  'cache:user:': generateUserProfileCache,
  'cache:api:': generateApiCache,
  'rate:': generateRateLimitData,
  'lock:': generateLockData,
  'config:': generateConfigData,
  'analytics:': generateAnalyticsData,
}

// ============================================================================
// Main Seeding Function
// ============================================================================

/**
 * Seed Redis keys for key browser testing
 */
export async function seedRedisKeys(redis: Redis): Promise<void> {
  logItem('Creating Redis keys...')

  let totalKeys = 0
  const pipeline = redis.pipeline()

  for (const keyConfig of REDIS_KEY_PREFIXES) {
    const generator = KEY_GENERATORS[keyConfig.prefix]
    if (!generator) continue

    for (let i = 0; i < keyConfig.count; i++) {
      const keySuffix = generateKeyName(keyConfig.prefix)
      const key = `${keyConfig.prefix}${keySuffix}`
      const value = generator()

      // Use different Redis data types based on the key prefix
      if (keyConfig.prefix === 'rate:' || keyConfig.prefix === 'analytics:') {
        // Store as hash for rate limits and analytics
        pipeline.hset(key, value as Record<string, string | number>)
      } else {
        // Store as string (JSON) for most keys
        pipeline.set(key, JSON.stringify(value))
      }

      // Set TTL if configured
      if (keyConfig.ttl) {
        pipeline.expire(key, keyConfig.ttl)
      }

      totalKeys++
    }

    logItem(`  🔑 ${keyConfig.prefix}* : ${keyConfig.count} keys (${keyConfig.description})`)
  }

  // Add some list and set keys for variety
  await seedCollectionKeys(pipeline)

  await pipeline.exec()
  logSuccess(`Created ${totalKeys + 20} Redis keys`)
}

/**
 * Generate a key name suffix based on prefix
 */
function generateKeyName(prefix: string): string {
  switch (prefix) {
    case 'session:':
      return prefixedId('usr')
    case 'cache:user:':
      return `profile:${prefixedId('usr')}`
    case 'cache:api:':
      return `${pickRandom(['products', 'users', 'orders', 'analytics'])}:${shortId()}`
    case 'rate:':
      return `${pickRandom(['api', 'auth', 'upload'])}:${prefixedId('usr')}:${pickRandom(['minute', 'hour'])}`
    case 'lock:':
      return `${pickRandom(['payment', 'order', 'inventory'])}:${shortId()}`
    case 'config:':
      return pickRandom(['feature:flags', 'limits:uploads', 'integrations:stripe', 'cache:settings', `app:${shortId()}`])
    case 'analytics:':
      const date = new Date(Date.now() - randomInRange(0, 7 * 86400000))
      return `daily:${date.toISOString().split('T')[0]}`
    default:
      return shortId()
  }
}

/**
 * Seed some collection-type keys (lists, sets, sorted sets)
 */
async function seedCollectionKeys(pipeline: ReturnType<Redis['pipeline']>): Promise<void> {
  // Add some list keys (e.g., recent activity)
  for (let i = 0; i < 5; i++) {
    const key = `activity:user:${prefixedId('usr')}`
    const activities = Array(randomInRange(5, 20))
      .fill(null)
      .map(() =>
        JSON.stringify({
          type: pickRandom(['login', 'view', 'edit', 'create', 'delete']),
          resource: pickRandom(['document', 'project', 'task', 'comment']),
          timestamp: Date.now() - randomInRange(0, 86400000),
        })
      )
    for (const activity of activities) {
      pipeline.rpush(key, activity)
    }
    pipeline.expire(key, 86400) // 24 hours
  }

  // Add some set keys (e.g., online users)
  for (let i = 0; i < 5; i++) {
    const key = `online:${pickRandom(['room', 'channel', 'workspace'])}:${shortId()}`
    const userIds = Array(randomInRange(3, 15))
      .fill(null)
      .map(() => prefixedId('usr'))
    for (const userId of userIds) {
      pipeline.sadd(key, userId)
    }
    pipeline.expire(key, 300) // 5 minutes
  }

  // Add some sorted set keys (e.g., leaderboard)
  for (let i = 0; i < 5; i++) {
    const key = `leaderboard:${pickRandom(['weekly', 'monthly', 'alltime'])}:${shortId()}`
    const entries = Array(randomInRange(10, 50))
      .fill(null)
      .map(() => ({
        score: randomInRange(100, 10000),
        member: prefixedId('usr'),
      }))
    for (const entry of entries) {
      pipeline.zadd(key, entry.score, entry.member)
    }
    pipeline.expire(key, 604800) // 7 days
  }
}
