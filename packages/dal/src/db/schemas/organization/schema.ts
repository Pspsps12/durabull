import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { baseTextIdColumns } from '../common'
import { user } from '../user/schema'

/**
 * Organization table - core organization entity for Better Auth organization plugin
 */
export const organization = pgTable('organization', {
  ...baseTextIdColumns,
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  metadata: text('metadata'), // JSON stored as text
})

/**
 * Member table - tracks organization membership and roles
 */
export const member = pgTable('member', {
  ...baseTextIdColumns,
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
})

/**
 * Invitation table - tracks pending organization invitations
 */
export const invitation = pgTable('invitation', {
  ...baseTextIdColumns,
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull().default('member'),
  status: text('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  inviterId: text('inviter_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})
