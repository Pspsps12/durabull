import { isKnownDurabullTelemetryEvent, sanitizeTelemetryEvent } from '../sanitizer'

export type TelemetryValidationResult =
  | {
      ok: true
      event: string
      properties: Record<string, string | number | boolean | null>
    }
  | { ok: false; error: 'unknown_event' | 'invalid_properties' }

export function validateTelemetryPayload(
  eventName: string,
  properties: Record<string, unknown> = {},
  runtimeContext: Record<string, unknown> = {}
): TelemetryValidationResult {
  if (!isKnownDurabullTelemetryEvent(eventName)) {
    return { ok: false, error: 'unknown_event' }
  }

  const sanitized = sanitizeTelemetryEvent(eventName, {
    ...properties,
    ...runtimeContext,
  })

  if (sanitized.droppedProperties.length > 0) {
    return { ok: false, error: 'invalid_properties' }
  }

  return {
    ok: true,
    event: sanitized.event,
    properties: sanitized.properties,
  }
}
