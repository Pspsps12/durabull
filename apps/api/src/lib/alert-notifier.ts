import {
  alertDeliveryRepository,
  decryptSecret,
  eq,
  getDb,
  linearIntegrationRepository,
  linearJobIssueRepository,
  organization,
  type AlertDelivery,
  type AlertEvent,
  type RedisConnection,
} from '@durabull/dal'
import { isEmailConfigured } from '@durabull/email'
import { env } from '@durabull/env'
import { createLinearIssue, LinearApiError } from './linear-client'

export type NotificationChannel =
  | {
      type: 'email'
      target: string
    }
  | {
      type: 'linear'
      target: 'org-default'
      teamId?: string
      projectId?: string
      labelIds?: string[]
      assigneeId?: string
      stateId?: string
      priority?: number
    }

export async function dispatchAlertNotification(
  event: AlertEvent,
  channels: NotificationChannel[],
  connection: RedisConnection,
  ruleName: string
): Promise<void> {
  const deliveries = channels.map((channel) => ({
    alertEventId: event.id,
    organizationId: event.organizationId,
    channelType: channel.type,
    target: getDeliveryTarget(channel),
    providerMetadata: channel,
  }))

  await alertDeliveryRepository.enqueueMany(deliveries)
  await processAlertDeliveries(event, connection, ruleName)
}

export async function processAlertDeliveries(
  event: AlertEvent,
  connection: RedisConnection,
  ruleName: string
): Promise<void> {
  const dueDeliveries = await alertDeliveryRepository.claimDueForEvent(event.id)
  if (dueDeliveries.length === 0) return

  const organizationSlug = await getOrganizationSlug(event.organizationId)

  for (const delivery of dueDeliveries) {
    try {
      switch (delivery.channelType) {
        case 'email':
          await sendAlertEmail(delivery.target, event, connection, ruleName, organizationSlug)
          await alertDeliveryRepository.markDelivered(delivery.id)
          break
        case 'linear':
          await sendLinearAlert(delivery, event, connection, ruleName, organizationSlug)
          break
        default:
          await alertDeliveryRepository.markFailed(delivery.id, {
            error: `Unknown channel type: ${delivery.channelType}`,
            retryable: false,
          })
      }
    } catch (error) {
      const retry = classifyDeliveryFailure(error, delivery.attemptCount + 1)
      await alertDeliveryRepository.markFailed(delivery.id, retry)
    }
  }
}

function getDeliveryTarget(channel: NotificationChannel): string {
  if (channel.type === 'email') return channel.target
  return [
    'org-default',
    channel.teamId ?? '',
    channel.projectId ?? '',
    channel.assigneeId ?? '',
    channel.stateId ?? '',
    channel.priority ?? '',
    ...(channel.labelIds ?? []),
  ].join(':')
}

async function sendAlertEmail(
  to: string,
  event: AlertEvent,
  connection: RedisConnection,
  ruleName: string,
  organizationSlug: string | null
): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn('[alert-notifier] RESEND_API_KEY not configured, skipping email')
    return
  }

  const { sendAlertNotificationEmail } = await import('@durabull/email')
  const { dashboardUrl, muteUrl } = buildAlertAppUrls({
    appBaseUrl: env.APP_BASE_URL,
    organizationSlug,
    connectionId: connection.id,
    queueName: event.queueName,
    alertRuleId: event.alertRuleId,
  })

  await sendAlertNotificationEmail({
    to,
    alertRuleName: ruleName,
    queueName: event.queueName,
    connectionName: connection.name,
    summary: event.summary,
    firedAt: event.firedAt,
    context: (event.context ?? {}) as Record<string, unknown>,
    dashboardUrl,
    muteUrl,
  })
}

