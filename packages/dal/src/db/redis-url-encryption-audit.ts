import { env } from '@durabull/env'
import { eq } from 'drizzle-orm'
import type { Database } from './client'
import {
  assertRedisUrlEncryptionKeyConfigured,
  decryptRedisUrl,
  encryptRedisUrl,
  isRedisUrlEncrypted,
} from './redis-url-encryption'
import { redisConnection } from './schemas/redis-connection/schema'

export interface RedisUrlEncryptionAuditOptions {
  organizationId?: string
  migratePlaintext?: boolean
  dryRun?: boolean
}

export interface RedisUrlEncryptionAuditResult {
  totalRows: number
  encryptedRows: number
  plaintextRows: number
  migratedRows: number
  invalidEncryptedRows: number
  invalidEncryptedConnectionIds: string[]
}

let hasWarnedAboutPlaintextRows = false

export function shouldEnforceRedisUrlEncryption(): boolean {
  if (env.DURABULL_ENFORCE_REDIS_URL_ENCRYPTION !== undefined) {
    return env.DURABULL_ENFORCE_REDIS_URL_ENCRYPTION
  }

  return env.NODE_ENV === 'production'
}

export async function auditRedisConnectionUrlEncryption(
  db: Database,
  options: RedisUrlEncryptionAuditOptions = {}
): Promise<RedisUrlEncryptionAuditResult> {
  const { organizationId, migratePlaintext = false, dryRun = false } = options

  const rows = organizationId
    ? await db
        .select({
          id: redisConnection.id,
          url: redisConnection.url,
          organizationId: redisConnection.organizationId,
        })
        .from(redisConnection)
        .where(eq(redisConnection.organizationId, organizationId))
    : await db
        .select({
          id: redisConnection.id,
          url: redisConnection.url,
          organizationId: redisConnection.organizationId,
        })
        .from(redisConnection)

  let encryptedRows = 0
  let plaintextRows = 0
  let migratedRows = 0
  let invalidEncryptedRows = 0
  const invalidEncryptedConnectionIds: string[] = []

  for (const row of rows) {
    if (isRedisUrlEncrypted(row.url)) {
      try {
        decryptRedisUrl(row.url)
        encryptedRows += 1
      } catch {
        invalidEncryptedRows += 1
        invalidEncryptedConnectionIds.push(row.id)
      }
      continue
    }

    plaintextRows += 1

    if (!migratePlaintext) {
      continue
    }

    const encryptedUrl = encryptRedisUrl(row.url)
    migratedRows += 1

    if (dryRun) {
      continue
    }

    await db
      .update(redisConnection)
      .set({
        url: encryptedUrl,
        updatedAt: new Date(),
      })
      .where(eq(redisConnection.id, row.id))
  }

  return {
    totalRows: rows.length,
    encryptedRows,
    plaintextRows,
    migratedRows,
    invalidEncryptedRows,
    invalidEncryptedConnectionIds,
  }
}

export async function assertRedisConnectionUrlEncryptionReady(
  db: Database,
  options: Pick<RedisUrlEncryptionAuditOptions, 'organizationId'> = {}
): Promise<void> {
  assertRedisUrlEncryptionKeyConfigured()

  const result = await auditRedisConnectionUrlEncryption(db, {
    organizationId: options.organizationId,
  })

  if (result.invalidEncryptedRows > 0) {
    const ids = result.invalidEncryptedConnectionIds.slice(0, 5).join(', ')
    throw new Error(
      `Found ${result.invalidEncryptedRows} encrypted Redis connection URL(s) that could not be decrypted with the current DURABULL_REDIS_URL_ENCRYPTION_KEY. Example IDs: ${ids || 'n/a'}.`
    )
  }

  if (result.plaintextRows > 0) {
    const command = options.organizationId
      ? `bun tooling/scripts/encrypt-redis-connection-urls.ts --organization ${options.organizationId}`
      : 'bun tooling/scripts/encrypt-redis-connection-urls.ts'

    const message = `Found ${result.plaintextRows} plaintext Redis connection URL(s) in the database. Run "${command}" to migrate existing rows.`

    if (shouldEnforceRedisUrlEncryption()) {
      throw new Error(message)
    }

    if (!hasWarnedAboutPlaintextRows) {
      console.warn(`[durabull] ${message}`)
      hasWarnedAboutPlaintextRows = true
    }
  }
}

export function resetRedisUrlEncryptionAuditWarningsForTests(): void {
  hasWarnedAboutPlaintextRows = false
}
