const SENSITIVE_KEY = /(secret|password|token|authorization|api[_-]?key|credential|redis|url)/i
const REDIS_URL_PATTERN = /redis(s)?:\/\/[^\s]+/gi
const MAX_MCP_TEXT_LENGTH = 500
const MAX_CONTEXT_DEPTH = 4
const MAX_CONTEXT_ARRAY_ITEMS = 50
const MAX_CONTEXT_STRING_LENGTH = 512

export function truncateMcpText(value: string, maxLength = MAX_MCP_TEXT_LENGTH): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}…`
}

export function sanitizeMcpText(value: string | null | undefined): string | null {
  if (value == null) return null
  const redacted = value.replace(REDIS_URL_PATTERN, '[redacted]').trim()
  if (!redacted) return null
  return truncateMcpText(redacted)
}

export function sanitizeAlertEventContext(
  context: unknown,
  depth = 0
): Record<string, unknown> | null {
  if (context == null || depth > MAX_CONTEXT_DEPTH) {
    return null
  }

  if (Array.isArray(context)) {
    const items = context
      .slice(0, MAX_CONTEXT_ARRAY_ITEMS)
      .map((item) => sanitizeAlertContextValue(item, depth + 1))
      .filter((item) => item !== undefined)
    return items.length > 0 ? { items } : null
  }

  if (typeof context !== 'object') {
    return null
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) {
      continue
    }
    const next = sanitizeAlertContextValue(value, depth + 1)
    if (next !== undefined) {
      sanitized[key] = next
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null
}

function sanitizeAlertContextValue(value: unknown, depth: number): unknown | undefined {
  if (value == null) return value
  if (typeof value === 'string') {
    const redacted = value.replace(REDIS_URL_PATTERN, '[redacted]')
    return truncateMcpText(redacted, MAX_CONTEXT_STRING_LENGTH)
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) {
    const nested = sanitizeAlertEventContext(value, depth)
    return nested ?? undefined
  }
  if (typeof value === 'object') {
    const nested = sanitizeAlertEventContext(value, depth)
    return nested ?? undefined
  }
  return undefined
}

export function toMcpAlertEventSummary(event: {
  id: string
  alertRuleId: string
  queueName: string
  type: string
  status: string
  summary: string
  firedAt: Date
  resolvedAt: Date | null
  context: unknown
}) {
  return {
    id: event.id,
    alertRuleId: event.alertRuleId,
    queueName: event.queueName,
    type: event.type,
    status: event.status,
    summary: sanitizeMcpText(event.summary) ?? '',
    firedAt: event.firedAt.toISOString(),
    resolvedAt: event.resolvedAt?.toISOString() ?? null,
    context: sanitizeAlertEventContext(event.context),
  }
}