async function sendLinearAlert(
  delivery: AlertDelivery,
  event: AlertEvent,
  connection: RedisConnection,
  ruleName: string,
  organizationSlug: string | null
): Promise<void> {
  const integration = await linearIntegrationRepository.findByOrganization(event.organizationId)
  if (!integration) {
    throw new LinearApiError('Linear integration is not configured for this organization.', {
      status: 400,
      retryable: false,
    })
  }

  const channel = parseLinearChannel(delivery.providerMetadata)
  const teamId = channel.teamId ?? integration.defaultTeamId
  if (!teamId) {
    throw new LinearApiError('Linear team is required before alert delivery can create issues.', {
      status: 400,
      retryable: false,
    })
  }

  const jobContext = getJobContext(event.context)
  const { jobUrl } = buildAlertAppUrls({
    appBaseUrl: env.APP_BASE_URL,
    organizationSlug,
    connectionId: connection.id,
    queueName: event.queueName,
    alertRuleId: event.alertRuleId,
    jobId: jobContext.jobId,
  })

  const apiKey = decryptSecret(integration.encryptedApiKey)
  const issue = await createLinearIssue(apiKey, {
    teamId,
    title: buildLinearIssueTitle(event, connection, ruleName, jobContext.jobName),
    description: buildLinearIssueDescription({
      event,
      connection,
      ruleName,
      jobUrl,
      jobContext,
    }),
    projectId: channel.projectId ?? integration.defaultProjectId,
    labelIds: channel.labelIds?.length ? channel.labelIds : integration.defaultLabelIds,
    assigneeId: channel.assigneeId ?? integration.defaultAssigneeId,
    stateId: channel.stateId ?? integration.defaultStateId,
    priority: channel.priority ?? integration.defaultPriority,
  })

  await alertDeliveryRepository.markDelivered(delivery.id, {
    externalId: issue.id,
    externalIdentifier: issue.identifier,
    externalUrl: issue.url,
    providerMetadata: {
      ...((delivery.providerMetadata ?? {}) as Record<string, unknown>),
      issue,
    },
  })

  if (jobContext.jobId) {
    await linearJobIssueRepository.createOrGet({
      organizationId: event.organizationId,
      connectionId: event.connectionId,
      queueName: event.queueName,
      jobId: jobContext.jobId,
      alertEventId: event.id,
      linearIssueId: issue.id,
      linearIssueIdentifier: issue.identifier,
      linearIssueUrl: issue.url,
    })
  }
}

function parseLinearChannel(value: unknown): Extract<NotificationChannel, { type: 'linear' }> {
  const source =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  return {
    type: 'linear',
    target: 'org-default',
    teamId: typeof source.teamId === 'string' ? source.teamId : undefined,
    projectId: typeof source.projectId === 'string' ? source.projectId : undefined,
    labelIds: Array.isArray(source.labelIds)
      ? source.labelIds.filter((label): label is string => typeof label === 'string')
      : undefined,
    assigneeId: typeof source.assigneeId === 'string' ? source.assigneeId : undefined,
    stateId: typeof source.stateId === 'string' ? source.stateId : undefined,
    priority: typeof source.priority === 'number' ? source.priority : undefined,
  }
}

function getJobContext(context: unknown): {
  jobId: string | null
  jobName: string | null
  failedReason: string | null
  attemptsMade: number | null
  attempts: number | null
  failedAt: string | null
} {
  const source =
    typeof context === 'object' && context !== null ? (context as Record<string, unknown>) : {}
  return {
    jobId: typeof source.jobId === 'string' ? source.jobId : null,
    jobName: typeof source.jobName === 'string' ? source.jobName : null,
    failedReason: typeof source.failedReason === 'string' ? source.failedReason : null,
    attemptsMade: typeof source.attemptsMade === 'number' ? source.attemptsMade : null,
    attempts: typeof source.attempts === 'number' ? source.attempts : null,
    failedAt: typeof source.failedAt === 'string' ? source.failedAt : null,
  }
}

function buildLinearIssueTitle(
  event: AlertEvent,
  connection: RedisConnection,
  ruleName: string,
  jobName: string | null
): string {
  if (event.type === 'job_failed') {
    return `[Durabull] ${connection.name}/${event.queueName} job failed${jobName ? `: ${jobName}` : ''}`
  }

  return `[Durabull] ${ruleName} fired for ${connection.name}/${event.queueName}`
}

