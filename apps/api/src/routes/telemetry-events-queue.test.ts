import { afterEach, describe, expect, it, mock } from 'bun:test'

import { enqueueTelemetryEvent, resetTelemetryEventsQueueForTests } from './telemetry-events-queue'

describe('telemetry events queue', () => {
  afterEach(() => {
    resetTelemetryEventsQueueForTests()
  })

  it('rejects new events when the bounded queue is full', () => {
    const process = mock(async () => new Promise<void>(() => {}))
    const input = {
      event: 'queue_paused',
      properties: { success: true },
      sessionId: 'session-1',
      timestamp: '2026-05-28T00:00:00.000Z',
    }

    for (let i = 0; i < 4 + 256; i += 1) {
      expect(enqueueTelemetryEvent(input, process)).toBe(true)
    }

    expect(enqueueTelemetryEvent(input, process)).toBe(false)
  })
})
