import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { baseTextIdColumns } from '../common'

/**
 * User table - the core user entity
 */
export const user = pgTable('user', {
  ...baseTextIdColumns,
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }),
})
