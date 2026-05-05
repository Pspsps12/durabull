// Relations (consolidated to avoid circular dependencies)

// Alert Check Cursor schema exports
export { alertCheckCursor } from './alert-check-cursor/schema'
export type { AlertCheckCursor, NewAlertCheckCursor } from './alert-check-cursor/types'
// Alert Delivery schema exports
export {
  alertDelivery,
  type AlertDeliveryChannelType,
  alertDeliveryChannelTypes,
  type AlertDeliveryStatus,
  alertDeliveryStatuses,
} from './alert-delivery/schema'
export type { AlertDelivery, NewAlertDelivery } from './alert-delivery/types'
// Alert Event schema exports
export { type AlertEventStatus, alertEvent, alertEventStatuses } from './alert-event/schema'
export type { AlertEvent, NewAlertEvent } from './alert-event/types'
// Alert Rule schema exports
export { type AlertRuleType, alertRule, alertRuleTypes } from './alert-rule/schema'
export type { AlertRule, NewAlertRule } from './alert-rule/types'
// Auth schema exports
export { authAccount, authSession, authVerification } from './auth/schema'
export type {
  AuthAccount,
  AuthSession,
  AuthVerification,
  NewAuthAccount,
  NewAuthSession,
  NewAuthVerification,
} from './auth/types'
// Organization schema exports
export { invitation, member, organization } from './organization/schema'
export type {
  Invitation,
  Member,
  NewInvitation,
  NewMember,
  NewOrganization,
  Organization,
} from './organization/types'
// Redis Connection schema exports
export {
  type ConnectionEnvironment,
  connectionEnvironments,
  redisConnection,
} from './redis-connection/schema'
export type { NewRedisConnection, RedisConnection } from './redis-connection/types'
export {
  type QueueDiscoveryState,
  queueDiscoveryStates,
  redisDiscoveredQueue,
} from './redis-discovered-queue/schema'
export type {
  NewRedisDiscoveredQueue,
  RedisDiscoveredQueue,
} from './redis-discovered-queue/types'
// Linear integration schema exports
export {
  type LinearIntegrationValidationStatus,
  linearIntegration,
  linearIntegrationValidationStatuses,
} from './linear-integration/schema'
export type {
  LinearIntegration,
  NewLinearIntegration,
} from './linear-integration/types'
export { linearJobIssue } from './linear-job-issue/schema'
export type { LinearJobIssue, NewLinearJobIssue } from './linear-job-issue/types'
// Relations v2 - single consolidated relations object
export { relations } from './relations'
// Telemetry installation schema exports
export { telemetryInstallation } from './telemetry-installation/schema'
export type {
  NewTelemetryInstallation,
  TelemetryInstallation,
} from './telemetry-installation/types'
// User schema exports
export { user } from './user/schema'
export type { NewUser, User } from './user/types'
// User settings schema exports
export { type Theme, ThemeValues } from './user-settings/enums'
export { userSettings } from './user-settings/schema'
export type { NewUserSettings, UserSettings } from './user-settings/types'
