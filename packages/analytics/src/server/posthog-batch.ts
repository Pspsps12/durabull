import type { ServerAnalyticsRuntimeContext } from './config'

export interface PosthogBatchCapture {
  event: string
  /** Already sanitized properties; runtime is not re-merged when mergeRuntime is false. */
  properties: Record<string, unknown>
  timestamp?: string
  distinctId: string
  processPersonProfile: boolean
  organizationId?: string | null
}

export interface PosthogBatchClientConfig {
  posthogBatchUrl: string
  posthogKey: string
}

export const DEFAULT_POSTHOG_BATCH_HOST = 'https://us.i.posthog.com'

export function resolvePosthogBatchUrl(rawHost: string | undefined): string | null {
  const hostWithProtocol = rawHost?.trim()
    ? /^https?:\/\//i.test(rawHost)
      ? rawHost
      : `https://${rawHost}`
    : DEFAULT_POSTHOG_BATCH_HOST

  try {
    const parsed = new URL(hostWithProtocol)
    const basePath = parsed.pathname.replace(/\/$/, '')
    const batchPath = basePath.endsWith('/batch') ? basePath : `${basePath}/batch`
    return `${parsed.origin}${batchPath}/`
  } catch {
    return null
  }
}

export async function sendPosthogBatch(
  config: PosthogBatchClientConfig,
  captures: PosthogBatchCapture[],
  options: {
    runtimeContext?: ServerAnalyticsRuntimeContext
    mergeRuntime?: boolean
  } = {}
): Promise<boolean> {
  if (captures.length === 0) return true

  const mergeRuntime = options.mergeRuntime ?? true
  const runtimeContext = options.runtimeContext ?? {
    authless: false,
    env_connections: false,
    environment: 'unknown',
    persistence: 'unknown',
    stateless: false,
  }

  const batch = captures.map((capture) => {
    const properties: Record<string, unknown> = {
      ...(mergeRuntime ? runtimeContext : {}),
      ...capture.properties,
      $geoip_disable: true,
      $process_person_profile: capture.processPersonProfile,
      distinct_id: capture.distinctId,
    }

    if (capture.organizationId) {
      properties.$groups = {
        organization: capture.organizationId,
      }
    }

    return {
      event: capture.event,
      properties,
      timestamp: capture.timestamp ?? new Date().toISOString(),
    }
  })

  const response = await fetch(config.posthogBatchUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: config.posthogKey,
      batch,
    }),
  })

  return response.ok
}
