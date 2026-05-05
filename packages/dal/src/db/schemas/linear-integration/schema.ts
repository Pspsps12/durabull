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
  encryptedAccessToken: text('encrypted_access_token').notNull(),
  encryptedRefreshToken: text('encrypted_refresh_token').notNull(),
  tokenType: text('token_type').notNull().default('Bearer'),
  scopes: text('scopes').notNull(),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }).notNull(),
  linearOrganizationName: text('linear_organization_name'),
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
