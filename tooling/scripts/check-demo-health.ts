#!/usr/bin/env bun
/**
 * Demo Account Health Check Script
 *
 * Checks if the demo Redis instance was recently seeded and outputs
 * health status information. Useful for monitoring and alerting.
 *
 * Exit codes:
 *   0 - Healthy (seeded within threshold)
 *   1 - Unhealthy (stale data or connection error)
 *   2 - Configuration error
 *
 * Environment Variables:
 *   DURABULL_DEMO_ACCOUNT_REDIS_CONNECTION_STRING (required)
 *   DEMO_HEALTH_MAX_AGE_HOURS (optional, default: 13)
 *
 * Usage:
 *   bun run check-demo-health.ts
 *   bun run check:demo (via package.json)
 *
 * @module check-demo-health
 */

import '@durabull/env'
import { Redis } from 'ioredis'

// ============================================================================
// Configuration
// ============================================================================

const DEMO_REDIS_URL = process.env.DURABULL_DEMO_ACCOUNT_REDIS_CONNECTION_STRING
const MAX_AGE_HOURS = Number(process.env.DEMO_HEALTH_MAX_AGE_HOURS) || 13 // 12 hours + 1 hour buffer
const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000

// ============================================================================
// Types
// ============================================================================

interface SeedMetadata {
  lastSeedAt: string
  lastSeedTimestamp: number
  scriptVersion: string
  durationMs: number
  nodeEnv: string
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'error'
  timestamp: string
  demo: {
    lastSeeded?: string
    lastSeedTimestamp?: number
    ageMs?: number
    ageHours?: number
    isStale: boolean
    scriptVersion?: string
    seedDurationMs?: number
  }
  redis: {
    connected: boolean
    keyCount?: number
    latencyMs?: number
  }
  thresholds: {
    maxAgeHours: number
    maxAgeMs: number
  }
  error?: string
}

// ============================================================================
// Health Check Logic
// ============================================================================

async function checkHealth(): Promise<HealthStatus> {
  const status: HealthStatus = {
    status: 'error',
    timestamp: new Date().toISOString(),
    demo: {
      isStale: true,
    },
    redis: {
      connected: false,
    },
    thresholds: {
      maxAgeHours: MAX_AGE_HOURS,
      maxAgeMs: MAX_AGE_MS,
    },
  }

  // Check configuration
  if (!DEMO_REDIS_URL) {
    status.error = 'DURABULL_DEMO_ACCOUNT_REDIS_CONNECTION_STRING is not set'
    return status
  }

  // Connect to Redis
  const redis = new Redis(DEMO_REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 10000,
    lazyConnect: true,
  })

  try {
    const connectStart = Date.now()
    await redis.connect()
    status.redis.connected = true
    status.redis.latencyMs = Date.now() - connectStart

    // Get key count
    status.redis.keyCount = await redis.dbsize()

    // Get seed metadata
    const metadataStr = await redis.get('durabull:demo:seed-metadata')

    if (!metadataStr) {
      status.error = 'No seed metadata found - demo may never have been seeded'
      status.status = 'unhealthy'
      return status
    }

    const metadata: SeedMetadata = JSON.parse(metadataStr)
    const now = Date.now()
    const ageMs = now - metadata.lastSeedTimestamp
    const ageHours = ageMs / (60 * 60 * 1000)

    status.demo = {
      lastSeeded: metadata.lastSeedAt,
      lastSeedTimestamp: metadata.lastSeedTimestamp,
      ageMs,
      ageHours: Math.round(ageHours * 100) / 100,
      isStale: ageMs > MAX_AGE_MS,
      scriptVersion: metadata.scriptVersion,
      seedDurationMs: metadata.durationMs,
    }

    if (status.demo.isStale) {
      status.status = 'unhealthy'
      status.error = `Demo data is stale (${status.demo.ageHours} hours old, max is ${MAX_AGE_HOURS})`
    } else {
      status.status = 'healthy'
    }

    return status
  } catch (error) {
    status.error = `Redis error: ${(error as Error).message}`
    return status
  } finally {
    await redis.quit().catch(() => {})
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const status = await checkHealth()

  // Output JSON for machine consumption
  console.log(JSON.stringify(status, null, 2))

  // Exit with appropriate code
  if (status.status === 'healthy') {
    process.exit(0)
  } else if (status.status === 'unhealthy') {
    process.exit(1)
  } else {
    process.exit(2)
  }
}

main()
