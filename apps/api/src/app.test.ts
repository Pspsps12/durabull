import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { closeDb } from '@durabull/dal'
import { env } from '@durabull/env'
import { createApiApp } from './app'

const mutableEnv = env as {
  APP_BASE_URL?: string
  CI?: boolean
  DATABASE_URL?: string
  DURABULL_AUTHLESS?: boolean
  DURABULL_CLOUD?: boolean
  DURABULL_TELEMETRY_POSTHOG_KEY?: string
  NODE_ENV?: 'development' | 'test' | 'production'
  POSTHOG_KEY?: string
}

const originalAppBaseUrl = mutableEnv.APP_BASE_URL
const originalAuthless = mutableEnv.DURABULL_AUTHLESS
const originalCi = mutableEnv.CI
const originalDatabaseUrl = mutableEnv.DATABASE_URL
const originalDurabullCloud = mutableEnv.DURABULL_CLOUD
const originalDurabullTelemetryPosthogKey = mutableEnv.DURABULL_TELEMETRY_POSTHOG_KEY
const originalNodeEnv = mutableEnv.NODE_ENV
const originalPosthogKey = mutableEnv.POSTHOG_KEY
const originalPgliteDir = process.env.DURABULL_PGLITE_DIR

let tempPgliteDir = ''

describe('api app config', () => {
  beforeEach(async () => {
    tempPgliteDir = await mkdtemp(join(tmpdir(), 'durabull-app-config-'))
    process.env.DURABULL_PGLITE_DIR = tempPgliteDir
    mutableEnv.CI = false
    mutableEnv.APP_BASE_URL = 'https://self-hosted.example.com'
    mutableEnv.DATABASE_URL = undefined
    mutableEnv.DURABULL_AUTHLESS = true
    mutableEnv.DURABULL_CLOUD = false
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_KEY = undefined
    await closeDb()
  })

  afterEach(async () => {
    await closeDb()
    mutableEnv.APP_BASE_URL = originalAppBaseUrl
    mutableEnv.CI = originalCi
    mutableEnv.DATABASE_URL = originalDatabaseUrl
    mutableEnv.DURABULL_AUTHLESS = originalAuthless
    mutableEnv.DURABULL_CLOUD = originalDurabullCloud
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_KEY = originalDurabullTelemetryPosthogKey
    mutableEnv.NODE_ENV = originalNodeEnv
    mutableEnv.POSTHOG_KEY = originalPosthogKey

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

  it('exposes required telemetry status without treating POSTHOG_KEY as an opt-out', async () => {
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.POSTHOG_KEY = 'phc_instance_owner_project'
    const { app } = await createApiApp({ enableLogging: false })

    const response = await app.request('/api/app/config')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      posthog: {
        enabled: true,
        key: 'phc_instance_owner_project',
      },
      telemetry: {
        collectionRequired: true,
        dedupeIdentifiedPosthogEvents: false,
        disclosureUrl: 'https://durabull.io/privacy',
        enabled: true,
      },
    })
  })

  it('enables telemetry dedupe when the configured PostHog project is Durabull-managed', async () => {
    mutableEnv.APP_BASE_URL = 'https://app.durabull.io'
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.POSTHOG_KEY = 'phc_durabull_cloud_project'
    const { app } = await createApiApp({ enableLogging: false })

    const response = await app.request('/api/app/config')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      posthog: {
        enabled: true,
      },
      telemetry: {
        collectionRequired: true,
        dedupeIdentifiedPosthogEvents: true,
        enabled: true,
      },
    })
  })

  it('does not dedupe cloud telemetry when an internal telemetry PostHog override uses a separate project', async () => {
    mutableEnv.APP_BASE_URL = 'https://app.durabull.io'
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.POSTHOG_KEY = 'phc_durabull_cloud_native_project'
    mutableEnv.DURABULL_TELEMETRY_POSTHOG_KEY = 'phc_durabull_separate_telemetry_project'
    const { app } = await createApiApp({ enableLogging: false })

    const response = await app.request('/api/app/config')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      telemetry: {
        collectionRequired: true,
        dedupeIdentifiedPosthogEvents: false,
        enabled: true,
      },
    })
  })
})
