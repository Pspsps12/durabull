import type { AlertRule } from '@durabull/dal'

export interface AlertEvaluation {
  triggered: boolean
  summary: string
  context: Record<string, unknown>
}

export interface QueueSnapshot {
  queueName: string
  connectionName: string
  jobCounts: { failed: number; waiting: number; active: number; completed: number }
  failedMetrics: { count: number; dataPoints: number[] }
  completedMetrics: { count: number; dataPoints: number[] }
}

export interface CursorState {
  lastFailedCount: number
  lastCompletedCount: number
  lastCheckedAt: Date
}

export interface FailureThresholdConfig {
  count: number
  windowMinutes: number
}

export interface FailureRateConfig {
  rate: number
  windowMinutes: number
  minSample: number
}

export interface QueueStalledConfig {
  stalledMinutes: number
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/**
 * failure_threshold: ">= N NEW failures in M minutes"
 * Uses cursor delta so old failures don't re-trigger.
 */
export function evaluateFailureThreshold(
  config: FailureThresholdConfig,
  snapshot: QueueSnapshot,
  cursor: CursorState | null
): AlertEvaluation {
  const currentFailed = snapshot.jobCounts.failed
  const previousFailed = cursor?.lastFailedCount ?? 0
  const delta = Math.max(0, currentFailed - previousFailed)
  const triggered = delta >= config.count

  return {
    triggered,
    summary: triggered
      ? `${delta} jobs failed in ${snapshot.queueName} (last ${config.windowMinutes} min, threshold: ${config.count})`
      : '',
    context: {
      delta,
      currentFailed,
      previousFailed,
      threshold: config.count,
      windowMinutes: config.windowMinutes,
    },
  }
}

/**
 * failure_rate: "failure rate > X% over M minutes"
 * Uses BullMQ metrics count within retention window.
 */
export function evaluateFailureRate(
  config: FailureRateConfig,
  snapshot: QueueSnapshot
): AlertEvaluation {
  const failedInWindow =
    snapshot.failedMetrics.dataPoints.length > 0
      ? sum(snapshot.failedMetrics.dataPoints)
      : snapshot.failedMetrics.count
  const completedInWindow =
    snapshot.completedMetrics.dataPoints.length > 0
      ? sum(snapshot.completedMetrics.dataPoints)
      : snapshot.completedMetrics.count
  const totalProcessed = failedInWindow + completedInWindow

  if (totalProcessed < config.minSample) {
    return {
      triggered: false,
      summary: '',
      context: { failedInWindow, completedInWindow, totalProcessed, minSample: config.minSample },
    }
  }

  const rate = failedInWindow / totalProcessed
  const triggered = rate > config.rate

  return {
    triggered,
    summary: triggered
      ? `${(rate * 100).toFixed(1)}% failure rate in ${snapshot.queueName} (${failedInWindow}/${totalProcessed} jobs, threshold: ${(config.rate * 100).toFixed(0)}%)`
      : '',
    context: {
      rate,
      failedInWindow,
      completedInWindow,
      totalProcessed,
      threshold: config.rate,
      windowMinutes: config.windowMinutes,
    },
  }
}

/**
 * queue_stalled: waiting/active jobs with no completions for configured window.
 */
export function evaluateQueueStalled(
  config: QueueStalledConfig,
  snapshot: QueueSnapshot,
  cursor: CursorState | null
): AlertEvaluation {
  const hasWorkInQueue = snapshot.jobCounts.waiting > 0 || snapshot.jobCounts.active > 0
  const completedInWindow =
    snapshot.completedMetrics.dataPoints.length > 0
      ? sum(snapshot.completedMetrics.dataPoints)
      : snapshot.completedMetrics.count
  const completionDelta = cursor
    ? Math.max(0, snapshot.jobCounts.completed - cursor.lastCompletedCount)
    : 0
  const minutesSinceLastCheck = cursor
    ? (Date.now() - cursor.lastCheckedAt.getTime()) / 60_000
    : Number.POSITIVE_INFINITY

  const triggered =
    hasWorkInQueue &&
    completedInWindow === 0 &&
    completionDelta === 0 &&
    minutesSinceLastCheck >= config.stalledMinutes

  return {
    triggered,
    summary: triggered
      ? `${snapshot.queueName} appears stalled: ${snapshot.jobCounts.waiting} waiting, ${snapshot.jobCounts.active} active, 0 completions in last ${config.stalledMinutes} min`
      : '',
    context: {
      waiting: snapshot.jobCounts.waiting,
      active: snapshot.jobCounts.active,
      completedInWindow,
      completionDelta,
      stalledMinutes: config.stalledMinutes,
      minutesSinceLastCheck,
    },
  }
}

export function evaluateRule(
  rule: AlertRule,
  snapshot: QueueSnapshot,
  cursor: CursorState | null
): AlertEvaluation {
  const config = (rule.config ?? {}) as Record<string, unknown>

  switch (rule.type) {
    case 'failure_threshold':
      return evaluateFailureThreshold(config as unknown as FailureThresholdConfig, snapshot, cursor)
    case 'failure_rate':
      return evaluateFailureRate(config as unknown as FailureRateConfig, snapshot)
    case 'queue_stalled':
      return evaluateQueueStalled(config as unknown as QueueStalledConfig, snapshot, cursor)
    default:
      return { triggered: false, summary: `Unknown rule type: ${rule.type}`, context: {} }
  }
}
