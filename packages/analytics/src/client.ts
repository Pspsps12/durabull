import posthog from 'posthog-js'
import { AnalyticsEvents } from './events'
import { isKnownDurabullTelemetryEvent, PAGEVIEW_EVENT, sanitizeTelemetryEvent } from './sanitizer'

/**
 * User properties for identification
 */
export interface UserProperties {
  id: string
  email: string
  name: string
  image?: string | null
  emailVerified?: boolean
  createdAt?: Date
}

/**
 * Organization properties for group identification
 */
export interface OrganizationProperties {
  id: string
  name: string
  slug: string
  logo?: string | null
  createdAt?: Date
}

interface DurabullTelemetryConfig {
  enabled: boolean
  collectionRequired: boolean
  dedupeIdentifiedPosthogEvents?: boolean
  endpoint?: string
  disclosureUrl?: string
  runtimeContext?: Record<string, unknown>
}

const DEFAULT_TELEMETRY_ENDPOINT = '/api/telemetry/events'

let durabullTelemetryConfig: DurabullTelemetryConfig = {
  enabled: false,
  collectionRequired: true,
  endpoint: DEFAULT_TELEMETRY_ENDPOINT,
}
let sessionId: string | null = null
let hasIdentifiedPosthogUser = false

type AnalyticsPropertyValue = string | number | boolean | null

function isAnalyticsPropertyValue(value: unknown): value is AnalyticsPropertyValue {
  if (value === null) return true
  if (typeof value === 'string') return true
  if (typeof value === 'boolean') return true
  return typeof value === 'number' && Number.isFinite(value)
}

