import { boolean, pgTable, text } from 'drizzle-orm/pg-core'
import { baseColumns } from '../common'
import { organization } from '../organization/schema'

/**
 * Environment values for Redis connections
 */
export const connectionEnvironments = ['development', 'staging', 'production'] as const

export type ConnectionEnvironment = (typeof connectionEnvironments)[number]

/**
 * Redis connection table - stores Redis connection configurations
 * Connections are scoped to an organization
 */
export const redisConnection = pgTable('redis_connection', {
  ...baseColumns,
  name: text('name').notNull(),
  url: text('url').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  environment: text('environment').$type<ConnectionEnvironment>().default('development'),
  // Organization that owns this connection
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
})
