import { createHmac } from 'node:crypto'
import {
  isKnownDurabullTelemetryEvent,
  sanitizeTelemetryEvent,
} from '@durabull/analytics/sanitizer'
import {
  getDatabaseMode,
  shouldUseEnvConnections,
  telemetryInstallationRepository,
} from '@durabull/dal'
import { env } from '@durabull/env'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { isAuthlessMode } from '../lib/authless'

// Self-hosted instances forward sanitized batches to the existing Durabull cloud API.
// There is no separate event-ingestion app or alternate telemetry hostname to deploy.
const DURABULL_CLOUD_API_HOST = 'app.durabull.io'
const DURABULL_TELEMETRY_INGEST_ENDPOINT = `https://${DURABULL_CLOUD_API_HOST}/api/telemetry/collect`
const DEFAULT_POSTHOG_BATCH_HOST = 'https://us.i.posthog.com'
const MAX_COLLECT_EVENTS_PER_BATCH = 50
export const TELEMETRY_DISCLOSURE_URL = 'https://durabull.io/privacy'

const telemetryPayloadSchema = z.object({
  event: z.string().min(1).max(128),
  properties: z.record(z.unknown()).optional(),
  sessionId: z.string().min(1).max(128),
  timestamp: z.string().datetime().optional(),
})

const telemetryCollectEventSchema = z.object({
  event: z.string().min(1).max(128),
  properties: z.record(z.unknown()).default({}),
  sessionId: z.string().min(1).max(128),
  timestamp: z.string().datetime().optional(),
})

const telemetryCollectPayloadSchema = z.object({
  sentAt: z.string().datetime().optional(),
  instanceId: z.string().min(16).max(128),
  events: z.array(telemetryCollectEventSchema).min(1).max(MAX_COLLECT_EVENTS_PER_BATCH),
})

interface TelemetryCollectConfig {
  hmacSecret: string
  posthogBatchUrl: string
  posthogKey: string
}

export function isDurabullTelemetryEnabled(): boolean {
  if (env.NODE_ENV === 'test' || env.CI === true) return false
  return env.NODE_ENV === 'production'
}

export function isDurabullManagedPosthogProject(): boolean {
  if (env.DURABULL_CLOUD === true) return true

  try {
    return new URL(env.APP_BASE_URL).hostname === DURABULL_CLOUD_API_HOST
  } catch {
    return false
  }
}

export function isDurabullTelemetryCollectEnabled(): boolean {
  return env.DURABULL_CLOUD === true || isDurabullManagedPosthogProject()
}

export function getTelemetryStatus() {
  return {
    enabled: isDurabullTelemetryEnabled(),
    collectionRequired: true as const,
    dedupeIdentifiedPosthogEvents: shouldDedupeIdentifiedPosthogEvents(),
    disclosureUrl: TELEMETRY_DISCLOSURE_URL,
  }
}

