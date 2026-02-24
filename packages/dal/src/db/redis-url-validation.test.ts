import { describe, expect, it } from 'bun:test'
import { validateRedisUrl, validateRedisUrlForEnvironment } from './redis-url-validation'

describe('redis-url-validation', () => {
  it('accepts internal/private redis hosts when protocol is valid', () => {
    expect(validateRedisUrl('redis://redis.railway.internal:6379').valid).toBe(true)
    expect(validateRedisUrl('redis://10.42.0.12:6379').valid).toBe(true)
    expect(validateRedisUrl('redis://localhost:6379').valid).toBe(true)
  })

  it('rejects unsupported protocols', () => {
    const result = validateRedisUrl('http://example.com')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid protocol')
  })

  it('keeps environment-aware validation behavior aligned', () => {
    expect(validateRedisUrlForEnvironment('redis://service.internal:6379').valid).toBe(true)
  })
})
