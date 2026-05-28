import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { AnalyticsEvents } from '../events'
import {
  captureIdentifiedServerEvent,
  captureMcpAnalyticsServerEvent,
  ingestTelemetryCollectBatch,
} from './capture'
import {
  configureServerAnalytics,
  resetServerAnalyticsForTests,
  type ServerAnalyticsOptions,
} from './config'
import { hashIdentifiedOrganizationDistinctId } from './identifiers'

const HMAC_SECRET = 'test-hmac-secret'

const baseRuntime = {
  authless: false,
  env_connections: false,
  environment: 'production',
  persistence: 'postgres',
  stateless: false,
} as const

function configure(overrides: Partial<ServerAnalyticsOptions> = {}): void {
  configureServerAnalytics({
    enabled: true,
    collectEnabled: true,
    dedupeIdentifiedPosthogEvents: false,
    disclosureUrl: 'https://durabull.io/privacy',
    hmacSecret: HMAC_SECRET,
    durabullTelemetryPosthogKey: 'phc_durabull',
    durabullTelemetryPosthogHost: 'https://us.i.posthog.com',
    appPosthogKey: 'phc_app',
    appPosthogHost: 'https://us.i.posthog.com',
    cloudCollectUrl: 'https://app.durabull.io/api/telemetry/collect',
    getRuntimeContext: () => ({ ...baseRuntime }),
    resolveAnonymousInstanceId: async () => 'anon-instance-id',
    ...overrides,
  })
}

const originalFetch = globalThis.fetch

function captureFetchBodies(): { bodies: unknown[]; restore: () => void } {
  const bodies: unknown[] = []
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body ?? '{}')))
    return new Response(null, { status: 200 })
  }) as typeof fetch
  return {
    bodies,
    restore: () => {
      globalThis.fetch = originalFetch
    },
  }
}

describe('captureIdentifiedServerEvent', () => {
  beforeEach(() => {
    resetServerAnalyticsForTests()
    configure()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    resetServerAnalyticsForTests()
  })

  it('hashes the organization group exactly once for $groups', async () => {
    const { bodies, restore } = captureFetchBodies()

    await captureIdentifiedServerEvent({
      event: AnalyticsEvents.MCP_TOOL_CALLED,
      properties: { tool_name: 'list_jobs', response_class: 'success' },
      distinctId: 'already-hashed-user',
      organizationId: 'org-1',
    })

    restore()

    expect(bodies).toHaveLength(1)
    const batch = (bodies[0] as { batch: Array<{ properties: Record<string, unknown> }> }).batch
    expect(batch).toHaveLength(1)
    expect(batch[0].properties.$groups).toEqual({
      organization: hashIdentifiedOrganizationDistinctId('org-1', HMAC_SECRET),
    })
  })
})

describe('ingestTelemetryCollectBatch timestamp clamping', () => {
  beforeEach(() => {
    resetServerAnalyticsForTests()
    configure()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    resetServerAnalyticsForTests()
  })

  it('clamps client timestamps far outside the accepted skew window', async () => {
    const { bodies, restore } = captureFetchBodies()
    const before = Date.now()

    const result = await ingestTelemetryCollectBatch({
      instanceId: 'instance-1234567890',
      events: [
        {
          event: AnalyticsEvents.MCP_TOOL_CALLED,
          properties: { tool_name: 'list_jobs', response_class: 'success' },
          sessionId: 'session-1',
          timestamp: '2000-01-01T00:00:00.000Z',
        },
      ],
    })

    restore()
    const after = Date.now()

    expect(result.ok).toBe(true)
    const batch = (bodies[0] as { batch: Array<{ timestamp: string }> }).batch
    const stamped = new Date(batch[0].timestamp).getTime()
    expect(stamped).toBeGreaterThanOrEqual(before)
    expect(stamped).toBeLessThanOrEqual(after)
  })

  it('preserves recent client timestamps within the skew window', async () => {
    const { bodies, restore } = captureFetchBodies()
    const recent = new Date(Date.now() - 60_000).toISOString()

    await ingestTelemetryCollectBatch({
      instanceId: 'instance-1234567890',
      events: [
        {
          event: AnalyticsEvents.MCP_TOOL_CALLED,
          properties: { tool_name: 'list_jobs', response_class: 'success' },
          sessionId: 'session-1',
          timestamp: recent,
        },
      ],
    })

    restore()

    const batch = (bodies[0] as { batch: Array<{ timestamp: string }> }).batch
    expect(batch[0].timestamp).toBe(recent)
  })
})

describe('captureMcpAnalyticsServerEvent coalescing', () => {
  beforeEach(() => {
    resetServerAnalyticsForTests()
    configure()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    resetServerAnalyticsForTests()
  })

  it('coalesces anonymous and identified captures into one batch request when targets match', async () => {
    resetServerAnalyticsForTests()
    configure({ appPosthogKey: 'phc_durabull' })
    const { bodies, restore } = captureFetchBodies()

    await captureMcpAnalyticsServerEvent({
      event: AnalyticsEvents.MCP_TOOL_CALLED,
      properties: { tool_name: 'list_jobs', response_class: 'success' },
      includeAnonymous: true,
      anonymousInstanceId: 'anon-instance-id',
      sessionId: 'session-1',
      identifiedDistinctId: 'hashed-user-1',
      organizationId: 'org-1',
    })

    restore()

    expect(bodies).toHaveLength(1)
    const batch = (bodies[0] as { batch: Array<{ properties: Record<string, unknown> }> }).batch
    expect(batch).toHaveLength(2)
    expect(batch.some((event) => event.properties.$process_person_profile === false)).toBe(true)
    expect(batch.some((event) => event.properties.$process_person_profile === true)).toBe(true)
  })

  it('sends separate batch requests when identified telemetry uses a different project key', async () => {
    resetServerAnalyticsForTests()
    configure({ appPosthogKey: 'phc_different_app_project' })
    const { bodies, restore } = captureFetchBodies()

    await captureMcpAnalyticsServerEvent({
      event: AnalyticsEvents.MCP_TOOL_CALLED,
      properties: { tool_name: 'list_jobs', response_class: 'success' },
      includeAnonymous: true,
      anonymousInstanceId: 'anon-instance-id',
      sessionId: 'session-1',
      identifiedDistinctId: 'hashed-user-1',
      organizationId: 'org-1',
    })

    restore()

    expect(bodies).toHaveLength(2)
    expect(
      bodies.every((body) => (body as { batch: Array<unknown> }).batch.length === 1)
    ).toBe(true)
  })
})
