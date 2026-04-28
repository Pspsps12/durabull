import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { env } from '@durabull/env'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { hashTelemetryIdentifier, default as telemetryCollectorRoutes } from './telemetry-collector'

const INSTANCE_ID = '41111111-1111-4111-8111-111111111111'
const SESSION_ID = 'ephemeral-session'
const HMAC_SECRET = 'test-collector-hmac-secret'
const POSTHOG_KEY = 'phc_test_project_key'

const mutableEnv = env as {
  CI?: boolean
  DURABULL_TELEMETRY_COLLECTOR?: boolean
  DURABULL_TELEMETRY_HMAC_SECRET?: string
  DURABULL_TELEMETRY_POSTHOG_HOST?: string
  DURABULL_TELEMETRY_POSTHOG_KEY?: string
  NODE_ENV?: 'development' | 'test' | 'production'
}

const originalCi = mutableEnv.CI
const originalCollectorEnabled = mutableEnv.DURABULL_TELEMETRY_COLLECTOR
const originalHmacSecret = mutableEnv.DURABULL_TELEMETRY_HMAC_SECRET
const originalNodeEnv = mutableEnv.NODE_ENV
const originalPosthogHost = mutableEnv.DURABULL_TELEMETRY_POSTHOG_HOST
const originalPosthogKey = mutableEnv.DURABULL_TELEMETRY_POSTHOG_KEY
const originalFetch = globalThis.fetch

function createCollectorApp(options: { bodyLimit?: boolean } = {}) {
  const app = new Hono()

  if (options.bodyLimit) {
    app.use(
      '/v1/*',
      bodyLimit({
        maxSize: 128 * 1024,
        onError: (c) => c.json({ error: 'Payload Too Large' }, 413),
      })
    )
    return app.route('/v1', telemetryCollectorRoutes)
  }

  return app.route('/', telemetryCollectorRoutes)
}

function collectorPayload(properties: Record<string, unknown> = { success: true }) {
  return JSON.stringify({
    instanceId: INSTANCE_ID,
    sentAt: '2026-04-28T12:00:00.000Z',
    events: [
      {
        event: 'queue_paused',
        properties,
        sessionId: SESSION_ID,
        timestamp: '2026-04-28T12:00:01.000Z',
      },
    ],
  })
}

describe('telemetry collector routes', () => {
  beforeEach(() => {
    mutableEnv.CI = false
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.DURABULL_TELEMETRY_COLLECTOR = true
    mutableEnv.DURABULL_TELEMETRY_HMAC_SECRET = HMAC_SECRET
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_HOST = 'https://us.i.posthog.com'
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_KEY = POSTHOG_KEY
  })

  afterEach(() => {
    mutableEnv.CI = originalCi
    mutableEnv.NODE_ENV = originalNodeEnv
    mutableEnv.DURABULL_TELEMETRY_COLLECTOR = originalCollectorEnabled
    mutableEnv.DURABULL_TELEMETRY_HMAC_SECRET = originalHmacSecret
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_HOST = originalPosthogHost
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_KEY = originalPosthogKey
    globalThis.fetch = originalFetch
  })

  it('forwards canonical sanitized events to PostHog batch with HMAC identifiers', async () => {
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createCollectorApp()

    const response = await app.request('/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer should-not-forward',
        Cookie: 'session=should-not-forward',
        'X-Forwarded-For': '203.0.113.10',
        'User-Agent': 'should-not-forward',
      },
      body: collectorPayload({
        authless: true,
        environment: 'production',
        persistence: 'pglite',
        stateless: true,
        success: true,
      }),
    })

    expect(response.status).toBe(202)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://us.i.posthog.com/batch/')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })

    const body = JSON.parse(String(init.body)) as {
      api_key: string
      batch: Array<{
        event: string
        properties: Record<string, unknown>
        timestamp: string
      }>
    }
    const properties = body.batch[0].properties

    expect(body.api_key).toBe(POSTHOG_KEY)
    expect(body.batch[0].event).toBe('queue_paused')
    expect(body.batch[0].timestamp).toBe('2026-04-28T12:00:01.000Z')
    expect(properties.success).toBe(true)
    expect(properties.$process_person_profile).toBe(false)
    expect(properties.$geoip_disable).toBe(true)
    expect(properties.distinct_id).toBe(
      hashTelemetryIdentifier(`${INSTANCE_ID}:${SESSION_ID}`, HMAC_SECRET)
    )
    expect(properties.instance_key).toBe(hashTelemetryIdentifier(INSTANCE_ID, HMAC_SECRET))
    expect(properties.distinct_id).not.toContain(INSTANCE_ID)
    expect(properties.distinct_id).not.toContain(SESSION_ID)
    expect(properties.instance_key).not.toContain(INSTANCE_ID)
  })

  it('rejects forbidden or unknown properties before forwarding', async () => {
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createCollectorApp()

    const response = await app.request('/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: collectorPayload({ queue_name: 'billing-production', success: true }),
    })

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects unknown events before forwarding', async () => {
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createCollectorApp()

    const response = await app.request('/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceId: INSTANCE_ID,
        events: [
          {
            event: 'oss_queue_paused',
            properties: {},
            sessionId: SESSION_ID,
          },
        ],
      }),
    })

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails closed when collector secrets are missing', async () => {
    mutableEnv.DURABULL_TELEMETRY_HMAC_SECRET = undefined
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createCollectorApp()

    const response = await app.request('/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: collectorPayload(),
    })

    expect(response.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects oversized public collector payloads', async () => {
    const app = createCollectorApp({ bodyLimit: true })
    const body = JSON.stringify({
      instanceId: INSTANCE_ID,
      events: [
        {
          event: 'queue_paused',
          properties: { action: 'x'.repeat(129 * 1024) },
          sessionId: SESSION_ID,
        },
      ],
    })

    const response = await app.request('/v1/batch', {
      method: 'POST',
      headers: { 'Content-Length': String(body.length), 'Content-Type': 'application/json' },
      body,
    })

    expect(response.status).toBe(413)
  })
})