function buildLinearIssueDescription({
  event,
  connection,
  ruleName,
  jobUrl,
  jobContext,
}: {
  event: AlertEvent
  connection: RedisConnection
  ruleName: string
  jobUrl: string
  jobContext: ReturnType<typeof getJobContext>
}): string {
  const lines = [
    `Durabull alert rule **${ruleName}** fired.`,
    '',
    `- Connection: ${connection.name}`,
    `- Queue: ${event.queueName}`,
    `- Summary: ${event.summary}`,
    `- Fired at: ${event.firedAt.toISOString()}`,
  ]

  if (jobContext.jobId) lines.push(`- Job ID: ${jobContext.jobId}`)
  if (jobContext.jobName) lines.push(`- Job name: ${jobContext.jobName}`)
  if (jobContext.failedReason) lines.push(`- Failure reason: ${jobContext.failedReason}`)
  if (jobContext.attemptsMade !== null) {
    lines.push(`- Attempts made: ${jobContext.attemptsMade}`)
  }
  if (jobContext.attempts !== null) lines.push(`- Max attempts: ${jobContext.attempts}`)
  if (jobContext.failedAt) lines.push(`- Failed at: ${jobContext.failedAt}`)
  lines.push('', `[Open in Durabull](${jobUrl})`)

  return lines.join('\n')
}

function classifyDeliveryFailure(
  error: unknown,
  attemptCount: number
): { error: string; retryable: boolean; nextRetryAt?: Date | null } {
  const message = error instanceof Error ? error.message : String(error)
  const retryable = error instanceof LinearApiError ? error.retryable : true
  if (!retryable) return { error: message, retryable: false }

  const resetAt = error instanceof LinearApiError ? error.rateLimitResetAt : null
  const backoffMs = Math.min(60 * 60 * 1000, 2 ** Math.max(0, attemptCount - 1) * 30_000)
  return {
    error: message,
    retryable: true,
    nextRetryAt:
      resetAt && resetAt.getTime() > Date.now() ? resetAt : new Date(Date.now() + backoffMs),
  }
}

async function getOrganizationSlug(organizationId: string): Promise<string | null> {
  const db = await getDb()
  const rows = await db
    .select({ slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1)

  return rows[0]?.slug ?? null
}

export function buildAlertAppUrls({
  appBaseUrl,
  organizationSlug,
  connectionId,
  queueName,
  alertRuleId,
  jobId,
}: {
  appBaseUrl: string
  organizationSlug: string | null
  connectionId: string
  queueName: string
  alertRuleId: string
  jobId?: string | null
}): { dashboardUrl: string; muteUrl: string; jobUrl: string } {
  const baseUrl = appBaseUrl.replace(/\/+$/, '')

  if (!organizationSlug) {
    console.warn('[alert-notifier] Missing organization slug for alert email links')
    return {
      dashboardUrl: baseUrl,
      muteUrl: baseUrl,
      jobUrl: baseUrl,
    }
  }

  const orgSegment = encodeURIComponent(organizationSlug)
  const connectionSegment = encodeURIComponent(connectionId)
  const queueSegment = encodeURIComponent(queueName)
  const ruleQuery = new URLSearchParams({ ruleId: alertRuleId }).toString()

  return {
    dashboardUrl: `${baseUrl}/${orgSegment}/c/${connectionSegment}/queues/${queueSegment}`,
    jobUrl: jobId
      ? `${baseUrl}/${orgSegment}/c/${connectionSegment}/queues/${queueSegment}/jobs/${encodeURIComponent(jobId)}`
      : `${baseUrl}/${orgSegment}/c/${connectionSegment}/queues/${queueSegment}`,
    muteUrl: `${baseUrl}/${orgSegment}/c/${connectionSegment}/alerts?${ruleQuery}`,
  }
}
