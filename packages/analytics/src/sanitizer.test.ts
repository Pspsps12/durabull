import { describe, expect, it } from 'bun:test'
import { AnalyticsEvents } from './events'
import {
  getForbiddenTelemetryPropertyKeys,
  isKnownDurabullTelemetryEvent,
  normalizeRoutePath,
  PAGEVIEW_EVENT,
  sanitizeTelemetryEvent,
} from './sanitizer'

describe('telemetry sanitizer', () => {
  it('preserves every canonical analytics event name', () => {
    for (const eventName of Object.values(AnalyticsEvents)) {
      expect(sanitizeTelemetryEvent(eventName).event).toBe(eventName)
      expect(isKnownDurabullTelemetryEvent(eventName)).toBe(true)
    }
  })

  it('preserves pageview as the canonical PostHog pageview event', () => {
    expect(sanitizeTelemetryEvent(PAGEVIEW_EVENT, { path: '/settings' })).toMatchObject({
      event: PAGEVIEW_EVENT,
      properties: { path: '/settings' },
    })
  })

  it('strips direct identifiers and content-bearing fields', () => {
    const result = sanitizeTelemetryEvent(AnalyticsEvents.JOB_VIEWED, {
      connection_id: '41111111-1111-4111-8111-111111111111',
      connection_name: 'Production Redis',
      email: 'user@example.com',
      error_message: 'Redis password authentication failed',
      job_id: 'job-123',
      job_ids: ['job-123'],
      organization_id: 'org-123',
      organization_name: 'Example Corp',
      organization_slug: 'example',
      queue_name: 'billing:production',
      redis_key: 'bull:billing:wait',
      scheduler_id: 'scheduler-123',
      search_pattern: 'customer:*',
      user_id: 'user-123',
      userId: 'user-123',
    })

    expect(result.properties).toEqual({ error_category: 'redis' })
    for (const key of getForbiddenTelemetryPropertyKeys()) {
      expect(result.properties).not.toHaveProperty(key)
    }
  })

  it('keeps allowlisted booleans, enums, and numeric aggregates', () => {
    const result = sanitizeTelemetryEvent(AnalyticsEvents.QUEUE_CLEANED, {
      action: 'clean',
      api_build_id: 'server-build-123',
      api_version: '1.4.0',
      app_build_id: 'client-build-123',
      app_version: '1.3.0',
      client_build_id: 'client-build-123',
      client_version: '1.3.0',
      connection_environment: 'production',
      duration_bucket: '1s-5s',
      job_count: 42,
      queue_status: 'completed',
      release_channel: 'stable',
      server_build_id: 'server-build-123',
      server_version: '1.4.0',
      success: true,
      update_reason: 'build_mismatch',
      visible: false,
    })

    expect(result.properties).toEqual({
      action: 'clean',
      api_build_id: 'server-build-123',
      api_version: '1.4.0',
      app_build_id: 'client-build-123',
      app_version: '1.3.0',
      client_build_id: 'client-build-123',
      client_version: '1.3.0',
      connection_environment: 'production',
      duration_bucket: '1s-5s',
      job_count: 42,
      queue_status: 'completed',
      release_channel: 'stable',
      server_build_id: 'server-build-123',
      server_version: '1.4.0',
      success: true,
      update_reason: 'build_mismatch',
      visible: false,
    })
  })

  it('normalizes raw app paths to route templates', () => {
    expect(
      normalizeRoutePath('/acme/c/41111111-1111-4111-8111-111111111111/queues/billing/jobs/abc')
    ).toBe('/$orgSlug/c/$connectionId/queues/$queueName/jobs/$jobId')
    expect(normalizeRoutePath('/acme/c/conn-1/alerts/new')).toBe(
      '/$orgSlug/c/$connectionId/alerts/new'
    )
    expect(normalizeRoutePath('/invite/invitation-123')).toBe('/invite/$invitationId')
  })
})
