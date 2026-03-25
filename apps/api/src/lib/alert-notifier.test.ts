import { describe, expect, it } from 'bun:test'
import { buildAlertAppUrls } from './alert-notifier'

describe('buildAlertAppUrls', () => {
  it('builds app routes that match the current web router', () => {
    const urls = buildAlertAppUrls({
      appBaseUrl: 'https://app.durabull.io/',
      organizationSlug: 'acme-inc',
      connectionId: 'conn_123',
      queueName: 'email-send',
      alertRuleId: 'rule_456',
    })

    expect(urls.dashboardUrl).toBe(
      'https://app.durabull.io/acme-inc/c/conn_123/queues/email-send'
    )
    expect(urls.muteUrl).toBe(
      'https://app.durabull.io/acme-inc/c/conn_123/alerts?ruleId=rule_456'
    )
  })

  it('falls back to the app root if the organization slug is unavailable', () => {
    const urls = buildAlertAppUrls({
      appBaseUrl: 'https://app.durabull.io',
      organizationSlug: null,
      connectionId: 'conn_123',
      queueName: 'email-send',
      alertRuleId: 'rule_456',
    })

    expect(urls).toEqual({
      dashboardUrl: 'https://app.durabull.io',
      muteUrl: 'https://app.durabull.io',
    })
  })
})
