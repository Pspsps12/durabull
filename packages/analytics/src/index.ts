/**
 * @durabull/analytics
 *
 * Analytics package for PostHog integration
 * Provides user and organization identification, event tracking, and page view tracking
 *
 * Usage:
 * - Import from '@durabull/analytics/client' for client-side usage
 * - Initialize with initAnalytics() at app startup
 * - Call identifyUser() when a user signs up or logs in
 * - Call identifyOrganization() when a user creates or joins an organization
 */

// Re-export all client functions and types
export {
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

// Re-export all event constants and types
export {
  type AccountLinkEventProperties,
  type AnalyticsEventName,
  AnalyticsEvents,
  AnalyticsProperties,
  AuthMethod,
  type AuthMethodType,
  ConnectionEnvironment,
  type ConnectionEventProperties,
  type ConnectionSelectedProperties,
  type ConnectionTestedProperties,
  type DialogEventProperties,
  DialogType,
  type DialogTypeValue,
  type InvitationEventProperties,
  type JobLogsClearedProperties,
  type JobStatusFilteredProperties,
  type JobsOperationProperties,
  JobTab,
  type JobTabChangedProperties,
  type JobViewedProperties,
  type MemberInvitedProperties,
  type MemberRemovedProperties,
  MemberRole,
  type MemberRoleUpdatedProperties,
  type OrganizationSwitchedProperties,
  type QueueCleanedProperties,
  type QueueEventProperties,
  QueueTab,
  type RedisKeyEventProperties,
  type RedisKeyFilterChangedProperties,
  type ScheduledJobEventProperties,
  type SignInEventProperties,
  // Event property types
  type SignUpEventProperties,
  type ThemeChangedProperties,
  ThemeValue,
} from './events'
