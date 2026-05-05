import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { linearIntegration } from '../db/schemas/linear-integration/schema'
import type {
  LinearIntegration,
  LinearIntegrationValidationStatus,
} from '../db/schemas/linear-integration/types'
import { encryptSecret, maskSecretPreview } from '../db/secret-encryption'

export interface LinearIntegrationDefaults {
  defaultTeamId?: string | null
  defaultProjectId?: string | null
  defaultLabelIds?: string[]
  defaultAssigneeId?: string | null
  defaultStateId?: string | null
  defaultPriority?: number | null
}

export interface UpsertLinearIntegrationInput extends LinearIntegrationDefaults {
  organizationId: string
  apiKey: string
  validationStatus?: LinearIntegrationValidationStatus
  lastValidatedAt?: Date | null
}

export const linearIntegrationRepository = {
  async findByOrganization(organizationId: string): Promise<LinearIntegration | null> {
    const db = await getDb()
    const rows = await db
      .select()
      .from(linearIntegration)
      .where(eq(linearIntegration.organizationId, organizationId))
      .limit(1)

    return rows[0] ?? null
  },

  async upsert(input: UpsertLinearIntegrationInput): Promise<LinearIntegration> {
    const db = await getDb()
    const now = new Date()
    const values = {
      organizationId: input.organizationId,
      encryptedApiKey: encryptSecret(input.apiKey),
      keyPreview: maskSecretPreview(input.apiKey),
      validationStatus: input.validationStatus ?? 'unknown',
      defaultTeamId: input.defaultTeamId ?? null,
      defaultProjectId: input.defaultProjectId ?? null,
      defaultLabelIds: input.defaultLabelIds ?? [],
      defaultAssigneeId: input.defaultAssigneeId ?? null,
      defaultStateId: input.defaultStateId ?? null,
      defaultPriority: input.defaultPriority ?? null,
      lastValidatedAt: input.lastValidatedAt ?? null,
      updatedAt: now,
    }

    const [row] = await db
      .insert(linearIntegration)
      .values(values)
      .onConflictDoUpdate({
        target: linearIntegration.organizationId,
        set: values,
      })
      .returning()

    return row
  },

  async updateDefaults(
    organizationId: string,
    defaults: LinearIntegrationDefaults & {
      validationStatus?: LinearIntegrationValidationStatus
      lastValidatedAt?: Date | null
    }
  ): Promise<LinearIntegration | null> {
    const db = await getDb()
    const [row] = await db
      .update(linearIntegration)
      .set({
        defaultTeamId: defaults.defaultTeamId ?? null,
        defaultProjectId: defaults.defaultProjectId ?? null,
        defaultLabelIds: defaults.defaultLabelIds ?? [],
        defaultAssigneeId: defaults.defaultAssigneeId ?? null,
        defaultStateId: defaults.defaultStateId ?? null,
        defaultPriority: defaults.defaultPriority ?? null,
        validationStatus: defaults.validationStatus ?? 'unknown',
        lastValidatedAt: defaults.lastValidatedAt ?? null,
        updatedAt: new Date(),
      })
      .where(eq(linearIntegration.organizationId, organizationId))
      .returning()

    return row ?? null
  },

  async markValidationStatus(
    organizationId: string,
    validationStatus: LinearIntegrationValidationStatus
  ): Promise<void> {
    const db = await getDb()
    await db
      .update(linearIntegration)
      .set({
        validationStatus,
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(linearIntegration.organizationId, organizationId))
  },

  async delete(organizationId: string): Promise<boolean> {
    const db = await getDb()
    const rows = await db
      .delete(linearIntegration)
      .where(eq(linearIntegration.organizationId, organizationId))
      .returning({ id: linearIntegration.id })

    return rows.length > 0
  },
}
