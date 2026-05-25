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
    console.warn('[alert-app-urls] Missing organization slug for alert links')
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
