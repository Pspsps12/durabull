import { afterEach, describe, expect, it } from 'bun:test'
import { env } from '@durabull/env'
import {
  decryptSecret,
  encryptSecret,
  isSecretEncrypted,
  maskSecretPreview,
} from './secret-encryption'

const mutableEnv = env as { DURABULL_SECRET_ENCRYPTION_KEY?: string }
const originalKey = mutableEnv.DURABULL_SECRET_ENCRYPTION_KEY

describe('secret encryption', () => {
  afterEach(() => {
    mutableEnv.DURABULL_SECRET_ENCRYPTION_KEY = originalKey
  })

  it('encrypts and decrypts secrets without storing plaintext', () => {
    mutableEnv.DURABULL_SECRET_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

    const encrypted = encryptSecret('linear_oauth_access_token')

    expect(isSecretEncrypted(encrypted)).toBe(true)
    expect(encrypted).not.toContain('linear_oauth_access_token')
    expect(decryptSecret(encrypted)).toBe('linear_oauth_access_token')
  })

  it('creates a safe key preview', () => {
    expect(maskSecretPreview('linear_oauth_access_token_1234567890')).toBe('line…7890')
  })
})
