import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { baseColumns } from '../common'
import { organization } from '../organization/schema'

export const linearOauthState = pgTable(
  'linear_oauth_state',
  {
    ...baseColumns,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    stateHash: text('state_hash').notNull().unique(),
    redirectUri: text('redirect_uri').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    expiresAtIdx: index('linear_oauth_state_expires_at_idx').on(table.expiresAt),
  })
)
