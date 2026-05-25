import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { closeDb, redisDiscoveredQueueRepository } from '@durabull/dal'
import { env } from '@durabull/env'
import { createApiApp } from '../app'
import { resetAuthlessStateForTests } from '../lib/authless'

const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const mutableEnv = env as {
  DATABASE_URL?: string
  DURABULL_AUTHLESS?: boolean
  DURABULL_ENV_CONNECTIONS?: boolean
  DURABULL_REDIS_URL_ENCRYPTION_KEY?: string
}

const originalAuthless = mutableEnv.DURABULL_AUTHLESS
const originalDatabaseUrl = mutableEnv.DATABASE_URL
const originalEnvConnections = mutableEnv.DURABULL_ENV_CONNECTIONS
const originalEncryptionKey = mutableEnv.DURABULL_REDIS_URL_ENCRYPTION_KEY
const originalPgliteDir = process.env.DURABULL_PGLITE_DIR

let tempPgliteDir = ''

interface ConnectionResponseBody {
  connection: {
    id: string
    prefix: string
    allowSelfSignedCerts?: boolean
  }
}

describe('connections prefix API', () => {
  beforeEach(async () => {
    tempPgliteDir = await mkdtemp(join(tmpdir(), 'durabull-connections-prefix-'))
    process.env.DURABULL_PGLITE_DIR = tempPgliteDir
    delete process.env.DATABASE_URL
    mutableEnv.DATABASE_URL = undefined
    mutableEnv.DURABULL_AUTHLESS = true
    mutableEnv.DURABULL_ENV_CONNECTIONS = false
    mutableEnv.DURABULL_REDIS_URL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
    resetAuthlessStateForTests()
    await closeDb()
  })

  afterEach(async () => {
    resetAuthlessStateForTests()
    await closeDb()
    mutableEnv.DATABASE_URL = originalDatabaseUrl
    mutableEnv.DURABULL_AUTHLESS = originalAuthless
    mutableEnv.DURABULL_ENV_CONNECTIONS = originalEnvConnections
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

  it('defaults, stores, updates, and preserves BullMQ prefixes', async () => {
    const { app } = await createApiApp({ enableLogging: false })

    const defaultPrefixResponse = await app.request('/api/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Default Prefix Redis',
        url: 'redis://localhost:6379/0',
      }),
    })

    expect(defaultPrefixResponse.status).toBe(201)
    const defaultPrefixBody = (await defaultPrefixResponse.json()) as ConnectionResponseBody
    expect(defaultPrefixBody.connection.prefix).toBe('bull')

    const customPrefixResponse = await app.request('/api/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Custom Prefix Redis',
        url: 'redis://localhost:6379/1',
        prefix: ' tenant-a ',
      }),
    })

    expect(customPrefixResponse.status).toBe(201)
    const customPrefixBody = (await customPrefixResponse.json()) as ConnectionResponseBody
    expect(customPrefixBody.connection.prefix).toBe('tenant-a')

    await redisDiscoveredQueueRepository.upsertConfirmedQueues(
      customPrefixBody.connection.id,
      ['old-prefix-queue'],
      new Date()
    )
    expect(
      await redisDiscoveredQueueRepository.countByConnection(customPrefixBody.connection.id)
    ).toBe(1)

    const updatePrefixResponse = await app.request(
      `/api/connections/${customPrefixBody.connection.id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prefix: ' tenant-b ' }),
      }
    )

    expect(updatePrefixResponse.status).toBe(200)
    const updatePrefixBody = (await updatePrefixResponse.json()) as ConnectionResponseBody
    expect(updatePrefixBody.connection.prefix).toBe('tenant-b')
    expect(
      await redisDiscoveredQueueRepository.countByConnection(customPrefixBody.connection.id)
    ).toBe(0)

    const updateNameResponse = await app.request(
      `/api/connections/${customPrefixBody.connection.id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed Custom Prefix Redis' }),
      }
    )

    expect(updateNameResponse.status).toBe(200)
    const updateNameBody = (await updateNameResponse.json()) as ConnectionResponseBody
    expect(updateNameBody.connection.prefix).toBe('tenant-b')
  })

  it('stores and updates allowSelfSignedCerts', async () => {
    const { app } = await createApiApp({ enableLogging: false })

    const createResponse = await app.request('/api/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Heroku Redis',
        url: 'rediss://example.heroku.com:6379',
        allowSelfSignedCerts: true,
      }),
    })

    expect(createResponse.status).toBe(201)
    const createBody = (await createResponse.json()) as ConnectionResponseBody
    expect(createBody.connection.allowSelfSignedCerts).toBe(true)

    const getResponse = await app.request(`/api/connections/${createBody.connection.id}`)
    expect(getResponse.status).toBe(200)
    const getBody = (await getResponse.json()) as {
      connection: { allowSelfSignedCerts: boolean }
    }
    expect(getBody.connection.allowSelfSignedCerts).toBe(true)

    const updateResponse = await app.request(`/api/connections/${createBody.connection.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ allowSelfSignedCerts: false }),
    })

    expect(updateResponse.status).toBe(200)
    const updateBody = (await updateResponse.json()) as ConnectionResponseBody
    expect(updateBody.connection.allowSelfSignedCerts).toBe(false)
  })

  it('rejects blank prefixes', async () => {
    const { app } = await createApiApp({ enableLogging: false })

    const createResponse = await app.request('/api/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Blank Prefix Redis',
        url: 'redis://localhost:6379/0',
        prefix: '   ',
      }),
    })

    expect(createResponse.status).toBe(400)
  })

  it('clears discovered queues when the connection URL changes', async () => {
    const { app } = await createApiApp({ enableLogging: false })

    const createResponse = await app.request('/api/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'URL Change Redis',
        url: 'redis://localhost:6379/0',
      }),
    })

    expect(createResponse.status).toBe(201)
    const createBody = (await createResponse.json()) as ConnectionResponseBody

    await redisDiscoveredQueueRepository.upsertConfirmedQueues(
      createBody.connection.id,
      ['old-url-queue'],
      new Date()
    )
    expect(await redisDiscoveredQueueRepository.countByConnection(createBody.connection.id)).toBe(1)

    const updateResponse = await app.request(`/api/connections/${createBody.connection.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'redis://localhost:6379/1' }),
    })

    expect(updateResponse.status).toBe(200)
    expect(await redisDiscoveredQueueRepository.countByConnection(createBody.connection.id)).toBe(0)
  })
})
