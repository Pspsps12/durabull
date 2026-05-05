import type { linearIntegration } from './schema'

export type LinearIntegration = typeof linearIntegration.$inferSelect
export type NewLinearIntegration = typeof linearIntegration.$inferInsert
export type { LinearIntegrationValidationStatus } from './schema'
