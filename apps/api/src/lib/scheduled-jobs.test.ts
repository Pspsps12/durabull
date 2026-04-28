import { describe, expect, it } from 'bun:test'
import {
  buildScheduledJobCreateInput,
  buildScheduledJobUpdateInput,
  createScheduledJobSchema,
  isValidTimeZone,
  mapScheduledJob,
  parseOptionalTimestamp,
  updateScheduledJobSchema,
} from './scheduled-jobs'

describe('scheduled job helpers', () => {
  it('normalizes a cron-based scheduled job payload', () => {
    const input = createScheduledJobSchema.parse({
      schedulerId: 'billing-hourly',
      name: 'reconcile-billing',
      data: { source: 'test' },
      schedule: {
        type: 'cron',
        pattern: '0 * * * *',
        timezone: 'America/Los_Angeles',
        immediately: true,
        startDate: '2026-03-30T09:00:00.000Z',
        endDate: '2026-04-30T09:00:00.000Z',
        limit: 25,
      },
      options: {
        attempts: 3,
        priority: 7,
        backoff: {
          type: 'fixed',
          delay: 5_000,
        },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    })

    const normalized = buildScheduledJobCreateInput(input)

    expect(normalized).toEqual({
      schedulerId: 'billing-hourly',
      jobName: 'reconcile-billing',
      jobData: { source: 'test' },
      repeatOptions: {
        pattern: '0 * * * *',
        tz: 'America/Los_Angeles',
        startDate: Date.parse('2026-03-30T09:00:00.000Z'),
        endDate: Date.parse('2026-04-30T09:00:00.000Z'),
        limit: 25,
        immediately: true,
      },
      templateOptions: {
        attempts: 3,
        priority: 7,
        backoff: {
          type: 'fixed',
          delay: 5_000,
        },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    })
  })

  it('normalizes a fixed-interval scheduled job payload', () => {
    const input = createScheduledJobSchema.parse({
      schedulerId: 'sync-every-15m',
      name: 'sync-catalog',
      data: {},
      schedule: {
        type: 'every',
        everyMs: 900_000,
        startDate: '2026-03-30T09:00:00.000Z',
        limit: 10,
      },
    })

    const normalized = buildScheduledJobCreateInput(input)

    expect(normalized.repeatOptions).toEqual({
      every: 900_000,
      startDate: Date.parse('2026-03-30T09:00:00.000Z'),
      endDate: undefined,
      limit: 10,
    })
    expect(normalized.templateOptions).toBeUndefined()
  })

  it('normalizes an update payload against an existing scheduler id', () => {
    const input = updateScheduledJobSchema.parse({
      name: 'sync-catalog',
      data: { source: 'dashboard' },
      schedule: {
        type: 'cron',
        pattern: '0 */6 * * *',
        timezone: 'UTC',
      },
      options: {
        attempts: 2,
      },
    })

    const normalized = buildScheduledJobUpdateInput('sync-catalog-prod', input)

    expect(normalized).toEqual({
      schedulerId: 'sync-catalog-prod',
      jobName: 'sync-catalog',
      jobData: { source: 'dashboard' },
      repeatOptions: {
        pattern: '0 */6 * * *',
        tz: 'UTC',
        startDate: undefined,
        endDate: undefined,
        limit: undefined,
        immediately: false,
      },
      templateOptions: {
        attempts: 2,
      },
    })
  })

  it('rejects invalid timezones and inverted date windows', () => {
    const result = createScheduledJobSchema.safeParse({
      schedulerId: 'broken-scheduler',
      name: 'broken-job',
      data: {},
      schedule: {
        type: 'cron',
        pattern: '0 * * * *',
        timezone: 'Mars/Olympus_Mons',
        startDate: '2026-04-30T09:00:00.000Z',
        endDate: '2026-03-30T09:00:00.000Z',
      },
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['schedule', 'timezone'],
          }),
          expect.objectContaining({
            path: ['schedule', 'endDate'],
          }),
        ])
      )
    }
  })

  it('rejects scheduler identifiers with unsafe characters', () => {
    const result = createScheduledJobSchema.safeParse({
      schedulerId: 'billing/run',
      name: 'reconcile-billing',
      data: {},
      schedule: {
        type: 'every',
        everyMs: 10_000,
      },
    })

    expect(result.success).toBe(false)
  })

  it('maps BullMQ scheduler metadata into the API response shape', () => {
    const scheduledJob = mapScheduledJob(
      'emails',
      {
        key: 'send-digest-hourly',
        name: 'send-digest',
        every: 3_600_000,
        next: 1_775_000_000_000,
        limit: 12,
        iterationCount: 2,
        startDate: 1_774_000_000_000,
        endDate: 1_776_000_000_000,
        template: {
          data: { tenantId: 'acme' },
          opts: {
            attempts: 2,
            removeOnFail: true,
          },
        },
      },
      { count: 4, lastFailedAt: 1_774_500_000_000 }
    )

    expect(scheduledJob).toEqual({
      schedulerId: 'send-digest-hourly',
      pattern: undefined,
      every: 3_600_000,
      queueName: 'emails',
      jobName: 'send-digest',
      nextRun: 1_775_000_000_000,
      enabled: true,
      data: { tenantId: 'acme' },
      templateOptions: {
        attempts: 2,
        removeOnFail: true,
      },
      timezone: undefined,
      startDate: 1_774_000_000_000,
      endDate: 1_776_000_000_000,
      limit: 12,
      iterationCount: 2,
      recentFailedCount: 4,
      lastFailedAt: 1_774_500_000_000,
    })
  })

  it('parses optional timestamps and validates timezones', () => {
    expect(parseOptionalTimestamp('2026-03-30T09:00:00.000Z')).toBe(
      Date.parse('2026-03-30T09:00:00.000Z')
    )
    expect(parseOptionalTimestamp('')).toBeUndefined()
    expect(parseOptionalTimestamp(undefined)).toBeUndefined()
    expect(isValidTimeZone('UTC')).toBe(true)
    expect(isValidTimeZone('America/Los_Angeles')).toBe(true)
    expect(isValidTimeZone('Nope/Nowhere')).toBe(false)
  })
})
