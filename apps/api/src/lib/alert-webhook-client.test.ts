import { describe, expect, it } from 'bun:test'
import {
  classifyWebhookHttpStatus,
  deliverWebhook,
  isWebhookDeliveryExpired,
  signWebhookPayload,
  WEBHOOK_DELIVERY_MAX_AGE_MS,
} from './alert-webhook-client'
import { assertAllowedWebhookUrl, getWebhookDeliveryTarget } from './alert-webhook-url'

describe('signWebhookPayload', () => {
  it('creates a sha256 signature over timestamp and body', () => {
    const signed = signWebhookPayload('secret-key', 1_700_000_000, '{"event":"alert.test"}')
    expect(signed.timestamp).toBe('1700000000')
    expect(signed.signature.startsWith('sha256=')).toBe(true)
    expect(signed.signature.length).toBeGreaterThan('sha256='.length)
  })
})

describe('classifyWebhookHttpStatus', () => {
  it('treats 2xx as success and 5xx as retryable', () => {
    expect(classifyWebhookHttpStatus(200).retryable).toBe(false)
    expect(classifyWebhookHttpStatus(503).retryable).toBe(true)
    expect(classifyWebhookHttpStatus(404).retryable).toBe(false)
    expect(classifyWebhookHttpStatus(429).retryable).toBe(true)
  })
})

describe('assertAllowedWebhookUrl', () => {
  it('rejects localhost and private IP targets', async () => {
    await expect(assertAllowedWebhookUrl('https://localhost/hook')).rejects.toThrow(
      'hostname is not allowed'
    )
    await expect(assertAllowedWebhookUrl('https://127.0.0.1/hook')).rejects.toThrow(
      'private or local IP'
    )
    await expect(assertAllowedWebhookUrl('https://10.0.0.1/hook')).rejects.toThrow(
      'private or local IP'
    )
    await expect(assertAllowedWebhookUrl('https://198.18.0.1/hook')).rejects.toThrow(
      'private or local IP'
    )
    await expect(assertAllowedWebhookUrl('https://240.0.0.1/hook')).rejects.toThrow(
      'private or local IP'
    )
    await expect(assertAllowedWebhookUrl('https://192.0.0.1/hook')).rejects.toThrow(
      'private or local IP'
    )
  })

  it('accepts public hostnames', async () => {
    await expect(assertAllowedWebhookUrl('https://example.com/hook')).resolves.toBeUndefined()
  })
})

describe('getWebhookDeliveryTarget', () => {
  it('normalizes origin, path, and query while stripping fragments', () => {
    expect(getWebhookDeliveryTarget('https://example.com/hooks/alerts?token=abc#section')).toBe(
      'https://example.com/hooks/alerts?token=abc'
    )
  })
})

describe('isWebhookDeliveryExpired', () => {
  it('returns false before the max age window elapses', () => {
    const createdAt = new Date('2026-05-25T12:00:00.000Z')
    const nowMs = createdAt.getTime() + WEBHOOK_DELIVERY_MAX_AGE_MS - 1
    expect(isWebhookDeliveryExpired(createdAt, nowMs)).toBe(false)
  })

  it('returns true after the max age window elapses', () => {
    const createdAt = new Date('2026-05-25T12:00:00.000Z')
    const nowMs = createdAt.getTime() + WEBHOOK_DELIVERY_MAX_AGE_MS
    expect(isWebhookDeliveryExpired(createdAt, nowMs)).toBe(true)
  })

  it('treats invalid createdAt values as expired', () => {
    expect(isWebhookDeliveryExpired('not-a-date')).toBe(true)
  })
})

describe('deliverWebhook', () => {
  it('returns a non-retryable error for blocked webhook URLs', async () => {
    const result = await deliverWebhook({
      url: 'https://127.0.0.1/hook',
      body: '{"event":"alert.test"}',
      deliveryId: 'delivery_1',
      idempotencyKey: 'event_1',
    })

    expect(result.success).toBe(false)
    expect(result.retryable).toBe(false)
  })
})
