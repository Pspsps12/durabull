import { describe, expect, it } from 'bun:test'
import {
  buildAlertWebhookPayload,
  serializeAlertWebhookPayload,
  WEBHOOK_MAX_FAILED_REASON_LENGTH,
} from './alert-webhook-payload'

describe('buildAlertWebhookPayload', () => {
  it('builds a versioned alert payload with links and sanitized context', () => {
    const payload = buildAlertWebhookPayload({
      eventType: 'alert.fired',
      eventId: 'event_123',
      deliveryId: 'delivery_456',
      occurredAt: new Date('2026-05-25T12:00:00.000Z'),
      organizationId: 'org_1',
      organizationSlug: 'acme',
      connection: {
        id: 'conn_1',
        name: 'Production Redis',
      } as never,
      ruleId: 'rule_1',
      ruleName: 'High failure rate',
      ruleType: 'failure_rate',
      queueName: 'email-send',
      summary: 'Failure rate exceeded threshold',
      context: {
        jobId: 'job_789',
        failedReason: 'SMTP timeout',
        attemptsMade: 3,
      },
      firedAt: new Date('2026-05-25T12:00:00.000Z'),
      dedupeKey: 'queue:email-send',
      appBaseUrl: 'https://app.durabull.io',
    })

    expect(payload.schemaVersion).toBe(1)
    expect(payload.event).toBe('alert.fired')
    expect(payload.links.job).toContain('/jobs/job_789')
    expect(payload.alert.context.failedReason).toBe('SMTP timeout')
    expect(payload.alert.dedupeKey).toBe('queue:email-send')
  })

  it('truncates long failedReason values in context', () => {
    const payload = buildAlertWebhookPayload({
      eventType: 'alert.test',
      eventId: 'event_test',
      deliveryId: 'delivery_test',
      occurredAt: new Date('2026-05-25T12:00:00.000Z'),
      organizationId: 'org_1',
      organizationSlug: null,
      connection: { id: 'conn_1', name: 'Redis' } as never,
      ruleId: 'rule_1',
      ruleName: 'Test rule',
      ruleType: 'job_failed',
      queueName: 'jobs',
      summary: 'Test summary',
      context: {
        failedReason: 'x'.repeat(WEBHOOK_MAX_FAILED_REASON_LENGTH + 50),
      },
      firedAt: new Date('2026-05-25T12:00:00.000Z'),
      appBaseUrl: 'https://app.durabull.io',
    })

    expect(payload.alert.context.failedReason).toHaveLength(WEBHOOK_MAX_FAILED_REASON_LENGTH)
    expect(String(payload.alert.context.failedReason).endsWith('...')).toBe(true)
  })
})

describe('serializeAlertWebhookPayload', () => {
  it('returns JSON within the configured max body size', () => {
    const payload = buildAlertWebhookPayload({
      eventType: 'alert.test',
      eventId: 'event_test',
      deliveryId: 'delivery_test',
      occurredAt: new Date('2026-05-25T12:00:00.000Z'),
      organizationId: 'org_1',
      organizationSlug: null,
      connection: { id: 'conn_1', name: 'Redis' } as never,
      ruleId: 'rule_1',
      ruleName: 'Test rule',
      ruleType: 'job_failed',
      queueName: 'jobs',
      summary: 'Test summary',
      context: {
        failedReason: 'x'.repeat(10_000),
      },
      firedAt: new Date('2026-05-25T12:00:00.000Z'),
      appBaseUrl: 'https://app.durabull.io',
    })

    const body = serializeAlertWebhookPayload(payload)
    expect(Buffer.byteLength(body, 'utf8')).toBeLessThanOrEqual(32_768)
  })
})
