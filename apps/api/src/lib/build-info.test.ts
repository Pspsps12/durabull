import { afterEach, describe, expect, it } from 'bun:test'

const BUILD_INFO_ENV_KEYS = [
  'DURABULL_APP_VERSION',
  'DURABULL_BUILD_ID',
  'DURABULL_BUILD_TIME',
  'DURABULL_RELEASE_CHANNEL',
  'GITHUB_SHA',
  'VERCEL_GIT_COMMIT_SHA',
] as const

type BuildInfoEnvKey = (typeof BUILD_INFO_ENV_KEYS)[number]

const originalEnv = Object.fromEntries(
  BUILD_INFO_ENV_KEYS.map((key) => [key, process.env[key]])
) as Record<BuildInfoEnvKey, string | undefined>

let importCounter = 0

function restoreEnv() {
  for (const key of BUILD_INFO_ENV_KEYS) {
    const value = originalEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

async function importBuildInfo(env: Partial<Record<BuildInfoEnvKey, string | undefined>>) {
  for (const key of BUILD_INFO_ENV_KEYS) {
    delete process.env[key]
  }

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key as BuildInfoEnvKey]
    } else {
      process.env[key as BuildInfoEnvKey] = value
    }
  }

  importCounter += 1
  return import(`./build-info?build-info-test=${importCounter}`) as Promise<
    typeof import('./build-info')
  >
}

describe('build info', () => {
  afterEach(() => {
    restoreEnv()
  })

  it('requires an update when the client version is older than the API version', async () => {
    const { getAppVersionPayload } = await importBuildInfo({
      DURABULL_APP_VERSION: '2.0.0',
    })

    expect(getAppVersionPayload({ version: '1.9.0', buildId: '1.9.0' })).toMatchObject({
      version: '2.0.0',
      buildId: '2.0.0',
      releaseChannel: 'stable',
      update: {
        required: true,
        reason: 'version_mismatch',
      },
    })
  })

  it('requires an update when comparable build ids differ', async () => {
    const { getAppVersionPayload } = await importBuildInfo({
      DURABULL_APP_VERSION: '2.0.0',
      DURABULL_BUILD_ID: 'server-build',
      DURABULL_BUILD_TIME: '2026-05-01T12:00:00.000Z',
      DURABULL_RELEASE_CHANNEL: 'desktop',
    })

    expect(getAppVersionPayload({ version: '2.0.0', buildId: 'client-build' })).toEqual({
      version: '2.0.0',
      buildId: 'server-build',
      buildTime: '2026-05-01T12:00:00.000Z',
      releaseChannel: 'desktop',
      update: {
        required: true,
        reason: 'build_mismatch',
      },
    })
  })

  it('does not create a false build mismatch when the API has no distinct build id', async () => {
    const { getAppVersionPayload } = await importBuildInfo({
      DURABULL_APP_VERSION: '2.0.0',
    })

    expect(getAppVersionPayload({ version: '2.0.0', buildId: 'client-build' })).toMatchObject({
      buildId: '2.0.0',
      update: {
        required: false,
        reason: 'up_to_date',
      },
    })
  })

  it('does not require an update when the client version is missing or unknown', async () => {
    const { getAppVersionPayload } = await importBuildInfo({
      DURABULL_APP_VERSION: '2.0.0',
      DURABULL_BUILD_ID: 'server-build',
    })

    expect(getAppVersionPayload({ version: 'unknown', buildId: 'client-build' })).toMatchObject({
      update: {
        required: false,
        reason: 'missing_client_version',
      },
    })
    expect(getAppVersionPayload()).toMatchObject({
      update: {
        required: false,
        reason: 'missing_client_version',
      },
    })
  })

  it('uses hosted commit metadata as the build id fallback', async () => {
    const { getAppVersionPayload } = await importBuildInfo({
      DURABULL_APP_VERSION: '2.0.0',
      GITHUB_SHA: 'github-build',
      VERCEL_GIT_COMMIT_SHA: 'vercel-build',
    })

    expect(getAppVersionPayload({ version: '2.0.0', buildId: 'vercel-build' })).toMatchObject({
      buildId: 'vercel-build',
      update: {
        required: false,
        reason: 'up_to_date',
      },
    })
  })
})
