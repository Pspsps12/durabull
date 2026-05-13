import type { linearJobIssueEvent } from './schema'

export type LinearJobIssueEvent = typeof linearJobIssueEvent.$inferSelect
export type NewLinearJobIssueEvent = typeof linearJobIssueEvent.$inferInsert
