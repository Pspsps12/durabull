import {
  captureAnonymousServerEvent,
  getTelemetryStatusFromOptions,
  ingestTelemetryCollectBatch,
  isDurabullTelemetryCollectConfigured,
  TELEMETRY_COLLECT_SIGNATURE_HEADER,
  TELEMETRY_COLLECT_TIMESTAMP_HEADER,
  TELEMETRY_DISCLOSURE_URL,
  tryGetServerAnalyticsOptions,
  validateTelemetryPayload,
  verifyTelemetryCollectSignature,
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

const telemetryCollectRuntimeSchema = z.object({
  authless: z.boolean(),
  env_connections: z.boolean(),
  environment: z.string().min(1).max(64),
  persistence: z.string().min(1).max(64),
  stateless: z.boolean(),
})

const telemetryCollectPayloadSchema = z.object({
  sentAt: z.string().datetime().optional(),
  instanceId: z.string().min(16).max(128),
  runtime: telemetryCollectRuntimeSchema,
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
  .post('/collect', async (c) => {
    if (!isDurabullTelemetryCollectEnabled()) {
      return c.json({ error: 'Not Found' }, 404)
    }

    const options = tryGetServerAnalyticsOptions()
    const collectSigningSecret = options?.collectSigningSecret
    if (!collectSigningSecret) {
      return c.json({ error: 'Telemetry collection is not configured' }, 503)
    }

    const rawBody = await c.req.text()
    const verification = verifyTelemetryCollectSignature({
      secret: collectSigningSecret,
      timestampHeader: c.req.header(TELEMETRY_COLLECT_TIMESTAMP_HEADER),
      signatureHeader: c.req.header(TELEMETRY_COLLECT_SIGNATURE_HEADER),
      rawBody,
    })

    if (!verification.ok) {
      return c.json({ error: 'Unauthorized telemetry collect request' }, 401)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawBody)
    } catch {
      return c.json({ error: 'Invalid telemetry collect payload' }, 400)
    }

    const payloadResult = telemetryCollectPayloadSchema.safeParse(parsed)
    if (!payloadResult.success) {
      return c.json({ error: 'Invalid telemetry collect payload' }, 400)
    }

    const payload = payloadResult.data
    const result = await ingestTelemetryCollectBatch({
      instanceId: payload.instanceId,
      sentAt: payload.sentAt,
      events: payload.events,
      clientRuntime: payload.runtime,
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

    if (options.collectEnabled && !isDurabullTelemetryCollectConfigured(options)) {
      return c.json({ error: 'Telemetry collection is not configured' }, 503)
    }

    void (async () => {
      try {
        const anonymousInstanceId = await options.resolveAnonymousInstanceId()
        await captureAnonymousServerEvent({
          anonymousInstanceId,
          event: validated.event,
          properties: validated.properties,
          sessionId: body.sessionId,
          timestamp: body.timestamp ?? new Date().toISOString(),
        })
      } catch {
        // Telemetry must never affect the local product experience.
      }
    })()

    return c.json({ accepted: true }, 202)
  })

export default telemetryRoutes