function getSessionId(): string {
  if (sessionId) return sessionId

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    sessionId = crypto.randomUUID()
    return sessionId
  }

  sessionId = `session-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
  return sessionId
}

function sendDurabullTelemetry(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  if (!durabullTelemetryConfig.enabled) return
  if (durabullTelemetryConfig.dedupeIdentifiedPosthogEvents && hasIdentifiedPosthogUser) return
  if (!isKnownDurabullTelemetryEvent(eventName)) return

  const endpoint = durabullTelemetryConfig.endpoint ?? DEFAULT_TELEMETRY_ENDPOINT
  const runtimeContext = durabullTelemetryConfig.runtimeContext ?? {}
  const sanitized = sanitizeTelemetryEvent(eventName, {
    ...runtimeContext,
    ...(properties ?? {}),
  })

  const body = JSON.stringify({
    event: sanitized.event,
    properties: sanitized.properties,
    sessionId: getSessionId(),
    timestamp: new Date().toISOString(),
  })

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon(endpoint, blob)) return
    }

    void fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      credentials: 'include',
      keepalive: true,
    }).catch(() => {
      // Telemetry must never affect product behavior.
    })
  } catch {
    // Telemetry must never affect product behavior.
  }
}

function getRuntimeContextProperties(): Record<string, AnalyticsPropertyValue> {
  const runtimeContext = durabullTelemetryConfig.runtimeContext ?? {}
  const properties: Record<string, AnalyticsPropertyValue> = {}

  for (const [key, value] of Object.entries(runtimeContext)) {
    if (isAnalyticsPropertyValue(value)) {
      properties[key] = value
    }
  }

  return properties
}

function withRuntimeContext(
  properties?: Record<string, unknown>
): Record<string, unknown> | undefined {
  const runtimeContext = getRuntimeContextProperties()
  if (Object.keys(runtimeContext).length === 0) {
    return properties
  }

  return {
    ...runtimeContext,
    ...(properties ?? {}),
  }
}

function registerPosthogRuntimeContext() {
  if (typeof window === 'undefined') return

  const runtimeContext = getRuntimeContextProperties()
  if (Object.keys(runtimeContext).length === 0) return

  try {
    posthog.register(runtimeContext)
  } catch {
    // Analytics setup must never block product runtime.
  }
}

/**
 * Configure Durabull-owned anonymous telemetry.
 *
 * This is intentionally separate from a user's optional PostHog project key:
 * POSTHOG_KEY controls their own analytics destination, not Durabull telemetry.
 */
export function configureDurabullTelemetry(config: DurabullTelemetryConfig) {
  durabullTelemetryConfig = {
    ...config,
    endpoint: config.endpoint ?? DEFAULT_TELEMETRY_ENDPOINT,
  }
  registerPosthogRuntimeContext()
}

/**
 * Initialize PostHog with the provided API key and host
 * Call this once when the app starts
 *
 * When using a reverse proxy (recommended for production), set host to your proxy path
 * (e.g., '/ingest') and optionally provide uiHost pointing to PostHog's UI domain
 * for features like the toolbar to work correctly.
 */
export function initAnalytics(
  apiKey: string,
  host: string,
  options?: { debug?: boolean; uiHost?: string }
) {
  if (typeof window === 'undefined') {
    return
  }

  posthog.init(apiKey, {
    api_host: host,
    // ui_host is required when using a reverse proxy so PostHog features
    // like the toolbar work correctly
    ui_host: options?.uiHost ?? 'https://us.posthog.com',
    defaults: '2025-05-24',
    capture_exceptions: true,
    debug: options?.debug ?? false,
    // Persist user identity across sessions
    persistence: 'localStorage+cookie',
  })
  registerPosthogRuntimeContext()
}

/**
 * Identify a user when they sign up or log in
 * This associates all future events with this user
 */
export function identifyUser(user: UserProperties) {
  if (typeof window === 'undefined') {
    return
  }

  posthog.identify(user.id, {
    email: user.email,
    name: user.name,
    image: user.image,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt?.toISOString(),
  })
  hasIdentifiedPosthogUser = true
}

/**
 * Associate a user with an organization using PostHog groups
 * Call this when a user creates or joins an organization
 */
export function identifyOrganization(organization: OrganizationProperties) {
  if (typeof window === 'undefined') {
    return
  }

  posthog.group('organization', organization.id, {
    name: organization.name,
    slug: organization.slug,
    logo: organization.logo,
    createdAt: organization.createdAt?.toISOString(),
  })
}

/**
 * Track when a new user is created (sign up)
 */
export function trackUserCreated(user: UserProperties) {
  if (typeof window === 'undefined') {
    return
  }

  // First identify the user
  identifyUser(user)

  // Then track the signup event
  trackEvent(AnalyticsEvents.USER_CREATED, {
    userId: user.id,
    email: user.email,
    name: user.name,
  })
}

/**
 * Track when a new organization is created
 */
export function trackOrganizationCreated(
  organization: OrganizationProperties,
  createdByUserId: string
) {
  if (typeof window === 'undefined') {
    return
  }

  // Associate the user with this organization
  identifyOrganization(organization)

  // Track the organization creation event
  trackEvent(AnalyticsEvents.ORGANIZATION_CREATED, {
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    createdByUserId,
  })
}

/**
 * Track a custom event
 */
export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') {
    return
  }

  sendDurabullTelemetry(eventName, properties)

  try {
    posthog.capture(eventName, withRuntimeContext(properties))
  } catch {
    // Analytics must never affect product behavior.
  }
}

/**
 * Track a page view
 */
export function trackPageView(path: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') {
    return
  }

  const pageViewProperties = {
    $current_url: path,
    ...properties,
  }

  sendDurabullTelemetry(PAGEVIEW_EVENT, pageViewProperties)

  try {
    posthog.capture(PAGEVIEW_EVENT, withRuntimeContext(pageViewProperties))
  } catch {
    // Analytics must never affect product behavior.
  }
}

/**
 * Reset the user identity (call on logout)
 */
export function resetIdentity() {
  if (typeof window === 'undefined') {
    return
  }

  posthog.reset()
  hasIdentifiedPosthogUser = false
}

/**
 * Get the PostHog instance for advanced usage
 */
export function getPostHog() {
  return posthog
}
