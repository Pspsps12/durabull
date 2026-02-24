import type { userSettings } from './schema'

// UserSettings types
export type UserSettings = typeof userSettings.$inferSelect
export type NewUserSettings = typeof userSettings.$inferInsert
