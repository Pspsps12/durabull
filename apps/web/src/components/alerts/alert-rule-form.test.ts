import { describe, expect, it } from 'vitest'
import {
  createAlertRuleDraft,
  serializeAlertRuleDraft,
  validateAlertRuleDraft,
} from '@/components/alerts/alert-rule-form'

describe('alert rule form helpers', () => {
  it('creates a stable default draft for new rules', () => {
    const draft = createAlertRuleDraft()

    expect(draft.type).toBe('failure_threshold')
    expect(draft.cooldownMinutes).toBe('30')
    expect(draft.queueFilterMode).toBe('include')
    expect(draft.selectedQueueNames).toEqual([])
    expect(draft.notificationRoutes).toHaveLength(1)
  })

  it('serializes include-mode draft into a single rule with filterQueueNames', () => {
    const payloads = serializeAlertRuleDraft({
      ...createAlertRuleDraft(),
      name: 'Quality regression',
      queueFilterMode: 'include',
      selectedQueueNames: ['email-send'],
      type: 'failure_rate',
      failureRatePercent: '12.5',
      failureRateWindowMinutes: '30',
      failureRateMinSample: '250',
      notificationRoutes: [
        { id: 'route-1', type: 'email', target: 'ops@example.com' },
        { id: 'route-2', type: 'email', target: 'ops@example.com' },
        { id: 'route-3', type: 'email', target: 'platform@example.com' },
      ],
    })

    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toEqual({
      name: 'Quality regression',
      queueName: null,
      queueFilterMode: 'include',
      filterQueueNames: ['email-send'],
      type: 'failure_rate',
      enabled: true,
      cooldownMinutes: 30,
      notificationChannels: [
        { type: 'email', target: 'ops@example.com' },
        { type: 'email', target: 'platform@example.com' },
      ],
      config: {
        rate: 0.125,
        windowMinutes: 30,
        minSample: 250,
      },
    })
  })

  it('stores multiple included queues in a single rule', () => {
    const payloads = serializeAlertRuleDraft({
      ...createAlertRuleDraft(),
      name: 'Delivery spike',
      queueFilterMode: 'include',
      selectedQueueNames: ['email-send', 'invoice-send'],
    })

    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toMatchObject({
      name: 'Delivery spike',
      queueFilterMode: 'include',
      filterQueueNames: ['email-send', 'invoice-send'],
    })
  })

  it('serializes exclude-mode draft with excluded queue names', () => {
    const payloads = serializeAlertRuleDraft({
      ...createAlertRuleDraft(),
      name: 'Platform-wide spike',
      queueFilterMode: 'exclude',
      selectedQueueNames: ['debug-queue', 'test-queue'],
    })

    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toMatchObject({
      name: 'Platform-wide spike',
      queueName: null,
      queueFilterMode: 'exclude',
      filterQueueNames: ['debug-queue', 'test-queue'],
    })
  })

  it('creates an all-queues rule when exclude mode has no exclusions', () => {
    const payloads = serializeAlertRuleDraft({
      ...createAlertRuleDraft(),
      name: 'Catch all failures',
      queueFilterMode: 'exclude',
      selectedQueueNames: [],
    })

    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toMatchObject({
      queueName: null,
      queueFilterMode: 'exclude',
      filterQueueNames: [],
    })
  })

  it('rejects include mode with no queues selected', () => {
    const error = validateAlertRuleDraft({
      ...createAlertRuleDraft(),
      name: 'Empty include',
      queueFilterMode: 'include',
      selectedQueueNames: [],
    })

    expect(error).toContain('Choose at least one queue')
  })

  it('allows exclude mode with no queues selected', () => {
    const error = validateAlertRuleDraft({
      ...createAlertRuleDraft(),
      name: 'All queues via exclude',
      queueFilterMode: 'exclude',
      selectedQueueNames: [],
    })

    expect(error).toBeNull()
  })

  it('rejects malformed notification recipients', () => {
    const error = validateAlertRuleDraft({
      ...createAlertRuleDraft(),
      name: 'Broken recipients',
      queueFilterMode: 'exclude',
      notificationRoutes: [{ id: 'route-1', type: 'email', target: 'not-an-email' }],
    })

    expect(error).toContain('Invalid notification email')
  })

  it('rejects out-of-range failure threshold windows', () => {
    const error = validateAlertRuleDraft({
      ...createAlertRuleDraft(),
      name: 'Failure spike',
      queueFilterMode: 'exclude',
      type: 'failure_threshold',
      failureThresholdCount: '20',
      failureThresholdWindowMinutes: '0',
    })

    expect(error).toBe('Failure threshold window must be between 1 and 1440 minutes.')
  })

  it('hydrates draft from an existing exclude-mode rule', () => {
    const draft = createAlertRuleDraft({
      id: 'rule-1',
      organizationId: 'org-1',
      connectionId: 'conn-1',
      queueName: null,
      queueFilterMode: 'exclude',
      filterQueueNames: ['debug-queue'],
      name: 'Platform alert',
      type: 'failure_threshold',
      config: { count: 50, windowMinutes: 10 },
      enabled: true,
      notificationChannels: [{ type: 'email', target: 'ops@example.com' }],
      cooldownMinutes: 60,
    })

    expect(draft.queueFilterMode).toBe('exclude')
    expect(draft.selectedQueueNames).toEqual(['debug-queue'])
  })

  it('hydrates draft from an existing include-mode rule', () => {
    const draft = createAlertRuleDraft({
      id: 'rule-2',
      organizationId: 'org-1',
      connectionId: 'conn-1',
      queueName: null,
      queueFilterMode: 'include',
      filterQueueNames: ['email-send', 'sms-send'],
      name: 'Delivery alerts',
      type: 'failure_rate',
      config: { rate: 0.1, windowMinutes: 15, minSample: 100 },
      enabled: true,
      notificationChannels: [],
      cooldownMinutes: 30,
    })

    expect(draft.queueFilterMode).toBe('include')
    expect(draft.selectedQueueNames).toEqual(['email-send', 'sms-send'])
  })

  it('hydrates draft from a legacy rule with only queueName', () => {
    const draft = createAlertRuleDraft({
      id: 'rule-3',
      organizationId: 'org-1',
      connectionId: 'conn-1',
      queueName: 'legacy-queue',
      queueFilterMode: null,
      filterQueueNames: [],
      name: 'Legacy alert',
      type: 'queue_stalled',
      config: { stalledMinutes: 10 },
      enabled: true,
      notificationChannels: [],
      cooldownMinutes: 30,
    })

    expect(draft.queueFilterMode).toBe('include')
    expect(draft.selectedQueueNames).toEqual(['legacy-queue'])
  })
})
