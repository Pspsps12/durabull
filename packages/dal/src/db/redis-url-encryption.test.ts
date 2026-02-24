import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { env } from '@durabull/env'
import { decryptRedisUrl, encryptRedisUrl, isRedisUrlEncrypted } from './redis-url-encryption'

const originalEncryptionKey = env.DURABULL_REDIS_URL_ENCRYPTION_KEY

describe('redis-url-encryption', () => {
  beforeEach(() => {
    ;(env as { DURABULL_REDIS_URL_ENCRYPTION_KEY?: string }).DURABULL_REDIS_URL_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  })

  afterEach(() => {
    ;(env as { DURABULL_REDIS_URL_ENCRYPTION_KEY?: string }).DURABULL_REDIS_URL_ENCRYPTION_KEY =
      originalEncryptionKey
  })

  it('encrypts and decrypts a redis URL', () => {
    const url = 'rediss://default:secret@redis.example.com:6380/0'
    const encrypted = encryptRedisUrl(url)

    expect(encrypted).not.toBe(url)
    expect(isRedisUrlEncrypted(encrypted)).toBe(true)
    expect(decryptRedisUrl(encrypted)).toBe(url)
  })

  it('keeps plaintext values unchanged when decrypting legacy rows', () => {
    const plaintext = 'redis://localhost:6379'
    expect(decryptRedisUrl(plaintext)).toBe(plaintext)
    expect(isRedisUrlEncrypted(plaintext)).toBe(false)
  })

  it('throws when encryption key is missing', () => {
    ;(env as { DURABULL_REDIS_URL_ENCRYPTION_KEY?: string }).DURABULL_REDIS_URL_ENCRYPTION_KEY =
      undefined

    expect(() => encryptRedisUrl('redis://localhost:6379')).toThrow(
      'DURABULL_REDIS_URL_ENCRYPTION_KEY'
    )
  })

  it('throws when decrypting with the wrong key', () => {
    const url = 'redis://user:pass@localhost:6379'
    const encrypted = encryptRedisUrl(url)

    ;(env as { DURABULL_REDIS_URL_ENCRYPTION_KEY?: string }).DURABULL_REDIS_URL_ENCRYPTION_KEY =
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'

    expect(() => decryptRedisUrl(encrypted)).toThrow('Failed to decrypt Redis connection URL')
  })
})
