import { afterEach, describe, expect, it, mock } from 'bun:test'
import { AnalyticsEvents } from '@durabull/analytics/events'

import { enqueueMcpAnalytics, resetMcpAnalyticsQueueForTests } from './mcp-analytics-queue'
import type { McpAnalyticsInput } from './mcp-analytics'

const originalWarn = console.warn

describe('mcp analytics queue', () => {
  afterEach(() => {
    console.warn = originalWarn
    resetMcpAnalyticsQueueForTests()
  })

  it('warns when dropping events because the queue is full', () => {
    const warn = mock(() => {})
    console.warn = warn as unknown as typeof console.warn
    const process = mock(async () => new Promise<void>(() => {}))
    const input: McpAnalyticsInput = {
      event: AnalyticsEvents.MCP_TOOL_CALLED,
      properties: { tool_name: 'list_jobs', response_class: 'success' },
    }

    for (let i = 0; i < 8 + 512 + 1; i += 1) {
      enqueueMcpAnalytics(input, process)
    }

    expect(warn).toHaveBeenCalledWith('[analytics] MCP analytics queue full; dropping event')
  })
})
