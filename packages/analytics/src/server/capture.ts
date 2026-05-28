import {
  getServerAnalyticsOptions,
  tryGetServerAnalyticsOptions,
  type ServerAnalyticsOptions,
  type ServerAnalyticsRuntimeContext,
} from './config'
import {
  signTelemetryCollectBody,
  TELEMETRY_COLLECT_SIGNATURE_HEADER,
  TELEMETRY_COLLECT_TIMESTAMP_HEADER,
} from './collect-auth'
import {
  hashIdentifiedOrganizationDistinctId,
  hashIdentifiedUserDistinctId,
  hashTelemetryIdentifier,
} from './identifiers'
import {
  resolvePosthogBatchUrl,
  sendPosthogBatch,
  type PosthogBatchCapture,
  type PosthogBatchClientConfig,
} from './posthog-batch'
import { validateTelemetryPayload } from './validate'

interface DurabullTelemetryCollectConfig extends PosthogBatchClientConfig {
  collectSigningSecret: string
  hmacSecret: string
}

function getOptions(): ServerAnalyticsOptions | null {
  return tryGetServerAnalyticsOptions()
}

export function isDurabullTelemetryCollectConfigured(
  options: ServerAnalyticsOptions
): boolean {
  return getDurabullTelemetryCollectConfig(options) !== null
}

function getDurabullTelemetryCollectConfig(
  options: ServerAnalyticsOptions
): DurabullTelemetryCollectConfig | null {
  const posthogKey = options.durabullTelemetryPosthogKey
  const hmacSecret = options.hmacSecret
  const collectSigningSecret = options.collectSigningSecret
  const posthogBatchUrl = resolvePosthogBatchUrl(options.durabullTelemetryPosthogHost ?? undefined)

  if (!posthogKey || !hmacSecret || !collectSigningSecret || !posthogBatchUrl) return null

  return { collectSigningSecret, hmacSecret, posthogBatchUrl, posthogKey }
}

function getIdentifiedPosthogConfig(options: ServerAnalyticsOptions): PosthogBatchClientConfig | null {
  const posthogKey = options.appPosthogKey
  if (!posthogKey) return null

  const posthogBatchUrl = resolvePosthogBatchUrl(
    options.appPosthogHost ?? options.durabullTelemetryPosthogHost ?? undefined
  )
  if (!posthogBatchUrl) return null

  return { posthogBatchUrl, posthogKey }
}

function buildAnonymousCapture(input: {
  anonymousInstanceId: string
  sessionId: string
  event: string
  properties: Record<string, string | number | boolean | null>
  timestamp: string
  hmacSecret: string
}): PosthogBatchCapture {
  const distinctId = hashTelemetryIdentifier(
    `${input.anonymousInstanceId}:${input.sessionId}`,
    input.hmacSecret
  )
  const instanceKey = hashTelemetryIdentifier(input.anonymousInstanceId, input.hmacSecret)

  return {
    event: input.event,
    properties: {
      ...input.properties,
      instance_key: instanceKey,
    },
    distinctId,
    processPersonProfile: false,
    timestamp: input.timestamp,
  }
}

async function forwardAnonymousToCloudCollect(input: {
  cloudCollectUrl: string
  collectSigningSecret: string
  anonymousInstanceId: string
  event: string
  properties: Record<string, string | number | boolean | null>
  sessionId: string
  timestamp: string
  runtimeContext: ServerAnalyticsRuntimeContext
}): Promise<void> {
  const sentAt = new Date().toISOString()
  const rawBody = JSON.stringify({
    sentAt,
    instanceId: input.anonymousInstanceId,
    runtime: input.runtimeContext,
    events: [
      {
        event: input.event,
        properties: input.properties,
        sessionId: input.sessionId,
        timestamp: input.timestamp,
      },
    ],
  })
  const signedAt = Math.floor(Date.now() / 1000)
  const { signature, timestamp } = signTelemetryCollectBody(
    input.collectSigningSecret,
    signedAt,
    rawBody
  )

  const response = await fetch(input.cloudCollectUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [TELEMETRY_COLLECT_TIMESTAMP_HEADER]: timestamp,
      [TELEMETRY_COLLECT_SIGNATURE_HEADER]: signature,
    },
    body: rawBody,
    redirect: 'manual',
  })

  if (!response.ok) {
    console.warn(`[analytics] cloud collect forward failed with status ${response.status}`)
  }
}

