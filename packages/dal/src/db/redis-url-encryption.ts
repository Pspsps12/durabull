import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '@durabull/env'

const REDIS_URL_ENCRYPTION_PREFIX = 'enc:v1:'
const AES_256_KEY_BYTES = 32
const GCM_IV_BYTES = 12

function parseEncryptionKey(rawKey: string | undefined): Buffer | null {
  const key = rawKey?.trim()
  if (!key) return null

  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, 'hex')
  }

  // Accept both standard base64 and URL-safe base64 input.
  const base64Candidate = key.replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Candidate)) {
    return null
  }

  const padding = (4 - (base64Candidate.length % 4)) % 4
  const padded = base64Candidate + '='.repeat(padding)

  const decoded = Buffer.from(padded, 'base64')
  if (decoded.length !== AES_256_KEY_BYTES) {
    return null
  }

  return decoded
}

function requireEncryptionKey(): Buffer {
  const key = parseEncryptionKey(env.DURABULL_REDIS_URL_ENCRYPTION_KEY)
  if (!key) {
    throw new Error(
      'DURABULL_REDIS_URL_ENCRYPTION_KEY must be set to a 32-byte key encoded as 64-char hex or base64.'
    )
  }

  return key
}

export function isRedisUrlEncryptionKeyConfigured(): boolean {
  return parseEncryptionKey(env.DURABULL_REDIS_URL_ENCRYPTION_KEY) !== null
}

export function assertRedisUrlEncryptionKeyConfigured(): void {
  requireEncryptionKey()
}

function toHex(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString('hex')
}

function fromHex(hex: string): Buffer {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error('Invalid encrypted Redis URL format.')
  }

  return Buffer.from(hex, 'hex')
}

export function isRedisUrlEncrypted(value: string): boolean {
  return value.startsWith(REDIS_URL_ENCRYPTION_PREFIX)
}

export function encryptRedisUrl(url: string): string {
  const key = requireEncryptionKey()
  const iv = randomBytes(GCM_IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)

  const encrypted = Buffer.concat([cipher.update(url, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${REDIS_URL_ENCRYPTION_PREFIX}${toHex(iv)}:${toHex(authTag)}:${toHex(encrypted)}`
}

export function decryptRedisUrl(value: string): string {
  if (!isRedisUrlEncrypted(value)) {
    throw new Error('Redis connection URL is not encrypted.')
  }

  const key = requireEncryptionKey()
  const payload = value.slice(REDIS_URL_ENCRYPTION_PREFIX.length)
  const [ivHex, tagHex, encryptedHex] = payload.split(':')

  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error('Invalid encrypted Redis URL format.')
  }

  try {
    const iv = fromHex(ivHex)
    const authTag = fromHex(tagHex)
    const encrypted = fromHex(encryptedHex)

    if (iv.length !== GCM_IV_BYTES || authTag.length !== 16) {
      throw new Error('Invalid encrypted Redis URL format.')
    }

    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid encrypted Redis URL format.') {
      throw error
    }

    throw new Error(
      'Failed to decrypt Redis connection URL. Verify DURABULL_REDIS_URL_ENCRYPTION_KEY.'
    )
  }
}
