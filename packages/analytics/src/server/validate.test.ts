import { describe, expect, it } from 'bun:test'

import { AnalyticsEvents, AnalyticsProperties } from '../events'
import { validateTelemetryPayload } from './validate'

describe('validateTelemetryPayload', () => {
  it('accepts events when optional MCP properties are undefined', () => {
    const result = validateTelemetryPayload(AnalyticsEvents.MCP_AUTH_FAILED, {
      [AnalyticsProperties.MCP_AUTH_FAILURE]: 'unauthorized',
      [AnalyticsProperties.SUCCESS]: false,
      [AnalyticsProperties.PRINCIPAL_TYPE]: undefined,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.properties).not.toHaveProperty(AnalyticsProperties.PRINCIPAL_TYPE)
      expect(result.properties[AnalyticsProperties.MCP_AUTH_FAILURE]).toBe('unauthorized')
    }
  })

  it('lets server runtime context override client properties', () => {
    const result = validateTelemetryPayload(
      AnalyticsEvents.QUEUE_PAUSED,
      { authless: true, success: true },
      { authless: false, environment: 'production' }
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.properties.authless).toBe(false)
      expect(result.properties.environment).toBe('production')
    }
  })
})
