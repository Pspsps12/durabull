import type { McpAnalyticsInput } from './mcp-analytics'

const MAX_ANALYTICS_IN_FLIGHT = 8
const MAX_ANALYTICS_QUEUE_DEPTH = 512

let analyticsInFlight = 0
const pendingAnalytics: McpAnalyticsInput[] = []

export type ProcessMcpAnalytics = (input: McpAnalyticsInput) => Promise<void>

export function enqueueMcpAnalytics(
  input: McpAnalyticsInput,
  process: ProcessMcpAnalytics
): void {
  if (analyticsInFlight < MAX_ANALYTICS_IN_FLIGHT && pendingAnalytics.length === 0) {
    dispatchMcpAnalytics(input, process)
    return
  }

  if (pendingAnalytics.length >= MAX_ANALYTICS_QUEUE_DEPTH) {
    console.warn('[analytics] MCP analytics queue full; dropping event')
    return
  }

  pendingAnalytics.push(input)
  flushPendingMcpAnalytics(process)
}

function dispatchMcpAnalytics(input: McpAnalyticsInput, process: ProcessMcpAnalytics): void {
  analyticsInFlight += 1
  void process(input)
    .catch(() => {
      // Analytics must never affect MCP behavior.
    })
    .finally(() => {
      analyticsInFlight -= 1
      flushPendingMcpAnalytics(process)
    })
}

function flushPendingMcpAnalytics(process: ProcessMcpAnalytics): void {
  while (analyticsInFlight < MAX_ANALYTICS_IN_FLIGHT && pendingAnalytics.length > 0) {
    const next = pendingAnalytics.shift()
    if (!next) break
    dispatchMcpAnalytics(next, process)
  }
}

/** Test-only */
export function resetMcpAnalyticsQueueForTests(): void {
  analyticsInFlight = 0
  pendingAnalytics.length = 0
}