export async function captureAnonymousServerEvent(input: {
  anonymousInstanceId: string
  event: string
  properties: Record<string, unknown>
  sessionId: string
  timestamp?: string
}): Promise<void> {
  const options = getOptions()
  if (!options?.enabled) return

  const runtimeContext = options.getRuntimeContext()
  const validated = validateTelemetryPayload(input.event, input.properties, runtimeContext)
  if (!validated.ok) return

  const timestamp = input.timestamp ?? new Date().toISOString()

  if (options.collectEnabled) {
    const config = getDurabullTelemetryCollectConfig(options)
    if (!config) return

    await sendPosthogBatch(
      config,
      [
        buildAnonymousCapture({
          anonymousInstanceId: input.anonymousInstanceId,
          sessionId: input.sessionId,
          event: validated.event,
          properties: validated.properties,
          timestamp,
          hmacSecret: config.hmacSecret,
        }),
      ],
      { runtimeContext, mergeRuntime: true }
    )
    return
  }

  if (!options.collectSigningSecret) {
    console.warn('[analytics] cloud collect forward skipped: missing collect signing secret')
    return
  }

  await forwardAnonymousToCloudCollect({
    cloudCollectUrl: options.cloudCollectUrl,
    collectSigningSecret: options.collectSigningSecret,
    anonymousInstanceId: input.anonymousInstanceId,
    event: validated.event,
    properties: validated.properties,
    sessionId: input.sessionId,
    timestamp,
    runtimeContext,
  })
}

export async function captureIdentifiedServerEvent(input: {
  event: string
  properties: Record<string, unknown>
  distinctId: string
  organizationId?: string | null
  timestamp?: string
}): Promise<void> {
  const options = getOptions()
  if (!options?.enabled) return

  const runtimeContext = options.getRuntimeContext()
  const validated = validateTelemetryPayload(input.event, input.properties, runtimeContext)
  if (!validated.ok) return

  const config = getIdentifiedPosthogConfig(options)
  if (!config) return

  const hmacSecret = options.hmacSecret
  const organizationGroup =
    input.organizationId && hmacSecret
      ? hashIdentifiedOrganizationDistinctId(input.organizationId, hmacSecret)
      : null

  await sendPosthogBatch(
    config,
    [
      {
        event: validated.event,
        properties: validated.properties,
        distinctId: input.distinctId,
        organizationId: organizationGroup,
        processPersonProfile: true,
        timestamp: input.timestamp,
      },
    ],
    { runtimeContext, mergeRuntime: true }
  )
}

export interface TelemetryCollectEventInput {
  event: string
  properties: Record<string, unknown>
  sessionId: string
  timestamp?: string
}

export type IngestCollectBatchResult =
  | { ok: true }
  | {
      ok: false
      error:
        | 'disabled'
        | 'not_configured'
        | 'unknown_event'
        | 'invalid_properties'
        | 'upstream_rejected'
        | 'upstream_unavailable'
    }

export async function ingestTelemetryCollectBatch(input: {
  instanceId: string
  sentAt?: string
  events: TelemetryCollectEventInput[]
  clientRuntime?: ServerAnalyticsRuntimeContext
}): Promise<IngestCollectBatchResult> {
  const options = getOptions()
  if (!options?.enabled) {
    return { ok: false, error: 'disabled' }
  }

  const config = getDurabullTelemetryCollectConfig(options)
  if (!config) {
    return { ok: false, error: 'not_configured' }
  }

  const runtimeContext = input.clientRuntime ?? options.getRuntimeContext()
  const batch: PosthogBatchCapture[] = []

  for (const event of input.events) {
    const validated = validateTelemetryPayload(event.event, event.properties, runtimeContext)
    if (!validated.ok) {
      return { ok: false, error: validated.error }
    }

    batch.push(
      buildAnonymousCapture({
        anonymousInstanceId: input.instanceId,
        sessionId: event.sessionId,
        event: validated.event,
        properties: validated.properties,
        timestamp: event.timestamp ?? input.sentAt ?? new Date().toISOString(),
        hmacSecret: config.hmacSecret,
      })
    )
  }

  try {
    const accepted = await sendPosthogBatch(config, batch, { mergeRuntime: false })
    return accepted ? { ok: true } : { ok: false, error: 'upstream_rejected' }
  } catch {
    return { ok: false, error: 'upstream_unavailable' }
  }
}

export function shouldDedupeIdentifiedPosthogEvents(): boolean {
  return getOptions()?.dedupeIdentifiedPosthogEvents ?? false
}

export function resolveIdentifiedDistinctIds(input: {
  userId?: string | null
  organizationId?: string | null
}): { distinctId: string | null; organizationGroup: string | null } {
  const options = getOptions()
  const secret = options?.hmacSecret
  if (!secret) {
    return { distinctId: null, organizationGroup: null }
  }

  if (input.userId) {
    return {
      distinctId: hashIdentifiedUserDistinctId(input.userId, secret),
      organizationGroup: input.organizationId
        ? hashIdentifiedOrganizationDistinctId(input.organizationId, secret)
        : null,
    }
  }

  if (input.organizationId) {
    const organizationGroup = hashIdentifiedOrganizationDistinctId(input.organizationId, secret)
    return {
      distinctId: organizationGroup,
      organizationGroup,
    }
  }

  return { distinctId: null, organizationGroup: null }
}

/** @deprecated Use getServerAnalyticsOptions().hmacSecret */
export function getTelemetryHmacSecret(): string | null {
  return getOptions()?.hmacSecret ?? null
}
