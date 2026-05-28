import { describe, expect, it } from 'bun:test'

import { isAllowedPosthogHostname, resolvePosthogBatchUrl } from './posthog-batch'

describe('isAllowedPosthogHostname', () => {
  it('allows official PostHog ingest hosts', () => {
    expect(isAllowedPosthogHostname('us.i.posthog.com')).toBe(true)
    expect(isAllowedPosthogHostname('eu.i.posthog.com')).toBe(true)
    expect(isAllowedPosthogHostname('us.posthog.com')).toBe(true)
  })

  it('rejects non-PostHog and private hosts', () => {
    expect(isAllowedPosthogHostname('evil.example.com')).toBe(false)
    expect(isAllowedPosthogHostname('127.0.0.1')).toBe(false)
    expect(isAllowedPosthogHostname('10.0.0.1')).toBe(false)
    expect(isAllowedPosthogHostname('169.254.169.254')).toBe(false)
    expect(isAllowedPosthogHostname('::1')).toBe(false)
  })
})

describe('resolvePosthogBatchUrl', () => {
  it('resolves default US batch endpoint', () => {
    expect(resolvePosthogBatchUrl(undefined)).toBe('https://us.i.posthog.com/batch/')
  })

  it('rejects non-HTTPS hosts', () => {
    expect(resolvePosthogBatchUrl('http://us.i.posthog.com')).toBeNull()
  })

  it('rejects disallowed hostnames', () => {
    expect(resolvePosthogBatchUrl('https://127.0.0.1')).toBeNull()
    expect(resolvePosthogBatchUrl('https://evil.example.com')).toBeNull()
  })

  it('rejects malformed URLs', () => {
    expect(resolvePosthogBatchUrl('http://[::1')).toBeNull()
  })
})
