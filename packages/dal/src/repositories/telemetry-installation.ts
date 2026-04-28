import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { telemetryInstallation } from '../db/schemas/telemetry-installation/schema'

const DEFAULT_TELEMETRY_INSTALLATION_ID = 'default'

export const telemetryInstallationRepository = {
  async getOrCreateAnonymousInstanceId(): Promise<string> {
    const db = await getDb()
    const now = new Date()

    const existing = await db
      .select({ anonymousInstanceId: telemetryInstallation.anonymousInstanceId })
      .from(telemetryInstallation)
      .where(eq(telemetryInstallation.id, DEFAULT_TELEMETRY_INSTALLATION_ID))
      .limit(1)

    if (existing[0]) {
      await db
        .update(telemetryInstallation)
        .set({
          lastSeenAt: now,
          updatedAt: now,
        })
        .where(eq(telemetryInstallation.id, DEFAULT_TELEMETRY_INSTALLATION_ID))

      return existing[0].anonymousInstanceId
    }

    const [created] = await db
      .insert(telemetryInstallation)
      .values({
        id: DEFAULT_TELEMETRY_INSTALLATION_ID,
        anonymousInstanceId: randomUUID(),
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning({ anonymousInstanceId: telemetryInstallation.anonymousInstanceId })

    if (created) return created.anonymousInstanceId

    const raced = await db
      .select({ anonymousInstanceId: telemetryInstallation.anonymousInstanceId })
      .from(telemetryInstallation)
      .where(eq(telemetryInstallation.id, DEFAULT_TELEMETRY_INSTALLATION_ID))
      .limit(1)

    if (!raced[0]) {
      throw new Error('Failed to initialize anonymous telemetry installation identity.')
    }

    return raced[0].anonymousInstanceId
  },
}
