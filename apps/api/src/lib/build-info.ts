import rootPackage from '../../../../package.json'

declare const __DURABULL_APP_VERSION__: string | undefined
declare const __DURABULL_BUILD_ID__: string | undefined
declare const __DURABULL_BUILD_TIME__: string | null | undefined

const DEFAULT_RELEASE_CHANNEL = 'stable'
const EMBEDDED_APP_VERSION =
  typeof __DURABULL_APP_VERSION__ === 'undefined' ? undefined : __DURABULL_APP_VERSION__
const EMBEDDED_BUILD_ID =
  typeof __DURABULL_BUILD_ID__ === 'undefined' ? undefined : __DURABULL_BUILD_ID__
const EMBEDDED_BUILD_TIME =
  typeof __DURABULL_BUILD_TIME__ === 'undefined' ? undefined : __DURABULL_BUILD_TIME__

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }

  return null
}

function normalizeBuildId(value: string | null): string {
  return value ?? APP_VERSION
}

export const APP_VERSION =
  firstNonEmpty(process.env.DURABULL_APP_VERSION, EMBEDDED_APP_VERSION, rootPackage.version) ??
  '0.0.0'
export const APP_BUILD_ID = normalizeBuildId(
  firstNonEmpty(
    process.env.DURABULL_BUILD_ID,
    EMBEDDED_BUILD_ID,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.GITHUB_SHA
  )
)
export const APP_BUILD_TIME = firstNonEmpty(
  process.env.DURABULL_BUILD_TIME,
  EMBEDDED_BUILD_TIME ?? undefined
)
export const APP_RELEASE_CHANNEL =
  firstNonEmpty(process.env.DURABULL_RELEASE_CHANNEL) ?? DEFAULT_RELEASE_CHANNEL

export type AppUpdateReason =
  | 'build_mismatch'
  | 'missing_client_version'
  | 'up_to_date'
  | 'version_mismatch'

export interface AppVersionPayload {
  version: string
  buildId: string
  buildTime: string | null
  releaseChannel: string
  update: {
    required: boolean
    reason: AppUpdateReason
  }
}

interface ClientBuildInfo {
  version?: string | null
  buildId?: string | null
}

function normalizeClientValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed && trimmed !== 'unknown' ? trimmed : null
}

function hasDistinctBuildId(version: string | null, buildId: string | null): boolean {
  return Boolean(version && buildId && buildId !== version)
}

export function getAppVersionPayload(clientBuild: ClientBuildInfo = {}): AppVersionPayload {
  const clientVersion = normalizeClientValue(clientBuild.version)
  const clientBuildId = normalizeClientValue(clientBuild.buildId)
  const canCompareBuildIds =
    hasDistinctBuildId(APP_VERSION, APP_BUILD_ID) &&
    hasDistinctBuildId(clientVersion, clientBuildId)

  let required = false
  let reason: AppUpdateReason = 'up_to_date'

  if (!clientVersion) {
    reason = 'missing_client_version'
  } else if (canCompareBuildIds && clientBuildId !== APP_BUILD_ID) {
    required = true
    reason = 'build_mismatch'
  } else if (clientVersion !== APP_VERSION) {
    required = true
    reason = 'version_mismatch'
  }

  return {
    version: APP_VERSION,
    buildId: APP_BUILD_ID,
    buildTime: APP_BUILD_TIME,
    releaseChannel: APP_RELEASE_CHANNEL,
    update: {
      required,
      reason,
    },
  }
}
