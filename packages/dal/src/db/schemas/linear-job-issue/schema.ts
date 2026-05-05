import { index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { alertEvent } from '../alert-event/schema'
import { baseColumns } from '../common'
import { organization } from '../organization/schema'
import { redisConnection } from '../redis-connection/schema'

export const linearJobIssue = pgTable(
  'linear_job_issue',
  {
    ...baseColumns,
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => redisConnection.id, { onDelete: 'cascade' }),
    queueName: text('queue_name').notNull(),
    jobId: text('job_id').notNull(),
    alertEventId: uuid('alert_event_id')
      .notNull()
      .references(() => alertEvent.id, { onDelete: 'cascade' }),
    linearIssueId: text('linear_issue_id').notNull(),
    linearIssueIdentifier: text('linear_issue_identifier').notNull(),
    linearIssueUrl: text('linear_issue_url').notNull(),
  },
  (table) => ({
    eventIdx: index('linear_job_issue_alert_event_id_idx').on(table.alertEventId),
    jobUniqueIdx: uniqueIndex('linear_job_issue_job_unique_idx').on(
      table.organizationId,
      table.connectionId,
      table.queueName,
      table.jobId
    ),
  })
)
