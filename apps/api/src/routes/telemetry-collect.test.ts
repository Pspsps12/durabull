import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { env } from '@durabull/env'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import {
  hashTelemetryIdentifier,
  resetServerAnalyticsForTests,
  signTelemetryCollectBody,
  TELEMETRY_COLLECT_SIGNATURE_HEADER,
  TELEMETRY_COLLECT_TIMESTAMP_HEADER,
} from '@durabull/analytics/server'
import {
  bootstrapServerAnalytics,
  resetCachedAnonymousInstanceIdForTests,
} from '../lib/configure-server-analytics'
import telemetryRoutes from './telemetry'

const INSTANCE_ID = '41111111-1111-4111-8111-111111111111'
const SESSION_ID = 'ephemeral-session'
const HMAC_SECRET = 'test-telemetry-collect-hmac-secret'
const COLLECT_SECRET = 'test-telemetry-collect-signing-secret'
const POSTHOG_KEY = 'phc_test_project_key'

const DEFAULT_RUNTIME = {
  authless: false,
  env_connections: false,
  environment: 'production',
  persistence: 'postgres',
  stateless: false,
} as const

const mutableEnv = env as {
  APP_BASE_URL?: string
  BETTER_AUTH_SECRET?: string
  CI?: boolean
  DURABULL_CLOUD?: boolean
  DURABULL_TELEMETRY_COLLECT_SECRET?: string
  DURABULL_TELEMETRY_HMAC_SECRET?: string
  DURABULL_TELEMETRY_POSTHOG_HOST?: string
  DURABULL_TELEMETRY_POSTHOG_KEY?: string
  NODE_ENV?: 'development' | 'test' | 'production'
  POSTHOG_KEY?: string
}

const originalAppBaseUrl = mutableEnv.APP_BASE_URL
const originalBetterAuthSecret = mutableEnv.BETTER_AUTH_SECRET
const originalCi = mutableEnv.CI
const originalCollectSecret = mutableEnv.DURABULL_TELEMETRY_COLLECT_SECRET
const originalDurabullCloud = mutableEnv.DURABULL_CLOUD
const originalHmacSecret = mutableEnv.DURABULL_TELEMETRY_HMAC_SECRET
const originalNodeEnv = mutableEnv.NODE_ENV
const originalPosthogHost = mutableEnv.DURABULL_TELEMETRY_POSTHOG_HOST
const originalPosthogKey = mutableEnv.DURABULL_TELEMETRY_POSTHOG_KEY
const originalPublicPosthogKey = mutableEnv.POSTHOG_KEY
const originalFetch = globalThis.fetch

function createTelemetryRouteApp(options: { bodyLimit?: boolean } = {}) {
  const app = new Hono()

  if (options.bodyLimit) {
    app.use(
      '/api/telemetry/collect',
      bodyLimit({
        maxSize: 128 * 1024,
        onError: (c) => c.json({ error: 'Payload Too Large' }, 413),
      })
    )
    return app.route('/api/telemetry', telemetryRoutes)
  }

  return app.route('/', telemetryRoutes)
}

