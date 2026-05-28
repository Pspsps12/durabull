/**
 * @durabull/analytics — shared event schema and sanitization.
 *
 * Runtime SDKs:
 * - `@durabull/analytics/browser` or `@durabull/analytics/react` — PostHog in the web app
 * - `@durabull/analytics/server` — PostHog batch capture from the API
 */

/** @deprecated Prefer `@durabull/analytics/browser` in new code. */
export * from './browser'
export * from './events'
export {
  categorizeErrorMessage,
  getForbiddenTelemetryPropertyKeys,
  isKnownDurabullTelemetryEvent,
  normalizeRoutePath,
  PAGEVIEW_EVENT,
  type SanitizedTelemetryEvent,
  sanitizeTelemetryEvent,
  type TelemetryEventName,
} from './sanitizer'
