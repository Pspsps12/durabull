import { uuidv7 } from '@durabull/utils/uuid'
import { sql } from 'drizzle-orm'
import { text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Common column definitions for reuse across schemas
 */

/**
 * UUID primary key column with auto-generated UUIDv7
 * Use this for new tables that don't have external ID requirements
 */
export const idColumn = {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
}

/**
 * Text primary key column
 * Use this for tables that need text IDs (e.g., auth tables with external IDs)
 */
export const textIdColumn = {
  id: text('id').primaryKey(),
}

/**
 * Timestamp columns for tracking record creation and updates
 * - createdAt: Set automatically on insert
 * - updatedAt: Set automatically on insert and updates
 */
export const timestampColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
}

/**
 * Standard columns for tables with UUID primary keys
 * Includes: id (uuid), createdAt, updatedAt
 */
export const baseColumns = {
  ...idColumn,
  ...timestampColumns,
}

/**
 * Standard columns for tables with text primary keys
 * Includes: id (text), createdAt, updatedAt
 */
export const baseTextIdColumns = {
  ...textIdColumn,
  ...timestampColumns,
}
