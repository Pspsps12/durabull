import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { env } from '@durabull/env'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '../db/client'
import { encryptRedisUrl, isRedisUrlEncrypted } from '../db/redis-url-encryption'
import { organization } from '../db/schemas/organization/schema'
import { redisConnection } from '../db/schemas/redis-connection/schema'
import { redisConnectionRepository } from './redis-connection'

const mutableEnv = env as {
  DATABASE_URL?: string
  DURABULL_ENV_CONNECTIONS?: boolean
  DURABULL_REDIS_URL_ENCRYPTION_KEY?: string
}

const originalDatabaseUrl = mutableEnv.DATABASE_URL
const originalEnvConnectionsFlag = mutableEnv.DURABULL_ENV_CONNECTIONS
const originalEncryptionKey = mutableEnv.DURABULL_REDIS_URL_ENCRYPTION_KEY
const originalPgliteDir = process.env.DURABULL_PGLITE_DIR

const TEST_ORG_ID = 'org-repo-encryption'
const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

let tempPgliteDir = ''

async function setupBaseOrganization() {
  const db = await getDb()
  await db.insert(organization).values({
    id: TEST_ORG_ID,
    name: 'Repository Encryption Org',
    slug: 'repository-encryption-org',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  return db
}

describe('redisConnectionRepository encryption', () => {
  beforeEach(async () => {
    tempPgliteDir = await mkdtemp(join(tmpdir(), 'durabull-repo-encryption-'))
    process.env.DURABULL_PGLITE_DIR = tempPgliteDir
    delete process.env.DATABASE_URL
    mutableEnv.DATABASE_URL = undefined
    mutableEnv.DURABULL_ENV_CONNECTIONS = false
    mutableEnv.DURABULL_REDIS_URL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
    await closeDb()
  })

  afterEach(async () => {
    await closeDb()
    mutableEnv.DATABASE_URL = originalDatabaseUrl
    mutableEnv.DURABULL_ENV_CONNECTIONS = originalEnvConnectionsFlag
    mutableEnv.DURABULL_REDIS_URL_ENCRYPTION_KEY = originalEncryptionKey

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

  it('encrypts URL at rest on create and returns plaintext via repository', async () => {
    const db = await setupBaseOrganization()
    const created = await redisConnectionRepository.create({
      name: 'Primary',
      url: 'redis://create:secret@localhost:6379/0',
      environment: 'development',
      isDefault: true,
      organizationId: TEST_ORG_ID,
    })

    expect(created.url).toBe('redis://create:secret@localhost:6379/0')

    const row = await db
      .select({ url: redisConnection.url })
      .from(redisConnection)
      .where(eq(redisConnection.id, created.id))
      .limit(1)

    expect(row[0]).toBeDefined()
    expect(isRedisUrlEncrypted(row[0]!.url)).toBe(true)
    expect(row[0]!.url).not.toBe(created.url)
  })

  it('encrypts updated URL at rest and still returns decrypted URL', async () => {
    const db = await setupBaseOrganization()
    const created = await redisConnectionRepository.create({
      name: 'Staging',
      url: 'redis://old:secret@localhost:6379/0',
      environment: 'staging',
      isDefault: false,
      organizationId: TEST_ORG_ID,
    })

    const updated = await redisConnectionRepository.update(created.id, TEST_ORG_ID, {
      url: 'redis://new:secret@localhost:6379/1',
    })

    expect(updated).not.toBeNull()
    expect(updated?.url).toBe('redis://new:secret@localhost:6379/1')

    const row = await db
      .select({ url: redisConnection.url })
      .from(redisConnection)
      .where(eq(redisConnection.id, created.id))
      .limit(1)

    expect(row[0]).toBeDefined()
    expect(isRedisUrlEncrypted(row[0]!.url)).toBe(true)
  })

  it('decrypts encrypted rows on read methods', async () => {
    const db = await setupBaseOrganization()
    const now = new Date()

    await db.insert(redisConnection).values([
      {
        id: '55555555-5555-4555-8555-555555555555',
        name: 'Encrypted A',
        url: encryptRedisUrl('redis://encrypted-a:secret@localhost:6379/2'),
        environment: 'development',
        isDefault: true,
        organizationId: TEST_ORG_ID,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: '66666666-6666-4666-8666-666666666666',
        name: 'Already Encrypted',
        url: encryptRedisUrl('redis://encrypted:secret@localhost:6379/3'),
        environment: 'production',
        isDefault: false,
        organizationId: TEST_ORG_ID,
        createdAt: now,
        updatedAt: now,
      },
    ])

    const byIdLegacy = await redisConnectionRepository.findById(
      '55555555-5555-4555-8555-555555555555',
      TEST_ORG_ID
    )
    const byIdEncrypted = await redisConnectionRepository.findById(
      '66666666-6666-4666-8666-666666666666',
      TEST_ORG_ID
    )
    const all = await redisConnectionRepository.findAll(TEST_ORG_ID)

    expect(byIdLegacy?.url).toBe('redis://encrypted-a:secret@localhost:6379/2')
    expect(byIdEncrypted?.url).toBe('redis://encrypted:secret@localhost:6379/3')
    expect(all.map((connection) => connection.url).sort()).toEqual(
      [
        'redis://encrypted:secret@localhost:6379/3',
        'redis://encrypted-a:secret@localhost:6379/2',
      ].sort()
    )
  })
})
