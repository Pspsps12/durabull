import type { oauthAccessToken, oauthApplication, oauthConsent } from './schema'

export type OauthApplication = typeof oauthApplication.$inferSelect
export type NewOauthApplication = typeof oauthApplication.$inferInsert

export type OauthAccessToken = typeof oauthAccessToken.$inferSelect
export type NewOauthAccessToken = typeof oauthAccessToken.$inferInsert

export type OauthConsent = typeof oauthConsent.$inferSelect
export type NewOauthConsent = typeof oauthConsent.$inferInsert
