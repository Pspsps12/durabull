import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { baseTextIdColumns } from '../common'
import { user } from '../user/schema'

/**
 * Better Auth MCP / OIDC tables (oauthApplication, oauthAccessToken, oauthConsent).
 * @see better-auth `mcp` plugin schema
 */

export const oauthApplication = pgTable(
  'oauth_application',
  {
    ...baseTextIdColumns,
    name: text('name').notNull(),
    icon: text('icon'),
    metadata: text('metadata'),
    clientId: text('client_id').notNull().unique(),
    clientSecret: text('client_secret'),
    redirectUrls: text('redirect_urls').notNull(),
    type: text('type').notNull(),
    disabled: boolean('disabled').notNull().default(false),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('oauth_application_user_id_idx').on(table.userId)]
)

export const oauthAccessToken = pgTable(
  'oauth_access_token',
  {
    ...baseTextIdColumns,
    accessToken: text('access_token').notNull().unique(),
    refreshToken: text('refresh_token').notNull().unique(),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }).notNull(),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }).notNull(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthApplication.clientId, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    scopes: text('scopes').notNull(),
    resource: text('resource'),
  },
  (table) => [
    index('oauth_access_token_client_id_idx').on(table.clientId),
    index('oauth_access_token_user_id_idx').on(table.userId),
  ]
)

export const oauthConsent = pgTable(
  'oauth_consent',
  {
    ...baseTextIdColumns,
    clientId: text('client_id')
      .notNull()
      .references(() => oauthApplication.clientId, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    scopes: text('scopes').notNull(),
    consentGiven: boolean('consent_given').notNull(),
  },
  (table) => [
    index('oauth_consent_client_id_idx').on(table.clientId),
    index('oauth_consent_user_id_idx').on(table.userId),
  ]
)
