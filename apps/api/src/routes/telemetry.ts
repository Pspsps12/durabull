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

const TELEMETRY_COLLECTOR_ENDPOINT = 'https://events.durabull.io/v1/batch'
export const TELEMETRY_DISCLOSURE_URL = 'https://durabull.io/privacy'

const telemetryPayloadSchema = z.object({
  event: z.string().min(1).max(128),
  properties: z.record(z.unknown()).optional(),
  sessionId: z.string().min(1).max(128),
  timestamp: z.string().datetime().optional(),
})

export function isDurabullTelemetryEnabled(): boolean {
  if (env.NODE_ENV === 'test' || env.CI === true) return false
  return env.NODE_ENV === 'production'
}

export function getTelemetryStatus() {
  return {
    enabled: isDurabullTelemetryEnabled(),
    collectionRequired: true as const,
    disclosureUrl: TELEMETRY_DISCLOSURE_URL,
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
    await fetch(TELEMETRY_COLLECTOR_ENDPOINT, {
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
