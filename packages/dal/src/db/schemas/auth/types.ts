import type { authAccount, authSession, authVerification } from './schema'

// Session types
export type AuthSession = typeof authSession.$inferSelect
export type NewAuthSession = typeof authSession.$inferInsert

// Account types
export type AuthAccount = typeof authAccount.$inferSelect
export type NewAuthAccount = typeof authAccount.$inferInsert

// Verification types
export type AuthVerification = typeof authVerification.$inferSelect
export type NewAuthVerification = typeof authVerification.$inferInsert
