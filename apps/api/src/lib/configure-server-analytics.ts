import {
  configureServerAnalytics,
  DURABULL_CLOUD_API_HOST,
  DEFAULT_CLOUD_COLLECT_URL,
  TELEMETRY_DISCLOSURE_URL,
} from '@durabull/analytics/server'
import { getDatabaseMode, shouldUseEnvConnections, telemetryInstallationRepository } from '@durabull/dal'
import { env } from '@durabull/env'

import { isAuthlessMode } from './authless'

function isDurabullManagedPosthogProject(): boolean {
  if (env.DURABULL_CLOUD === true) return true

  try {
    return new URL(env.APP_BASE_URL).hostname === DURABULL_CLOUD_API_HOST
  } catch {
    return false
  }
}

function getDurabullTelemetryPosthogKey(): string | null {
  return env.DURABULL_TELEMETRY_POSTHOG_KEY?.trim() || env.POSTHOG_KEY?.trim() || null
}

let cachedAnonymousInstanceId: string | null = null
let anonymousInstanceIdInflight: Promise<string> | null = null

async function resolveAnonymousInstanceIdSingleFlight(): Promise<string> {
  if (cachedAnonymousInstanceId) {
    return cachedAnonymousInstanceId
  }

  anonymousInstanceIdInflight ??= (async () => {
    const existing = await telemetryInstallationRepository.readAnonymousInstanceId()
    const id = existing ?? (await telemetryInstallationRepository.getOrCreateAnonymousInstanceId())
    cachedAnonymousInstanceId = id
    return id
  })()

  return anonymousInstanceIdInflight
}

export function bootstrapServerAnalytics(): void {
  const appPosthogKey = env.POSTHOG_KEY?.trim() || null
  const durabullTelemetryPosthogKey = getDurabullTelemetryPosthogKey()

  configureServerAnalytics({
    enabled: env.NODE_ENV === 'production' && env.CI !== true,
    collectEnabled: env.DURABULL_CLOUD === true || isDurabullManagedPosthogProject(),
    dedupeIdentifiedPosthogEvents:
      !!appPosthogKey &&
      isDurabullManagedPosthogProject() &&
      durabullTelemetryPosthogKey === appPosthogKey,
    disclosureUrl: TELEMETRY_DISCLOSURE_URL,
    collectSigningSecret: env.DURABULL_TELEMETRY_COLLECT_SECRET?.trim() || null,
    hmacSecret:
      env.DURABULL_TELEMETRY_HMAC_SECRET?.trim() || env.BETTER_AUTH_SECRET?.trim() || null,
    durabullTelemetryPosthogKey,
    durabullTelemetryPosthogHost: env.DURABULL_TELEMETRY_POSTHOG_HOST?.trim() || null,
    appPosthogKey,
    appPosthogHost: env.POSTHOG_HOST?.trim() || null,
    cloudCollectUrl: DEFAULT_CLOUD_COLLECT_URL,
    getRuntimeContext: () => ({
      authless: isAuthlessMode(),
      env_connections: shouldUseEnvConnections(),
      environment: env.NODE_ENV ?? 'development',
      persistence: getDatabaseMode(),
      stateless: getDatabaseMode() === 'pglite',
    }),
    resolveAnonymousInstanceId: resolveAnonymousInstanceIdSingleFlight,
  })

  if (env.NODE_ENV === 'production' && env.CI !== true) {
    void resolveAnonymousInstanceIdSingleFlight().catch(() => {
      // Warm cache at bootstrap; telemetry must never block API startup.
    })
  }
}

/** Test-only: clear cached installation id when re-bootstrapping. */
export function resetCachedAnonymousInstanceIdForTests(): void {
  cachedAnonymousInstanceId = null
  anonymousInstanceIdInflight = null
}
