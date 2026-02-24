import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { baseTextIdColumns } from '../common'
import { organization } from '../organization/schema'
import { user } from '../user/schema'

/**
 * Better Auth schema tables
 * These are the required tables for Better Auth to function
 * Tables are prefixed with auth_ to clearly identify authentication-related data
 */

export const authSession = pgTable('auth_session', {
  ...baseTextIdColumns,
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // Organization plugin fields
  activeOrganizationId: text('active_organization_id').references(() => organization.id, {
    onDelete: 'set null',
  }),
})

export const authAccount = pgTable('auth_account', {
  ...baseTextIdColumns,
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
})

export const authVerification = pgTable('auth_verification', {
  ...baseTextIdColumns,
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})
