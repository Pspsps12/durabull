import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '@durabull/env'

const SECRET_ENCRYPTION_PREFIX = 'enc:v1:'
const AES_256_KEY_BYTES = 32
const GCM_IV_BYTES = 12

function parseEncryptionKey(rawKey: string | undefined): Buffer | null {
  const key = rawKey?.trim()
  if (!key) return null

  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, 'hex')
  }

  const base64Candidate = key.replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Candidate)) {
    return null
  }

  const padding = (4 - (base64Candidate.length % 4)) % 4
  const decoded = Buffer.from(`${base64Candidate}${'='.repeat(padding)}`, 'base64')
  return decoded.length === AES_256_KEY_BYTES ? decoded : null
}

function requireEncryptionKey(): Buffer {
  const key = parseEncryptionKey(env.DURABULL_SECRET_ENCRYPTION_KEY)
  if (!key) {
    throw new Error(
      'DURABULL_SECRET_ENCRYPTION_KEY must be set to a 32-byte key encoded as 64-char hex or base64.'
    )
  }

  return key
}

function toHex(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString('hex')
}

function fromHex(hex: string): Buffer {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error('Invalid encrypted secret format.')
  }

  return Buffer.from(hex, 'hex')
}

export function isSecretEncryptionKeyConfigured(): boolean {
  return parseEncryptionKey(env.DURABULL_SECRET_ENCRYPTION_KEY) !== null
}

export function assertSecretEncryptionKeyConfigured(): void {
  requireEncryptionKey()
}

export function isSecretEncrypted(value: string): boolean {
  return value.startsWith(SECRET_ENCRYPTION_PREFIX)
}

export function encryptSecret(secret: string): string {
  const key = requireEncryptionKey()
  const iv = randomBytes(GCM_IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)

  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${SECRET_ENCRYPTION_PREFIX}${toHex(iv)}:${toHex(authTag)}:${toHex(encrypted)}`
}

export function decryptSecret(value: string): string {
  if (!isSecretEncrypted(value)) {
    throw new Error('Secret is not encrypted.')
  }

  const key = requireEncryptionKey()
  const payload = value.slice(SECRET_ENCRYPTION_PREFIX.length)
  const [ivHex, tagHex, encryptedHex] = payload.split(':')

  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error('Invalid encrypted secret format.')
  }

  try {
    const iv = fromHex(ivHex)
    const authTag = fromHex(tagHex)
    const encrypted = fromHex(encryptedHex)

    if (iv.length !== GCM_IV_BYTES || authTag.length !== 16) {
      throw new Error('Invalid encrypted secret format.')
    }

    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid encrypted secret format.') {
      throw error
    }

    throw new Error('Failed to decrypt secret. Verify DURABULL_SECRET_ENCRYPTION_KEY.')
  }
}

export function maskSecretPreview(secret: string): string {
  const trimmed = secret.trim()
  if (trimmed.length <= 8) return '••••'
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`
}
