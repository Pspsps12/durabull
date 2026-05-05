import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { baseColumns } from '../common'
import { organization } from '../organization/schema'

export const linearIntegrationValidationStatuses = ['valid', 'invalid', 'unknown'] as const
export type LinearIntegrationValidationStatus = (typeof linearIntegrationValidationStatuses)[number]

export const linearIntegration = pgTable('linear_integration', {
  ...baseColumns,
  organizationId: text('organization_id')
    .notNull()
    .unique()
    .references(() => organization.id, { onDelete: 'cascade' }),
  encryptedApiKey: text('encrypted_api_key').notNull(),
  keyPreview: text('key_preview').notNull(),
  validationStatus: text('validation_status')
    .$type<LinearIntegrationValidationStatus>()
    .notNull()
    .default('unknown'),
  defaultTeamId: text('default_team_id'),
  defaultProjectId: text('default_project_id'),
  defaultLabelIds: jsonb('default_label_ids').$type<string[]>().notNull().default([]),
  defaultAssigneeId: text('default_assignee_id'),
  defaultStateId: text('default_state_id'),
  defaultPriority: integer('default_priority'),
  lastValidatedAt: timestamp('last_validated_at', { withTimezone: true }),
})
