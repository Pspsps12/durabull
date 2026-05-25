import { index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { alertEvent } from '../alert-event/schema'
import { baseColumns } from '../common'
import { linearJobIssue } from '../linear-job-issue/schema'

export const linearJobIssueEvent = pgTable(
  'linear_job_issue_event',
  {
    ...baseColumns,
    linearJobIssueId: uuid('linear_job_issue_id')
      .notNull()
      .references(() => linearJobIssue.id, { onDelete: 'cascade' }),
    alertEventId: uuid('alert_event_id')
      .notNull()
      .references(() => alertEvent.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    eventIdx: index('linear_job_issue_event_alert_event_id_idx').on(table.alertEventId),
    issueEventUniqueIdx: uniqueIndex('linear_job_issue_event_unique_idx').on(
      table.linearJobIssueId,
      table.alertEventId
    ),
  })
)
