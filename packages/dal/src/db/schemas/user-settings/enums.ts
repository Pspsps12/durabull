/**
 * Theme options for user preferences
 */
export const ThemeValues = ['light', 'dark', 'system'] as const
export type Theme = (typeof ThemeValues)[number]
