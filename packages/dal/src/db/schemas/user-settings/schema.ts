import { pgTable, text } from 'drizzle-orm/pg-core'
import { baseColumns } from '../common'
import type { Theme } from './enums'

export const userSettings = pgTable('user_settings', {
  ...baseColumns,
  theme: text('theme').$type<Theme>().notNull().default('system'),
})
