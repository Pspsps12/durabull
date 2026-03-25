import { describe, expect, it } from 'bun:test'
import {
  evaluateFailureRate,
  evaluateFailureThreshold,
  evaluateQueueStalled,
  type CursorState,
  type QueueSnapshot,
} from './alert-evaluator'

function createSnapshot(overrides: Partial<QueueSnapshot> = {}): QueueSnapshot {
  return {
    queueName: 'email-send',
    connectionName: 'Primary Redis',
    jobCounts: {
      failed: 42,
      waiting: 0,
      active: 0,
      completed: 200,
    },
    failedMetrics: {
      count: 42,
      dataPoints: [3, 2, 4],
    },
    completedMetrics: {
      count: 200,
      dataPoints: [40, 35, 20],
    },
    ...overrides,
  }
}

describe('alert evaluator', () => {
  it('fires failure threshold only on new failures beyond the cursor delta', () => {
    const cursor: CursorState = {
      lastFailedCount: 35,
      lastCompletedCount: 180,
      lastCheckedAt: new Date(Date.now() - 5 * 60_000),
    }

    const evaluation = evaluateFailureThreshold(
      { count: 5, windowMinutes: 5 },
      createSnapshot({
        jobCounts: { failed: 42, waiting: 0, active: 0, completed: 200 },
      }),
      cursor
    )

    expect(evaluation.triggered).toBe(true)
    expect(evaluation.context.delta).toBe(7)
  })

  it('uses metric datapoints when calculating failure rate', () => {
    const evaluation = evaluateFailureRate(
      { rate: 0.2, windowMinutes: 15, minSample: 20 },
      createSnapshot({
        failedMetrics: { count: 500, dataPoints: [4, 4, 4] },
        completedMetrics: { count: 500, dataPoints: [20, 20, 20] },
      })
    )

    expect(evaluation.triggered).toBe(false)
    expect(evaluation.context.failedInWindow).toBe(12)
    expect(evaluation.context.completedInWindow).toBe(60)
  })

  it('detects a stalled queue when work is present and completions stop', () => {
    const cursor: CursorState = {
      lastFailedCount: 5,
      lastCompletedCount: 220,
      lastCheckedAt: new Date(Date.now() - 20 * 60_000),
    }

    const evaluation = evaluateQueueStalled(
      { stalledMinutes: 10 },
      createSnapshot({
        jobCounts: { failed: 42, waiting: 8, active: 2, completed: 220 },
        completedMetrics: { count: 0, dataPoints: [0, 0, 0] },
      }),
      cursor
    )

    expect(evaluation.triggered).toBe(true)
    expect(evaluation.summary).toContain('appears stalled')
  })
})
