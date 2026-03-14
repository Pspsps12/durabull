import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  and,
  closeDb,
  eq,
  getDb,
  organization,
  redisConnection,
  redisDiscoveredQueue,
  redisDiscoveredQueueRepository,
} from '@durabull/dal'
import { env } from '@durabull/env'

const TEST_ORG_ID = 'queue-discovery-org'
const TEST_CONNECTION_ID = '22222222-2222-4222-8222-222222222222'

const mutableEnv = env as {
  DATABASE_URL?: string
}

const originalDatabaseUrl = mutableEnv.DATABASE_URL
const originalPgliteDir = process.env.DURABULL_PGLITE_DIR

let tempPgliteDir = ''

async function seedConnection() {
  const db = await getDb()
  const now = new Date()

  await db.insert(organization).values({
    id: TEST_ORG_ID,
    name: 'Queue Discovery Org',
    slug: 'queue-discovery-org',
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(redisConnection).values({
    id: TEST_CONNECTION_ID,
    name: 'Primary Redis',
    url: 'redis://localhost:6379/0',
    isDefault: true,
    environment: 'development',
    organizationId: TEST_ORG_ID,
    createdAt: now,
    updatedAt: now,
  })
}

async function insertDiscoveredQueue(name: string) {
  const db = await getDb()
  const now = new Date()

  await db.insert(redisDiscoveredQueue).values({
    connectionId: TEST_CONNECTION_ID,
    name,
    state: 'confirmed',
    lastDiscoveredAt: now,
    createdAt: now,
    updatedAt: now,
  })
}

async function listQueueNames() {
  const db = await getDb()
  const rows = await db
    .select({ name: redisDiscoveredQueue.name, state: redisDiscoveredQueue.state })
    .from(redisDiscoveredQueue)
    .where(eq(redisDiscoveredQueue.connectionId, TEST_CONNECTION_ID))

  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

describe('redisDiscoveredQueueRepository.syncConnectionSnapshot', () => {
  beforeEach(async () => {
    tempPgliteDir = await mkdtemp(join(tmpdir(), 'durabull-queue-discovery-'))
    process.env.DURABULL_PGLITE_DIR = tempPgliteDir
    delete process.env.DATABASE_URL
    mutableEnv.DATABASE_URL = undefined
    await closeDb()
    await seedConnection()
  })

  afterEach(async () => {
    await closeDb()
    mutableEnv.DATABASE_URL = originalDatabaseUrl

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

  it('removes locally cached queues that are missing from the latest Redis snapshot', async () => {
    await insertDiscoveredQueue('conversation-message')
    await insertDiscoveredQueue('stale-queue')

    const result = await redisDiscoveredQueueRepository.syncConnectionSnapshot(
      TEST_CONNECTION_ID,
      ['conversation-message', 'fresh-queue'],
      new Date()
    )

    expect(result.confirmed).toBe(2)
    expect(result.removed).toBe(1)
    expect(await listQueueNames()).toEqual([
      { name: 'conversation-message', state: 'confirmed' },
      { name: 'fresh-queue', state: 'confirmed' },
    ])
  })

  it('rolls back the pending-state transition if the transactional sync fails', async () => {
    await insertDiscoveredQueue('conversation-message')

    const db = await getDb()

    await expect(
      db.transaction(async (tx) => {
        await tx
          .update(redisDiscoveredQueue)
          .set({ state: 'pending' })
          .where(
            and(
              eq(redisDiscoveredQueue.connectionId, TEST_CONNECTION_ID),
              eq(redisDiscoveredQueue.name, 'conversation-message')
            )
          )

        throw new Error('snapshot sync failed')
      })
    ).rejects.toThrow('snapshot sync failed')

    expect(await listQueueNames()).toEqual([{ name: 'conversation-message', state: 'confirmed' }])
  })
})
