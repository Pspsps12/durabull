import { createHash } from 'node:crypto'
import { and, eq, gt, lt } from 'drizzle-orm'
import { getDb } from '../db/client'
import { linearOauthState } from '../db/schemas/linear-oauth-state/schema'
import type { LinearOauthState } from '../db/schemas/linear-oauth-state/types'

export function hashLinearOauthState(state: string): string {
  return createHash('sha256').update(state).digest('hex')
}

export const linearOauthStateRepository = {
  async create(input: {
    organizationId: string
    userId: string
    state: string
    redirectUri: string
    expiresAt: Date
  }): Promise<LinearOauthState> {
    const db = await getDb()
    const [row] = await db
      .insert(linearOauthState)
      .values({
        organizationId: input.organizationId,
        userId: input.userId,
        stateHash: hashLinearOauthState(input.state),
        redirectUri: input.redirectUri,
        expiresAt: input.expiresAt,
      })
      .returning()

    return row
  },

  async consume(input: {
    organizationId: string
    userId: string
    state: string
  }): Promise<LinearOauthState | null> {
    const db = await getDb()
    const stateHash = hashLinearOauthState(input.state)
    const rows = await db
      .delete(linearOauthState)
      .where(
        and(
          eq(linearOauthState.organizationId, input.organizationId),
          eq(linearOauthState.userId, input.userId),
          eq(linearOauthState.stateHash, stateHash),
          gt(linearOauthState.expiresAt, new Date())
        )
      )
      .returning()

    return rows[0] ?? null
  },

  async consumeByState(state: string): Promise<LinearOauthState | null> {
    const db = await getDb()
    const stateHash = hashLinearOauthState(state)
    const rows = await db
      .delete(linearOauthState)
      .where(
        and(eq(linearOauthState.stateHash, stateHash), gt(linearOauthState.expiresAt, new Date()))
      )
      .returning()

    return rows[0] ?? null
  },

  async deleteExpired(): Promise<void> {
    const db = await getDb()
    await db.delete(linearOauthState).where(lt(linearOauthState.expiresAt, new Date()))
  },
}
