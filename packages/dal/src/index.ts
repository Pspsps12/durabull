// Public exports - only expose the repository and types

// Re-export drizzle-orm utilities to ensure consistent versions across the monorepo
export { and, eq, or, sql } from 'drizzle-orm'

export type { Database } from './db/client'
// Database lifecycle management
export { closeDb, getDatabaseMode, getDb, getPgPool } from './db/client'
export type { Theme, UserSettings } from './db/schemas'
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
// Redis connection exports
export {
  type ConnectionEnvironment,
  connectionEnvironments,
  redisConnection,
} from './db/schemas/redis-connection/schema'
export type { NewRedisConnection, RedisConnection } from './db/schemas/redis-connection/types'
export * as userSchema from './db/schemas/user/schema'
// User schema exports
export { user } from './db/schemas/user/schema'
export type { NewUser, User } from './db/schemas/user/types'
// Repositories
export { redisConnectionRepository } from './repositories/redis-connection'
export { userSettingsRepository } from './repositories/user-settings'
export {
  getEnvRedisConnections,
  getEnvRedisConnectionId,
  getEnvRedisConnectionIdsForOrganization,
  shouldUseEnvConnections,
} from './db/env-redis-connections'
export {
  assertRedisUrlEncryptionKeyConfigured,
  decryptRedisUrl,
  encryptRedisUrl,
  isRedisUrlEncrypted,
  isRedisUrlEncryptionKeyConfigured,
} from './db/redis-url-encryption'
export {
  allowsInternalConnections,
  validateRedisUrl,
  validateRedisUrlForEnvironment,
} from './db/redis-url-validation'
export type { RedisUrlValidationResult } from './db/redis-url-validation'
