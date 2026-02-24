import posthog from 'posthog-js'

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
    // Disable automatic pageview capture - we'll handle this with the router
    capture_pageview: false,
    // Persist user identity across sessions
    persistence: 'localStorage+cookie',
  })
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
  posthog.capture('user_created', {
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
  posthog.capture('organization_created', {
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

  posthog.capture(eventName, properties)
}

/**
 * Track a page view
 */
export function trackPageView(path: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') {
    return
  }

  posthog.capture('$pageview', {
    $current_url: path,
    ...properties,
  })
}

/**
 * Reset the user identity (call on logout)
 */
export function resetIdentity() {
  if (typeof window === 'undefined') {
    return
  }

  posthog.reset()
}

/**
 * Get the PostHog instance for advanced usage
 */
export function getPostHog() {
  return posthog
}
