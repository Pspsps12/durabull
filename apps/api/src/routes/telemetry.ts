import {
  captureAnonymousServerEvent,
  getTelemetryStatusFromOptions,
  ingestTelemetryCollectBatch,
  TELEMETRY_DISCLOSURE_URL,
  tryGetServerAnalyticsOptions,
  validateTelemetryPayload,
} from '@durabull/analytics/server'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

const MAX_COLLECT_EVENTS_PER_BATCH = 50

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

export function getTelemetryStatus() {
  const options = tryGetServerAnalyticsOptions()
  if (!options) {
    return {
      enabled: false,
      collectionRequired: true as const,
      dedupeIdentifiedPosthogEvents: false,
      disclosureUrl: TELEMETRY_DISCLOSURE_URL,
    }
  }

  return getTelemetryStatusFromOptions(options)
}

export function isDurabullTelemetryCollectEnabled(): boolean {
  const options = tryGetServerAnalyticsOptions()
  return (options?.collectEnabled && options.enabled) ?? false
}

const telemetryRoutes = new Hono()
  .get('/status', (c) => c.json(getTelemetryStatus()))
  .post('/collect', zValidator('json', telemetryCollectPayloadSchema), async (c) => {
    if (!isDurabullTelemetryCollectEnabled()) {
      return c.json({ error: 'Not Found' }, 404)
    }

    const payload = c.req.valid('json')
    const result = await ingestTelemetryCollectBatch({
      instanceId: payload.instanceId,
      sentAt: payload.sentAt,
      events: payload.events,
    })

    if (!result.ok) {
      if (result.error === 'disabled' || result.error === 'not_configured') {
        return c.json({ error: 'Telemetry collection is not configured' }, 503)
      }
      if (result.error === 'unknown_event') {
        return c.json({ error: 'Unknown telemetry event' }, 400)
      }
      if (result.error === 'invalid_properties') {
        return c.json({ error: 'Invalid telemetry properties' }, 400)
      }
      if (result.error === 'upstream_unavailable') {
        return c.json({ error: 'Telemetry upstream unavailable' }, 503)
      }
      return c.json({ error: 'Telemetry upstream rejected batch' }, 502)
    }

    return c.json({ accepted: true }, 202)
  })
  .post('/events', zValidator('json', telemetryPayloadSchema), async (c) => {
    const status = getTelemetryStatus()
    if (!status.enabled) {
      return c.json({ accepted: false, enabled: false }, 202)
    }

    const body = c.req.valid('json')
    const options = tryGetServerAnalyticsOptions()
    if (!options) {
      return c.json({ error: 'Telemetry is not configured' }, 503)
    }

    const validated = validateTelemetryPayload(
      body.event,
      body.properties ?? {},
      options.getRuntimeContext()
    )
    if (!validated.ok) {
      if (validated.error === 'unknown_event') {
        return c.json({ error: 'Unknown telemetry event' }, 400)
      }
      return c.json({ error: 'Invalid telemetry properties' }, 400)
    }

    if (
      options.collectEnabled &&
      (!options.durabullTelemetryPosthogKey?.trim() || !options.hmacSecret?.trim())
    ) {
      return c.json({ error: 'Telemetry collection is not configured' }, 503)
    }

    const anonymousInstanceId = await options.resolveAnonymousInstanceId()

    void captureAnonymousServerEvent({
      anonymousInstanceId,
      event: validated.event,
      properties: validated.properties,
      sessionId: body.sessionId,
      timestamp: body.timestamp ?? new Date().toISOString(),
    }).catch(() => {
      // Telemetry must never affect the local product experience.
    })

    return c.json({ accepted: true }, 202)
  })

export default telemetryRoutes
