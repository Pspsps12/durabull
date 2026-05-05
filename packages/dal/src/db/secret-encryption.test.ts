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

    const encrypted = encryptSecret('lin_api_super_secret_key')

    expect(isSecretEncrypted(encrypted)).toBe(true)
    expect(encrypted).not.toContain('lin_api_super_secret_key')
    expect(decryptSecret(encrypted)).toBe('lin_api_super_secret_key')
  })

  it('creates a safe key preview', () => {
    expect(maskSecretPreview('lin_api_1234567890')).toBe('lin_…7890')
  })
})
