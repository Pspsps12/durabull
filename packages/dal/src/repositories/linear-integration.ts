import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { linearIntegration } from '../db/schemas/linear-integration/schema'
import type {
  LinearIntegration,
  LinearIntegrationValidationStatus,
} from '../db/schemas/linear-integration/types'
import { encryptSecret } from '../db/secret-encryption'

export interface LinearIntegrationDefaults {
  defaultTeamId?: string | null
  defaultProjectId?: string | null
  defaultLabelIds?: string[]
  defaultAssigneeId?: string | null
  defaultStateId?: string | null
  defaultPriority?: number | null
}

export interface UpsertLinearOauthIntegrationInput extends LinearIntegrationDefaults {
  organizationId: string
  accessToken: string
  refreshToken: string
  tokenType?: string
  scopes: string
  accessTokenExpiresAt: Date
  linearOrganizationName?: string | null
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

  async upsertOauth(input: UpsertLinearOauthIntegrationInput): Promise<LinearIntegration> {
    const db = await getDb()
    const now = new Date()
    const values = {
      organizationId: input.organizationId,
      encryptedAccessToken: encryptSecret(input.accessToken),
      encryptedRefreshToken: encryptSecret(input.refreshToken),
      tokenType: input.tokenType ?? 'Bearer',
      scopes: input.scopes,
      accessTokenExpiresAt: input.accessTokenExpiresAt,
      linearOrganizationName: input.linearOrganizationName ?? null,
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

  async updateOauthTokens(
    organizationId: string,
    tokens: {
      accessToken: string
      refreshToken: string
      tokenType?: string
      scopes?: string
      accessTokenExpiresAt: Date
    }
  ): Promise<LinearIntegration | null> {
    const db = await getDb()
    const [row] = await db
      .update(linearIntegration)
      .set({
        encryptedAccessToken: encryptSecret(tokens.accessToken),
        encryptedRefreshToken: encryptSecret(tokens.refreshToken),
        tokenType: tokens.tokenType ?? 'Bearer',
        ...(tokens.scopes ? { scopes: tokens.scopes } : {}),
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        validationStatus: 'valid',
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(linearIntegration.organizationId, organizationId))
      .returning()

    return row ?? null
  },

  async updateDefaults(
    organizationId: string,
    defaults: LinearIntegrationDefaults & {
      validationStatus?: LinearIntegrationValidationStatus
      lastValidatedAt?: Date | null
    }
  ): Promise<LinearIntegration | null> {
    const db = await getDb()
    const update: Partial<LinearIntegration> = { updatedAt: new Date() }
    if ('defaultTeamId' in defaults) update.defaultTeamId = defaults.defaultTeamId ?? null
    if ('defaultProjectId' in defaults) update.defaultProjectId = defaults.defaultProjectId ?? null
    if ('defaultLabelIds' in defaults) update.defaultLabelIds = defaults.defaultLabelIds ?? []
    if ('defaultAssigneeId' in defaults)
      update.defaultAssigneeId = defaults.defaultAssigneeId ?? null
    if ('defaultStateId' in defaults) update.defaultStateId = defaults.defaultStateId ?? null
    if ('defaultPriority' in defaults) update.defaultPriority = defaults.defaultPriority ?? null
    if ('validationStatus' in defaults)
      update.validationStatus = defaults.validationStatus ?? 'unknown'
    if ('lastValidatedAt' in defaults) update.lastValidatedAt = defaults.lastValidatedAt ?? null

    const [row] = await db
      .update(linearIntegration)
      .set(update)
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
