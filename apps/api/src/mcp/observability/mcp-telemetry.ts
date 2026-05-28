export type McpTelemetrySignal =
  | 'auth_unauthorized'
  | 'auth_forbidden'
  | 'policy_denied'
  | 'rate_limited_ingress'
  | 'rate_limited_tool'
  | 'tool_success'
  | 'tool_error'
  | 'redaction_applied'
  | 'audit_dropped'
  | 'audit_write_failed'

export interface McpTelemetryEvent {
  signal: McpTelemetrySignal
  toolName?: string
  principalId?: string
  correlationId?: string
  count?: number
}

const signalTotals = new Map<McpTelemetrySignal, number>()
let telemetryLoggingEnabled = process.env.MCP_TELEMETRY_LOG !== 'false'

export function recordMcpTelemetry(event: McpTelemetryEvent): void {
  const increment = Math.max(1, event.count ?? 1)
  signalTotals.set(event.signal, (signalTotals.get(event.signal) ?? 0) + increment)

  if (!telemetryLoggingEnabled) return

  console.info(
    JSON.stringify({
      type: 'mcp_telemetry',
      signal: event.signal,
      toolName: event.toolName ?? null,
      correlationId: event.correlationId ?? null,
      count: increment,
    })
  )
}

/** Test-only helper for asserting telemetry counters. */
export function getMcpTelemetryTotalsForTests(): ReadonlyMap<McpTelemetrySignal, number> {
  return signalTotals
}

/** Test-only helper to reset counters between tests. */
export function resetMcpTelemetryForTests(): void {
  signalTotals.clear()
}

/** Test-only helper to disable stdout telemetry noise in tests. */
export function setMcpTelemetryLoggingForTests(enabled: boolean): void {
  telemetryLoggingEnabled = enabled
}
