import { createHmac } from 'node:crypto'
import {
  isKnownDurabullTelemetryEvent,
  sanitizeTelemetryEvent,
} from '@durabull/analytics/sanitizer'
import { env } from '@durabull/env'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

const DEFAULT_POSTHOG_BATCH_HOST = 'https://us.i.posthog.com'
const MAX_COLLECTOR_EVENTS_PER_BATCH = 50

const collectorEventSchema = z.object({
  event: z.string().min(1).max(128),
  properties: z.record(z.unknown()).default({}),
  sessionId: z.string().min(1).max(128),
  timestamp: z.string().datetime().optional(),
})

const collectorPayloadSchema = z.object({
  sentAt: z.string().datetime().optional(),
  instanceId: z.string().min(16).max(128),
  events: z.array(collectorEventSchema).min(1).max(MAX_COLLECTOR_EVENTS_PER_BATCH),
})

interface TelemetryCollectorConfig {
  hmacSecret: string
  posthogBatchUrl: string
  posthogKey: string
}

export function isDurabullTelemetryCollectorEnabled(): boolean {
  return env.DURABULL_TELEMETRY_COLLECTOR === true
}

export function hashTelemetryIdentifier(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

function getPosthogBatchUrl(): string {
  const rawHost = env.DURABULL_TELEMETRY_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_BATCH_HOST
  const hostWithProtocol = /^https?:\/\//i.test(rawHost) ? rawHost : `https://${rawHost}`
  const parsed = new URL(hostWithProtocol)
  const basePath = parsed.pathname.replace(/\/$/, '')
  const batchPath = basePath.endsWith('/batch') ? basePath : `${basePath}/batch`

  return `${parsed.origin}${batchPath}/`
}

function getCollectorConfig(): TelemetryCollectorConfig | null {
  const posthogKey = env.DURABULL_TELEMETRY_POSTHOG_KEY?.trim()
  const hmacSecret = env.DURABULL_TELEMETRY_HMAC_SECRET?.trim()

  if (!posthogKey || !hmacSecret) return null

  return {
    hmacSecret,
    posthogBatchUrl: getPosthogBatchUrl(),
    posthogKey,
  }
}

const telemetryCollectorRoutes = new Hono().post(
  '/batch',
  zValidator('json', collectorPayloadSchema),
  async (c) => {
    const config = getCollectorConfig()
    if (!config) {
      return c.json({ error: 'Telemetry collector is not configured' }, 503)
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
  }
)

export default telemetryCollectorRoutes
