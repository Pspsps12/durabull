import { describe, expect, it } from 'bun:test'
import { buildQueueAddOptions, jobOptionsSchema } from './job-options'

describe('job options helpers', () => {
  it('parses full job options payload', () => {
    const parsed = jobOptionsSchema.parse({
      delay: 5_000,
      priority: 7,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1_000,
      },
      removeOnComplete: 100,
      removeOnFail: true,
    })

    expect(parsed).toEqual({
      delay: 5_000,
      priority: 7,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1_000,
      },
      removeOnComplete: 100,
      removeOnFail: true,
    })
  })

  it('builds queue.add options and omits default values', () => {
    expect(buildQueueAddOptions({})).toEqual({})
    expect(buildQueueAddOptions({ delay: 0, priority: 0, attempts: 1 })).toEqual({})
  })

  it('builds queue.add options with non-default values', () => {
    expect(
      buildQueueAddOptions({
        delay: 2_000,
        priority: 5,
        attempts: 4,
        backoff: {
          type: 'fixed',
          delay: 500,
        },
        removeOnComplete: 25,
        removeOnFail: false,
      })
    ).toEqual({
      delay: 2_000,
      priority: 5,
      attempts: 4,
      backoff: {
        type: 'fixed',
        delay: 500,
      },
      removeOnComplete: 25,
      removeOnFail: false,
    })
  })

  it('rejects invalid backoff delay', () => {
    const result = jobOptionsSchema.safeParse({
      backoff: {
        type: 'fixed',
        delay: -1,
      },
    })

    expect(result.success).toBe(false)
  })
})
