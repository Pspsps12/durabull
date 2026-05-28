import {
  ingestTelemetryCollectBatch,
  type IngestCollectBatchResult,
  type ServerAnalyticsRuntimeContext,
  type TelemetryCollectEventInput,
} from '@durabull/analytics/server'

interface TelemetryCollectQueueItem {
  instanceId: string
  sentAt?: string
  events: TelemetryCollectEventInput[]
  clientRuntime?: ServerAnalyticsRuntimeContext
}

const MAX_COLLECT_IN_FLIGHT = 4
const MAX_COLLECT_QUEUE_DEPTH = 256

let collectInFlight = 0
const pendingCollectBatches: TelemetryCollectQueueItem[] = []

type ProcessCollectBatch = (input: TelemetryCollectQueueItem) => Promise<IngestCollectBatchResult>

function logCollectFailure(result: IngestCollectBatchResult): void {
  if (result.ok) return
  console.warn(`[analytics] async /collect batch failed: ${result.error}`)
}

function dispatchCollectBatch(input: TelemetryCollectQueueItem, process: ProcessCollectBatch): void {
  collectInFlight += 1
  void process(input)
    .then(logCollectFailure)
    .catch(() => {
      console.warn('[analytics] async /collect batch threw unexpectedly')
    })
    .finally(() => {
      collectInFlight -= 1
      flushPendingCollectBatches(process)
    })
}

function flushPendingCollectBatches(process: ProcessCollectBatch): void {
  while (collectInFlight < MAX_COLLECT_IN_FLIGHT && pendingCollectBatches.length > 0) {
    const next = pendingCollectBatches.shift()
    if (!next) break
    dispatchCollectBatch(next, process)
  }
}

export function enqueueTelemetryCollectBatch(
  input: TelemetryCollectQueueItem,
  process: ProcessCollectBatch = ingestTelemetryCollectBatch
): boolean {
  if (collectInFlight < MAX_COLLECT_IN_FLIGHT && pendingCollectBatches.length === 0) {
    dispatchCollectBatch(input, process)
    return true
  }

  if (pendingCollectBatches.length >= MAX_COLLECT_QUEUE_DEPTH) {
    return false
  }

  pendingCollectBatches.push(input)
  flushPendingCollectBatches(process)
  return true
}

/** Test-only */
export function resetTelemetryCollectQueueForTests(): void {
  collectInFlight = 0
  pendingCollectBatches.length = 0
}
