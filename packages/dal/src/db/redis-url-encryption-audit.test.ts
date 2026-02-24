import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { env } from '@durabull/env'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from './client'
import {
  assertRedisConnectionUrlEncryptionReady,
  auditRedisConnectionUrlEncryption,
  resetRedisUrlEncryptionAuditWarningsForTests,
} from './redis-url-encryption-audit'
import { encryptRedisUrl, isRedisUrlEncrypted } from './redis-url-encryption'
import { organization } from './schemas/organization/schema'
import { redisConnection } from './schemas/redis-connection/schema'

const mutableEnv = env as {
  DATABASE_URL?: string
  NODE_ENV?: 'development' | 'test' | 'production'
  DURABULL_REDIS_URL_ENCRYPTION_KEY?: string
  DURABULL_ENFORCE_REDIS_URL_ENCRYPTION?: boolean
}

const originalDatabaseUrl = mutableEnv.DATABASE_URL
const originalNodeEnv = mutableEnv.NODE_ENV
const originalEncryptionKey = mutableEnv.DURABULL_REDIS_URL_ENCRYPTION_KEY
const originalEnforceFlag = mutableEnv.DURABULL_ENFORCE_REDIS_URL_ENCRYPTION
const originalPgliteDir = process.env.DURABULL_PGLITE_DIR

const TEST_ORG_ID = 'org-encryption-audit'
const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

let tempPgliteDir = ''

async function setupBaseOrganization() {
  const db = await getDb()
  await db.insert(organization).values({
    id: TEST_ORG_ID,
    name: 'Encryption Audit Org',
    slug: 'encryption-audit-org',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  return db
}

describe('redis-url-encryption-audit', () => {
  beforeEach(async () => {
    tempPgliteDir = await mkdtemp(join(tmpdir(), 'durabull-redis-encryption-audit-'))
    process.env.DURABULL_PGLITE_DIR = tempPgliteDir
    delete process.env.DATABASE_URL
    mutableEnv.DATABASE_URL = undefined
    mutableEnv.NODE_ENV = 'development'
    mutableEnv.DURABULL_REDIS_URL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
    mutableEnv.DURABULL_ENFORCE_REDIS_URL_ENCRYPTION = undefined
    resetRedisUrlEncryptionAuditWarningsForTests()
    await closeDb()
  })

  afterEach(async () => {
    await closeDb()
    mutableEnv.DATABASE_URL = originalDatabaseUrl
    mutableEnv.NODE_ENV = originalNodeEnv
    mutableEnv.DURABULL_REDIS_URL_ENCRYPTION_KEY = originalEncryptionKey
    mutableEnv.DURABULL_ENFORCE_REDIS_URL_ENCRYPTION = originalEnforceFlag

    if (originalPgliteDir) {
      process.env.DURABULL_PGLITE_DIR = originalPgliteDir
    } else {
      delete process.env.DURABULL_PGLITE_DIR
    }

    if (tempPgliteDir) {
      await rm(tempPgliteDir, { recursive: true, force: true })
      tempPgliteDir = ''
    }
  })

  it('migrates plaintext rows when requested and preserves decryptability', async () => {
    const db = await setupBaseOrganization()
    const now = new Date()

    await db.insert(redisConnection).values({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Legacy Plaintext',
      url: 'redis://legacy:secret@localhost:6379/0',
      environment: 'development',
      isDefault: true,
      organizationId: TEST_ORG_ID,
      createdAt: now,
      updatedAt: now,
    })

    const dryRun = await auditRedisConnectionUrlEncryption(db, {
      organizationId: TEST_ORG_ID,
      migratePlaintext: true,
      dryRun: true,
    })
    expect(dryRun.totalRows).toBe(1)
    expect(dryRun.plaintextRows).toBe(1)
    expect(dryRun.migratedRows).toBe(1)

    const beforePersist = await db
      .select({ url: redisConnection.url })
      .from(redisConnection)
      .where(eq(redisConnection.id, '11111111-1111-4111-8111-111111111111'))
      .limit(1)
    expect(beforePersist[0]?.url).toBe('redis://legacy:secret@localhost:6379/0')

    const migrated = await auditRedisConnectionUrlEncryption(db, {
      organizationId: TEST_ORG_ID,
      migratePlaintext: true,
    })
    expect(migrated.totalRows).toBe(1)
    expect(migrated.plaintextRows).toBe(1)
    expect(migrated.migratedRows).toBe(1)
    expect(migrated.invalidEncryptedRows).toBe(0)

    const afterPersist = await db
      .select({ url: redisConnection.url })
      .from(redisConnection)
      .where(eq(redisConnection.id, '11111111-1111-4111-8111-111111111111'))
      .limit(1)

    expect(afterPersist[0]).toBeDefined()
    expect(isRedisUrlEncrypted(afterPersist[0]!.url)).toBe(true)

    const postAudit = await auditRedisConnectionUrlEncryption(db, {
      organizationId: TEST_ORG_ID,
    })
    expect(postAudit.totalRows).toBe(1)
    expect(postAudit.encryptedRows).toBe(1)
    expect(postAudit.plaintextRows).toBe(0)
    expect(postAudit.invalidEncryptedRows).toBe(0)
  })

  it('reports invalid encrypted rows', async () => {
    const db = await setupBaseOrganization()
    const now = new Date()

    await db.insert(redisConnection).values({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Invalid Ciphertext',
      url: 'enc:v1:00:00:00',
      environment: 'development',
      isDefault: false,
      organizationId: TEST_ORG_ID,
      createdAt: now,
      updatedAt: now,
    })

    const result = await auditRedisConnectionUrlEncryption(db, {
      organizationId: TEST_ORG_ID,
    })

    expect(result.totalRows).toBe(1)
    expect(result.encryptedRows).toBe(0)
    expect(result.invalidEncryptedRows).toBe(1)
    expect(result.invalidEncryptedConnectionIds).toEqual(['22222222-2222-4222-8222-222222222222'])
  })

  it('fails readiness checks in production when plaintext rows remain', async () => {
    const db = await setupBaseOrganization()
    const now = new Date()
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.DURABULL_ENFORCE_REDIS_URL_ENCRYPTION = undefined

    await db.insert(redisConnection).values({
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Plaintext In Production',
      url: 'redis://prod:secret@localhost:6379/1',
      environment: 'production',
      isDefault: true,
      organizationId: TEST_ORG_ID,
      createdAt: now,
      updatedAt: now,
    })

    await expect(assertRedisConnectionUrlEncryptionReady(db)).rejects.toThrow(
      'plaintext Redis connection URL'
    )
  })

  it('fails readiness checks when encrypted rows cannot be decrypted with current key', async () => {
    const db = await setupBaseOrganization()
    const now = new Date()
    const encryptedWithOldKey = encryptRedisUrl('redis://secure:secret@localhost:6379/2')

    await db.insert(redisConnection).values({
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Encrypted Row',
      url: encryptedWithOldKey,
      environment: 'production',
      isDefault: true,
      organizationId: TEST_ORG_ID,
      createdAt: now,
      updatedAt: now,
    })

    mutableEnv.DURABULL_REDIS_URL_ENCRYPTION_KEY =
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'

    await expect(assertRedisConnectionUrlEncryptionReady(db)).rejects.toThrow(
      'could not be decrypted'
    )
  })
})
