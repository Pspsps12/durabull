import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { linearJobIssue } from '../db/schemas/linear-job-issue/schema'
import type { LinearJobIssue } from '../db/schemas/linear-job-issue/types'

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
      .values(input)
      .onConflictDoNothing({
        target: [
          linearJobIssue.organizationId,
          linearJobIssue.connectionId,
          linearJobIssue.queueName,
          linearJobIssue.jobId,
        ],
      })
      .returning()

    if (inserted) return inserted

    const existing = await findLinearJobIssueByJob(input)

    if (!existing) {
      throw new Error('Linear job issue dedupe conflict could not be resolved.')
    }

    return existing
  },

  async findByEvent(alertEventId: string): Promise<LinearJobIssue[]> {
    const db = await getDb()
    return db.select().from(linearJobIssue).where(eq(linearJobIssue.alertEventId, alertEventId))
  },
}
