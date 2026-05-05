import { and, asc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import {
  alertDelivery,
  type AlertDeliveryChannelType,
  type AlertDeliveryStatus,
} from '../db/schemas/alert-delivery/schema'
import type { AlertDelivery } from '../db/schemas/alert-delivery/types'

const STALE_CLAIM_MS = 10 * 60 * 1000

function toNumber(value: number | string | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0
  return Number(value)
}

export interface AlertDeliveryInput {
  alertEventId: string
  organizationId: string
  channelType: AlertDeliveryChannelType
  target: string
  providerMetadata?: Record<string, unknown>
}

export const alertDeliveryRepository = {
  async enqueueMany(inputs: AlertDeliveryInput[]): Promise<AlertDelivery[]> {
    if (inputs.length === 0) return []
    const db = await getDb()

    return db
      .insert(alertDelivery)
      .values(
        inputs.map((input) => ({
          alertEventId: input.alertEventId,
          organizationId: input.organizationId,
          channelType: input.channelType,
          target: input.target,
          providerMetadata: input.providerMetadata ?? {},
        }))
      )
      .onConflictDoNothing()
      .returning()
  },

  async listByEvent(alertEventId: string): Promise<AlertDelivery[]> {
    const db = await getDb()
    return db
      .select()
      .from(alertDelivery)
      .where(eq(alertDelivery.alertEventId, alertEventId))
      .orderBy(asc(alertDelivery.createdAt))
  },

  async claimDueForEvent(alertEventId: string, limit = 20): Promise<AlertDelivery[]> {
    const db = await getDb()
    const now = new Date()
    const staleClaimCutoff = new Date(now.getTime() - STALE_CLAIM_MS)

    const rows = await db
      .select({ id: alertDelivery.id })
      .from(alertDelivery)
      .where(
        and(
          eq(alertDelivery.alertEventId, alertEventId),
          or(
            eq(alertDelivery.status, 'pending'),
            eq(alertDelivery.status, 'failed'),
            and(eq(alertDelivery.status, 'claimed'), lte(alertDelivery.claimedAt, staleClaimCutoff))
          ),
          or(isNull(alertDelivery.nextRetryAt), lte(alertDelivery.nextRetryAt, now))
        )
      )
      .orderBy(asc(alertDelivery.createdAt))
      .limit(limit)

    if (rows.length === 0) return []
    const ids = rows.map((row) => row.id)

    return db
      .update(alertDelivery)
      .set({
        status: 'claimed',
        claimedAt: now,
        updatedAt: now,
      })
      .where(inArray(alertDelivery.id, ids))
      .returning()
  },

  async markDelivered(
    id: string,
    metadata: {
      externalId?: string | null
      externalIdentifier?: string | null
      externalUrl?: string | null
      providerMetadata?: Record<string, unknown>
    } = {}
  ): Promise<void> {
    const db = await getDb()
    await db
      .update(alertDelivery)
      .set({
        status: 'delivered',
        claimedAt: null,
        nextRetryAt: null,
        lastError: null,
        externalId: metadata.externalId ?? null,
        externalIdentifier: metadata.externalIdentifier ?? null,
        externalUrl: metadata.externalUrl ?? null,
        providerMetadata: metadata.providerMetadata ?? {},
        updatedAt: new Date(),
      })
      .where(eq(alertDelivery.id, id))
  },

  async markFailed(
    id: string,
    options: { error: string; retryable: boolean; nextRetryAt?: Date | null }
  ): Promise<void> {
    const db = await getDb()
    const now = new Date()
    await db
      .update(alertDelivery)
      .set({
        status: 'failed',
        attemptCount: sql`${alertDelivery.attemptCount} + 1`,
        claimedAt: null,
        nextRetryAt: options.retryable ? (options.nextRetryAt ?? now) : null,
        lastError: options.error.slice(0, 1000),
        updatedAt: now,
      })
      .where(eq(alertDelivery.id, id))
  },

  async countByStatuses(alertEventId: string): Promise<Record<AlertDeliveryStatus, number>> {
    const db = await getDb()
    const rows = await db
      .select({
        status: alertDelivery.status,
        count: sql<number>`count(*)`,
      })
      .from(alertDelivery)
      .where(eq(alertDelivery.alertEventId, alertEventId))
      .groupBy(alertDelivery.status)

    return {
      pending: 0,
      claimed: 0,
      delivered: 0,
      failed: 0,
      ...Object.fromEntries(rows.map((row) => [row.status, toNumber(row.count)])),
    }
  },
}
