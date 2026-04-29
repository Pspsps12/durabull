import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { AnalyticsEvents } from './events'

const captureMock = mock(() => {})
const groupMock = mock(() => {})
const identifyMock = mock(() => {})
const initMock = mock(() => {})
const resetMock = mock(() => {})

mock.module('posthog-js', () => ({
  default: {
    capture: captureMock,
    group: groupMock,
    identify: identifyMock,
    init: initMock,
    reset: resetMock,
  },
}))

const analytics = await import('./client')

const originalCrypto = globalThis.crypto
const originalFetch = globalThis.fetch
const originalNavigator = globalThis.navigator
const originalWindow = globalThis.window

function setGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
  })
}

function lastFetchBody(fetchMock: ReturnType<typeof mock>) {
  const [, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit]
  return JSON.parse(String(init.body)) as {
    event: string
    properties: Record<string, unknown>
    sessionId: string
  }
}

describe('analytics client telemetry fanout', () => {
  let fetchMock: ReturnType<typeof mock>

  beforeEach(() => {
    captureMock.mockClear()
    groupMock.mockClear()
    identifyMock.mockClear()
    initMock.mockClear()
    resetMock.mockClear()

    fetchMock = mock(async () => new Response(null, { status: 202 }))
    setGlobal('window', {})
    setGlobal('navigator', {})
    setGlobal('fetch', fetchMock)
    setGlobal('crypto', {
      randomUUID: () => 'ephemeral-session-id',
    })

    analytics.configureDurabullTelemetry({
      enabled: true,
      collectionRequired: true,
      endpoint: '/api/telemetry/events',
      runtimeContext: {
        environment: 'production',
        runtime: 'web',
      },
    })
  })

  afterEach(() => {
    analytics.resetIdentity()
    analytics.configureDurabullTelemetry({
      enabled: false,
      collectionRequired: true,
    })
    setGlobal('crypto', originalCrypto)
    setGlobal('fetch', originalFetch)
    setGlobal('navigator', originalNavigator)
    setGlobal('window', originalWindow)
  })

  it('fans out one canonical event name to Durabull telemetry and BYO PostHog', async () => {
    analytics.trackEvent(AnalyticsEvents.QUEUE_PAUSED, {
      queue_name: 'billing-production',
      success: true,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const durabullEvent = lastFetchBody(fetchMock)
    expect(durabullEvent.event).toBe(AnalyticsEvents.QUEUE_PAUSED)
    expect(durabullEvent.properties).toEqual({
      environment: 'production',
      runtime: 'web',
      success: true,
    })
    expect(durabullEvent.properties).not.toHaveProperty('queue_name')

    expect(captureMock).toHaveBeenCalledWith(AnalyticsEvents.QUEUE_PAUSED, {
      queue_name: 'billing-production',
      success: true,
    })
  })

  it('keeps Durabull pageviews canonical while preserving raw PostHog pageview properties', () => {
    const rawUrl = 'https://app.example.com/acme/c/conn-1/queues/billing/jobs/job-1?token=secret'

    analytics.trackPageView(rawUrl, {
      path: '/acme/c/conn-1/queues/billing/jobs/job-1',
    })

    const durabullEvent = lastFetchBody(fetchMock)
    expect(durabullEvent.event).toBe('$pageview')
    expect(durabullEvent.properties.path).toBe(
      '/$orgSlug/c/$connectionId/queues/$queueName/jobs/$jobId'
    )
    expect(captureMock).toHaveBeenCalledWith('$pageview', {
      $current_url: rawUrl,
      path: '/acme/c/conn-1/queues/billing/jobs/job-1',
    })
  })

  it('does not include user identifiers in the Durabull-owned user_created event', () => {
    analytics.trackUserCreated({
      email: 'person@example.com',
      id: 'user-123',
      name: 'Person Example',
    })

    expect(identifyMock).toHaveBeenCalledTimes(1)
    const durabullEvent = lastFetchBody(fetchMock)
    expect(durabullEvent.event).toBe(AnalyticsEvents.USER_CREATED)
    expect(durabullEvent.properties).toEqual({
      environment: 'production',
      runtime: 'web',
    })
  })

  it('dedupes Durabull telemetry after PostHog identity is known when configured', () => {
    analytics.configureDurabullTelemetry({
      enabled: true,
      collectionRequired: true,
      dedupeIdentifiedPosthogEvents: true,
      endpoint: '/api/telemetry/events',
    })

    analytics.identifyUser({
      email: 'person@example.com',
      id: 'user-123',
      name: 'Person Example',
    })
    analytics.trackEvent(AnalyticsEvents.QUEUE_PAUSED, { queue_name: 'billing-production' })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(captureMock).toHaveBeenCalledWith(AnalyticsEvents.QUEUE_PAUSED, {
      queue_name: 'billing-production',
    })
  })

  it('keeps full PostHog default capture settings available when analytics initializes', () => {
    analytics.initAnalytics('phc_project', '/ingest', {
      debug: true,
      uiHost: 'https://us.posthog.com',
    })

    expect(initMock).toHaveBeenCalledWith(
      'phc_project',
      expect.not.objectContaining({
        autocapture: false,
        capture_dead_clicks: false,
        capture_pageleave: false,
        capture_pageview: false,
        disable_session_recording: true,
        enable_heatmaps: false,
      })
    )
  })
})
