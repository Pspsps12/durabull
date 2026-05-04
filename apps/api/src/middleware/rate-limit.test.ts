import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { env } from '@durabull/env'
import { Hono } from 'hono'
import { apiRateLimiter } from './rate-limit'

const mutableEnv = env as {
  CI?: boolean
  DISABLE_RATE_LIMIT?: boolean
  NODE_ENV?: 'development' | 'test' | 'production'
}

const originalCi = mutableEnv.CI
const originalDisableRateLimit = mutableEnv.DISABLE_RATE_LIMIT
const originalNodeEnv = mutableEnv.NODE_ENV

describe('apiRateLimiter', () => {
  beforeEach(() => {
    mutableEnv.CI = false
    mutableEnv.DISABLE_RATE_LIMIT = false
    mutableEnv.NODE_ENV = 'production'
  })

  afterEach(() => {
    mutableEnv.CI = originalCi
    mutableEnv.DISABLE_RATE_LIMIT = originalDisableRateLimit
    mutableEnv.NODE_ENV = originalNodeEnv
  })

  it('allows a normal multi-tab app startup burst from one client', async () => {
    const app = new Hono()
    app.use('/api/*', apiRateLimiter)
    app.get('/api/ping', (c) => c.json({ ok: true }))

    const responses = await Promise.all(
      Array.from({ length: 150 }, () =>
        app.request('/api/ping', {
          headers: { 'x-forwarded-for': '203.0.113.10' },
        })
      )
    )

    expect(responses.every((response) => response.status === 200)).toBe(true)
    expect(responses[0]?.headers.get('X-RateLimit-Limit')).toBe('600')
  })
})
