import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { timestampColumns } from '../common'

export const telemetryInstallation = pgTable('telemetry_installation', {
  id: text('id').primaryKey(),
  anonymousInstanceId: uuid('anonymous_instance_id').notNull().unique(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  ...timestampColumns,
})