function collectPayload(
  properties: Record<string, unknown> = { success: true },
  runtime: Record<string, unknown> = DEFAULT_RUNTIME
) {
  return JSON.stringify({
    instanceId: INSTANCE_ID,
    sentAt: '2026-04-28T12:00:00.000Z',
    runtime,
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

function signedCollectRequest(
  body: string,
  secret: string = COLLECT_SECRET,
  timestampSec: number = Math.floor(Date.now() / 1000)
) {
  const { signature, timestamp } = signTelemetryCollectBody(secret, timestampSec, body)
  return {
    method: 'POST' as const,
    headers: {
      'Content-Type': 'application/json',
      [TELEMETRY_COLLECT_TIMESTAMP_HEADER]: timestamp,
      [TELEMETRY_COLLECT_SIGNATURE_HEADER]: signature,
    },
    body,
  }
}

async function postCollect(
  app: ReturnType<typeof createTelemetryRouteApp>,
  body: string,
  extraHeaders: Record<string, string> = {}
) {
  const signed = signedCollectRequest(body)
  return app.request('/collect', {
    ...signed,
    headers: { ...signed.headers, ...extraHeaders },
  })
}

describe('telemetry collect route', () => {
  beforeEach(() => {
    mutableEnv.APP_BASE_URL = 'https://app.durabull.io'
    mutableEnv.BETTER_AUTH_SECRET = undefined
    mutableEnv.CI = false
    mutableEnv.DURABULL_CLOUD = true
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.POSTHOG_KEY = undefined
    mutableEnv.DURABULL_TELEMETRY_HMAC_SECRET = HMAC_SECRET
    mutableEnv.DURABULL_TELEMETRY_COLLECT_SECRET = COLLECT_SECRET
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_HOST = 'https://us.i.posthog.com'
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_KEY = POSTHOG_KEY
    bootstrapServerAnalytics()
  })

  afterEach(() => {
    resetServerAnalyticsForTests()
    resetCachedAnonymousInstanceIdForTests()
    mutableEnv.APP_BASE_URL = originalAppBaseUrl
    mutableEnv.BETTER_AUTH_SECRET = originalBetterAuthSecret
    mutableEnv.CI = originalCi
    mutableEnv.DURABULL_CLOUD = originalDurabullCloud
    mutableEnv.NODE_ENV = originalNodeEnv
    mutableEnv.POSTHOG_KEY = originalPublicPosthogKey
    mutableEnv.DURABULL_TELEMETRY_HMAC_SECRET = originalHmacSecret
    mutableEnv.DURABULL_TELEMETRY_COLLECT_SECRET = originalCollectSecret
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_HOST = originalPosthogHost
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_KEY = originalPosthogKey
    globalThis.fetch = originalFetch
  })

  it('can use the existing cloud API PostHog and auth secrets without extra telemetry setup', async () => {
    mutableEnv.BETTER_AUTH_SECRET = HMAC_SECRET
    mutableEnv.POSTHOG_KEY = POSTHOG_KEY
    mutableEnv.DURABULL_TELEMETRY_HMAC_SECRET = undefined
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_KEY = undefined
    bootstrapServerAnalytics()
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()

    const response = await postCollect(app, collectPayload())

    expect(response.status).toBe(202)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as {
      api_key: string
      batch: Array<{ properties: Record<string, unknown> }>
    }

    expect(body.api_key).toBe(POSTHOG_KEY)
    expect(body.batch[0].properties.instance_key).toBe(
      hashTelemetryIdentifier(INSTANCE_ID, HMAC_SECRET)
    )
  })

  it('forwards canonical sanitized events to PostHog batch with HMAC identifiers', async () => {
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()

    const response = await postCollect(
      app,
      collectPayload({
        authless: true,
        environment: 'production',
        persistence: 'pglite',
        stateless: true,
        success: true,
      }),
      {
        Authorization: 'Bearer should-not-forward',
        Cookie: 'session=should-not-forward',
        'X-Forwarded-For': '203.0.113.10',
        'User-Agent': 'should-not-forward',
      }
    )

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
    expect(properties.authless).toBe(false)
    expect(properties.environment).toBe('production')
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

  it('uses authenticated client runtime instead of cloud server runtime', async () => {
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()

    const response = await postCollect(
      app,
      collectPayload(
        {
          authless: false,
          environment: 'development',
          persistence: 'postgres',
          stateless: false,
          success: true,
        },
        {
          authless: true,
          env_connections: false,
          environment: 'production',
          persistence: 'pglite',
          stateless: true,
        }
      )
    )

    expect(response.status).toBe(202)

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as {
      batch: Array<{ properties: Record<string, unknown> }>
    }
    const properties = body.batch[0].properties

    expect(properties.authless).toBe(true)
    expect(properties.environment).toBe('production')
    expect(properties.persistence).toBe('pglite')
    expect(properties.stateless).toBe(true)
  })

  it('rejects unsigned collect requests', async () => {
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()

    const response = await app.request('/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: collectPayload(),
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized telemetry collect request' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects collect requests with invalid signatures', async () => {
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()
    const body = collectPayload()
    const signed = signedCollectRequest(body, 'wrong-secret')

    const response = await app.request('/collect', signed)

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 502 when PostHog rejects the batch', async () => {
    const fetchMock = mock(async () => new Response(null, { status: 400 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()

    const response = await postCollect(app, collectPayload())

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'Telemetry upstream rejected batch' })
  })

  it('returns 502 when PostHog responds with a redirect', async () => {
    const fetchMock = mock(
      async () =>
        new Response(null, {
          status: 302,
          headers: { Location: 'https://evil.example.com/batch/' },
        })
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()

    const response = await postCollect(app, collectPayload())

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'Telemetry upstream rejected batch' })
  })

  it('returns 503 when PostHog is unreachable', async () => {
    const fetchMock = mock(async () => {
      throw new Error('PostHog unavailable')
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()

    const response = await postCollect(app, collectPayload())

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Telemetry upstream unavailable' })
  })

  it('returns not found when product telemetry is disabled', async () => {
    mutableEnv.NODE_ENV = 'development'
    bootstrapServerAnalytics()
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()

    const response = await postCollect(app, collectPayload())

    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects collect requests on non-Durabull API deployments', async () => {
    mutableEnv.APP_BASE_URL = 'https://self-hosted.example.com'
    mutableEnv.DURABULL_CLOUD = false
    bootstrapServerAnalytics()
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()

    const response = await postCollect(app, collectPayload())

    expect(response.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects forbidden or unknown properties before forwarding', async () => {
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()

    const response = await postCollect(
      app,
      collectPayload({ queue_name: 'billing-production', success: true })
    )

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects unknown events before forwarding', async () => {
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()

    const body = JSON.stringify({
      instanceId: INSTANCE_ID,
      runtime: DEFAULT_RUNTIME,
      events: [
        {
          event: 'oss_queue_paused',
          properties: {},
          sessionId: SESSION_ID,
        },
      ],
    })

    const response = await postCollect(app, body)

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails closed when collection secrets are missing', async () => {
    mutableEnv.BETTER_AUTH_SECRET = undefined
    mutableEnv.POSTHOG_KEY = undefined
    mutableEnv.DURABULL_TELEMETRY_HMAC_SECRET = undefined
    mutableEnv.DURABULL_TELEMETRY_COLLECT_SECRET = undefined
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_KEY = undefined
    bootstrapServerAnalytics()
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()

    const response = await postCollect(app, collectPayload())

    expect(response.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails closed when the configured PostHog batch host is invalid', async () => {
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_HOST = 'http://[::1'
    bootstrapServerAnalytics()
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()

    const response = await postCollect(app, collectPayload())

    expect(response.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails closed when the configured PostHog batch host is not HTTPS', async () => {
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_HOST = 'http://us.i.posthog.com'
    bootstrapServerAnalytics()
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()

    const response = await postCollect(app, collectPayload())

    expect(response.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails closed when the configured PostHog batch host is not allowlisted', async () => {
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_HOST = 'https://evil.example.com'
    bootstrapServerAnalytics()
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const app = createTelemetryRouteApp()

    const response = await postCollect(app, collectPayload())

    expect(response.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects oversized public collect payloads on the existing API route', async () => {
    const app = createTelemetryRouteApp({ bodyLimit: true })
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

    const response = await app.request('/api/telemetry/collect', {
      method: 'POST',
      headers: { 'Content-Length': String(body.length), 'Content-Type': 'application/json' },
      body,
    })

    expect(response.status).toBe(413)
  })
})
