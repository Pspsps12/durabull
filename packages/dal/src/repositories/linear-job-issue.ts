import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '../db/client'
import { linearJobIssue } from '../db/schemas/linear-job-issue/schema'
import type { LinearJobIssue } from '../db/schemas/linear-job-issue/types'
import { linearJobIssueEvent } from '../db/schemas/linear-job-issue-event/schema'

export interface CreateLinearJobIssueInput {
  organizationId: string
  connectionId: string
  queueName: string
  jobId: string
  alertEventId: string
  linearIssueId: string
  linearIssueIdentifier: string
  linearIssueUrl: string
}

async function findLinearJobIssueByJob(input: {
  organizationId: string
  connectionId: string
  queueName: string
  jobId: string
}): Promise<LinearJobIssue | null> {
  const db = await getDb()
  const rows = await db
    .select()
    .from(linearJobIssue)
    .where(
      and(
        eq(linearJobIssue.organizationId, input.organizationId),
        eq(linearJobIssue.connectionId, input.connectionId),
        eq(linearJobIssue.queueName, input.queueName),
        eq(linearJobIssue.jobId, input.jobId)
      )
    )
    .limit(1)

  return rows[0] ?? null
}

async function linkIssueToEvent(linearJobIssueId: string, alertEventId: string): Promise<void> {
  const db = await getDb()
  await db
    .insert(linearJobIssueEvent)
    .values({ linearJobIssueId, alertEventId })
    .onConflictDoNothing({
      target: [linearJobIssueEvent.linearJobIssueId, linearJobIssueEvent.alertEventId],
    })
}

export const linearJobIssueRepository = {
  async findByJob(input: {
    organizationId: string
    connectionId: string
    queueName: string
    jobId: string
  }): Promise<LinearJobIssue | null> {
    return findLinearJobIssueByJob(input)
  },

  async createOrGet(input: CreateLinearJobIssueInput): Promise<LinearJobIssue> {
    const db = await getDb()
    const [inserted] = await db
      .insert(linearJobIssue)
      .values({
        organizationId: input.organizationId,
        connectionId: input.connectionId,
        queueName: input.queueName,
        jobId: input.jobId,
        linearIssueId: input.linearIssueId,
        linearIssueIdentifier: input.linearIssueIdentifier,
        linearIssueUrl: input.linearIssueUrl,
      })
      .onConflictDoNothing({
        target: [
          linearJobIssue.organizationId,
          linearJobIssue.connectionId,
          linearJobIssue.queueName,
          linearJobIssue.jobId,
        ],
      })
      .returning()

    if (inserted) {
      await linkIssueToEvent(inserted.id, input.alertEventId)
      return inserted
    }

    const existing = await findLinearJobIssueByJob(input)

    if (!existing) {
      throw new Error('Linear job issue dedupe conflict could not be resolved.')
    }

    await linkIssueToEvent(existing.id, input.alertEventId)
    return existing
  },

  async findByEvent(alertEventId: string): Promise<LinearJobIssue[]> {
    const db = await getDb()
    const links = await db
      .select({ linearJobIssueId: linearJobIssueEvent.linearJobIssueId })
      .from(linearJobIssueEvent)
      .where(eq(linearJobIssueEvent.alertEventId, alertEventId))

    if (links.length === 0) return []

    return db
      .select()
      .from(linearJobIssue)
      .where(
        inArray(
          linearJobIssue.id,
          links.map((link) => link.linearJobIssueId)
        )
      )
  },
}
