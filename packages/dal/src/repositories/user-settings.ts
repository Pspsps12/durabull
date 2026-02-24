import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import type { Theme } from '../db/schemas/user-settings/enums'
import { userSettings } from '../db/schemas/user-settings/schema'
import type { UserSettings } from '../db/schemas/user-settings/types'

/**
 * Repository for managing user settings.
 * Settings are tied to user IDs (1:1 relationship) to prevent IDOR vulnerabilities.
 * Provides CRUD operations without exposing the underlying database.
 */
export const userSettingsRepository = {
  /**
   * Create user settings for a specific user.
   * Uses the user's ID as the settings ID (1:1 relationship).
   */
  async createForUser(userId: string, theme: Theme = 'system'): Promise<UserSettings> {
    const db = await getDb()
    const now = new Date()

    const [result] = await db
      .insert(userSettings)
      .values({
        id: userId, // Use user ID as settings ID
        theme,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return result
  },

  /**
   * Find user settings by user ID.
   */
  async findById(userId: string): Promise<UserSettings | null> {
    const db = await getDb()

    const result = await db.select().from(userSettings).where(eq(userSettings.id, userId)).limit(1)

    return result[0] ?? null
  },

  /**
   * Update the theme for a user's settings.
   */
  async update(userId: string, theme: Theme): Promise<UserSettings | null> {
    const db = await getDb()

    const [result] = await db
      .update(userSettings)
      .set({
        theme,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.id, userId))
      .returning()

    return result ?? null
  },

  /**
   * Delete user settings by user ID.
   */
  async delete(userId: string): Promise<boolean> {
    const db = await getDb()

    const result = await db
      .delete(userSettings)
      .where(eq(userSettings.id, userId))
      .returning({ id: userSettings.id })

    return result.length > 0
  },
}
