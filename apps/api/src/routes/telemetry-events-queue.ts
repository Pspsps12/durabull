import {
  captureAnonymousServerEvent,
  tryGetServerAnalyticsOptions,
} from '@durabull/analytics/server'

interface TelemetryEventQueueItem {
  event: string
  properties: Record<string, unknown>
  sessionId: string
  timestamp: string
}

const MAX_EVENTS_IN_FLIGHT = 4
const MAX_EVENTS_QUEUE_DEPTH = 256

let eventsInFlight = 0
const pendingEvents: TelemetryEventQueueItem[] = []

type ProcessTelemetryEvent = (input: TelemetryEventQueueItem) => Promise<void>

async function processTelemetryEvent(input: TelemetryEventQueueItem): Promise<void> {
  const options = tryGetServerAnalyticsOptions()
  if (!options?.enabled) return

  const anonymousInstanceId = await options.resolveAnonymousInstanceId()
  await captureAnonymousServerEvent({
    anonymousInstanceId,
    event: input.event,
    properties: input.properties,
    sessionId: input.sessionId,
    timestamp: input.timestamp,
  })
}

function dispatchTelemetryEvent(input: TelemetryEventQueueItem, process: ProcessTelemetryEvent): void {
  eventsInFlight += 1
  void process(input)
    .catch(() => {
      // Local telemetry must never affect the product experience.
    })
    .finally(() => {
      eventsInFlight -= 1
      flushPendingTelemetryEvents(process)
    })
}

function flushPendingTelemetryEvents(process: ProcessTelemetryEvent): void {
  while (eventsInFlight < MAX_EVENTS_IN_FLIGHT && pendingEvents.length > 0) {
    const next = pendingEvents.shift()
    if (!next) break
    dispatchTelemetryEvent(next, process)
  }
}

export function enqueueTelemetryEvent(
  input: TelemetryEventQueueItem,
  process: ProcessTelemetryEvent = processTelemetryEvent
): boolean {
  if (eventsInFlight < MAX_EVENTS_IN_FLIGHT && pendingEvents.length === 0) {
    dispatchTelemetryEvent(input, process)
    return true
  }

  if (pendingEvents.length >= MAX_EVENTS_QUEUE_DEPTH) {
    return false
  }

  pendingEvents.push(input)
  flushPendingTelemetryEvents(process)
  return true
}

/** Test-only */
export function resetTelemetryEventsQueueForTests(): void {
  eventsInFlight = 0
  pendingEvents.length = 0
}