export function hashTelemetryIdentifier(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

function getDurabullTelemetryPosthogKey(): string | null {
  return env.DURABULL_TELEMETRY_POSTHOG_KEY?.trim() || env.POSTHOG_KEY?.trim() || null
}

function shouldDedupeIdentifiedPosthogEvents(): boolean {
  const appPosthogKey = env.POSTHOG_KEY?.trim()
  if (!appPosthogKey || !isDurabullManagedPosthogProject()) return false

  return getDurabullTelemetryPosthogKey() === appPosthogKey
}

function getPosthogBatchUrl(): string | null {
  const rawHost = env.DURABULL_TELEMETRY_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_BATCH_HOST
  const hostWithProtocol = /^https?:\/\//i.test(rawHost) ? rawHost : `https://${rawHost}`

  try {
    const parsed = new URL(hostWithProtocol)
    const basePath = parsed.pathname.replace(/\/$/, '')
    const batchPath = basePath.endsWith('/batch') ? basePath : `${basePath}/batch`

    return `${parsed.origin}${batchPath}/`
  } catch {
    return null
  }
}

function getTelemetryCollectConfig(): TelemetryCollectConfig | null {
  const posthogKey = getDurabullTelemetryPosthogKey()
  const hmacSecret = env.DURABULL_TELEMETRY_HMAC_SECRET?.trim() || env.BETTER_AUTH_SECRET?.trim()
  const posthogBatchUrl = getPosthogBatchUrl()

  if (!posthogKey || !hmacSecret || !posthogBatchUrl) return null

  return {
    hmacSecret,
    posthogBatchUrl,
    posthogKey,
  }
}

async function forwardTelemetryEvent(payload: {
  anonymousInstanceId: string
  event: string
  properties: Record<string, unknown>
  sessionId: string
  timestamp: string
}) {
  try {
    await fetch(DURABULL_TELEMETRY_INGEST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sentAt: new Date().toISOString(),
        instanceId: payload.anonymousInstanceId,
        events: [
          {
            event: payload.event,
            properties: {
              ...payload.properties,
              authless: isAuthlessMode(),
              env_connections: shouldUseEnvConnections(),
              environment: env.NODE_ENV ?? 'development',
              persistence: getDatabaseMode(),
              stateless: getDatabaseMode() === 'pglite',
            },
            sessionId: payload.sessionId,
            timestamp: payload.timestamp,
          },
        ],
      }),
    })
  } catch {
    // Telemetry collection must never affect the local product experience.
  }
}

const telemetryRoutes = new Hono()
  .get('/status', (c) => c.json(getTelemetryStatus()))
  .post('/collect', zValidator('json', telemetryCollectPayloadSchema), async (c) => {
    if (!isDurabullTelemetryCollectEnabled()) {
      return c.json({ error: 'Not Found' }, 404)
    }

    const config = getTelemetryCollectConfig()
    if (!config) {
      return c.json({ error: 'Telemetry collection is not configured' }, 503)
    }

    const payload = c.req.valid('json')
    const batch = []

    for (const event of payload.events) {
      if (!isKnownDurabullTelemetryEvent(event.event)) {
        return c.json({ error: 'Unknown telemetry event' }, 400)
      }

      const sanitized = sanitizeTelemetryEvent(event.event, event.properties)
      if (sanitized.droppedProperties.length > 0) {
        return c.json({ error: 'Invalid telemetry properties' }, 400)
      }

      const distinctId = hashTelemetryIdentifier(
        `${payload.instanceId}:${event.sessionId}`,
        config.hmacSecret
      )
      const instanceKey = hashTelemetryIdentifier(payload.instanceId, config.hmacSecret)

      batch.push({
        event: sanitized.event,
        properties: {
          ...sanitized.properties,
          $geoip_disable: true,
          $process_person_profile: false,
          distinct_id: distinctId,
          instance_key: instanceKey,
        },
        timestamp: event.timestamp ?? payload.sentAt ?? new Date().toISOString(),
      })
    }

    try {
      const posthogResponse = await fetch(config.posthogBatchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: config.posthogKey,
          batch,
        }),
      })

      if (!posthogResponse.ok) {
        return c.json({ error: 'Telemetry upstream rejected batch' }, 502)
      }
    } catch {
      return c.json({ error: 'Telemetry upstream unavailable' }, 502)
    }

    return c.json({ accepted: true }, 202)
  })
  .post('/events', zValidator('json', telemetryPayloadSchema), async (c) => {
    const status = getTelemetryStatus()
    if (!status.enabled) {
      return c.json({ accepted: false, enabled: false }, 202)
    }

    const body = c.req.valid('json')
    if (!isKnownDurabullTelemetryEvent(body.event)) {
      return c.json({ error: 'Unknown telemetry event' }, 400)
    }

    const sanitized = sanitizeTelemetryEvent(body.event, body.properties ?? {})
    const anonymousInstanceId =
      await telemetryInstallationRepository.getOrCreateAnonymousInstanceId()

    void forwardTelemetryEvent({
      anonymousInstanceId,
      event: sanitized.event,
      properties: sanitized.properties,
      sessionId: body.sessionId,
      timestamp: body.timestamp ?? new Date().toISOString(),
    })

    return c.json({ accepted: true }, 202)
  })

export default telemetryRoutes
