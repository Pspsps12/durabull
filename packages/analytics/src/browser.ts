/**
 * Browser / React analytics (PostHog JS SDK).
 *
 * Prefer `@durabull/analytics/browser` or `@durabull/analytics/react` in app code.
 */
export {
  configureDurabullTelemetry,
  getPostHog,
  identifyOrganization,
  identifyUser,
  initAnalytics,
  type OrganizationProperties,
  resetIdentity,
  trackEvent,
  trackOrganizationCreated,
  trackPageView,
  trackUserCreated,
  type UserProperties,
} from './client'
