import { describe, expect, it } from 'bun:test'

import { isMcpAccessTokenExpired, toAccessTokenExpiry } from './session'

describe('isMcpAccessTokenExpired', () => {
  it('returns false for future expiry', () => {
    expect(isMcpAccessTokenExpired(new Date(Date.now() + 60_000))).toBe(false)
  })

  it('returns true for past expiry', () => {
    expect(isMcpAccessTokenExpired(new Date(Date.now() - 1_000))).toBe(true)
  })

  it('parses ISO string expiry', () => {
    const past = new Date(Date.now() - 5_000).toISOString()
    expect(isMcpAccessTokenExpired(past)).toBe(true)
  })

  it('treats missing expiry as expired (fail closed)', () => {
    expect(isMcpAccessTokenExpired(null)).toBe(true)
    expect(toAccessTokenExpiry(undefined)).toBeNull()
  })
})
