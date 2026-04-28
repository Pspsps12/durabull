// Public exports - only expose the repository and types

// Re-export drizzle-orm utilities to ensure consistent versions across the monorepo
export { and, eq, or, sql } from 'drizzle-orm'

export type { Database } from './db/client'
// Database lifecycle management
export { closeDb, getDatabaseMode, getDb, getPgPool } from './db/client'
export {
  getEnvRedisConnectionId,
  getEnvRedisConnectionIdsForOrganization,
  getEnvRedisConnections,
  shouldUseEnvConnections,
} from './db/env-redis-connections'
export {
  assertRedisUrlEncryptionKeyConfigured,
  decryptRedisUrl,
  encryptRedisUrl,
  isRedisUrlEncrypted,
  isRedisUrlEncryptionKeyConfigured,
} from './db/redis-url-encryption'
export type { RedisUrlValidationResult } from './db/redis-url-validation'
export {
  allowsInternalConnections,
  validateRedisUrl,
  validateRedisUrlForEnvironment,
} from './db/redis-url-validation'
export type {
  NewTelemetryInstallation,
  TelemetryInstallation,
  Theme,
  UserSettings,
} from './db/schemas'
export { alertCheckCursor } from './db/schemas/alert-check-cursor/schema'
export type { AlertCheckCursor, NewAlertCheckCursor } from './db/schemas/alert-check-cursor/types'
export {
  type AlertEventStatus,
  alertEvent,
  alertEventStatuses,
} from './db/schemas/alert-event/schema'
export type { AlertEvent, NewAlertEvent } from './db/schemas/alert-event/types'
// Redis connection exports
export {
  type AlertRuleType,
  alertRule,
  alertRuleTypes,
  type QueueFilterMode,
  queueFilterModes,
} from './db/schemas/alert-rule/schema'
export type { AlertRule, NewAlertRule } from './db/schemas/alert-rule/types'
export * as authSchema from './db/schemas/auth/schema'
// Auth schema exports for Better Auth integration
export { authAccount, authSession, authVerification } from './db/schemas/auth/schema'
export type {
  AuthAccount,
  AuthSession,
  AuthVerification,
  NewAuthAccount,
  NewAuthSession,
  NewAuthVerification,
} from './db/schemas/auth/types'
// Organization schema exports for Better Auth organization plugin
export * as organizationSchema from './db/schemas/organization/schema'
export { invitation, member, organization } from './db/schemas/organization/schema'
export type {
  Invitation,
  Member,
  NewInvitation,
  NewMember,
  NewOrganization,
  Organization,
} from './db/schemas/organization/types'
export {
  type ConnectionEnvironment,
  connectionEnvironments,
  redisConnection,
} from './db/schemas/redis-connection/schema'
export type { NewRedisConnection, RedisConnection } from './db/schemas/redis-connection/types'
export {
  type QueueDiscoveryState,
  queueDiscoveryStates,
  redisDiscoveredQueue,
} from './db/schemas/redis-discovered-queue/schema'
export type {
  NewRedisDiscoveredQueue,
  RedisDiscoveredQueue,
} from './db/schemas/redis-discovered-queue/types'
export { telemetryInstallation } from './db/schemas/telemetry-installation/schema'
export * as userSchema from './db/schemas/user/schema'
// User schema exports
export { user } from './db/schemas/user/schema'
export type { NewUser, User } from './db/schemas/user/types'
export { alertCheckCursorRepository } from './repositories/alert-check-cursor'
export { alertEventRepository } from './repositories/alert-event'
export { alertRuleRepository } from './repositories/alert-rule'
// Repositories
export { redisConnectionRepository } from './repositories/redis-connection'
export { redisDiscoveredQueueRepository } from './repositories/redis-discovered-queue'
export { telemetryInstallationRepository } from './repositories/telemetry-installation'
export { userSettingsRepository } from './repositories/user-settings'
