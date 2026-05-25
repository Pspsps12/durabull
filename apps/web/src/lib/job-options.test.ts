import { describe, expect, it } from 'vitest'
import {
  createDefaultJobOptionsFormValue,
  formValueToJobOptions,
  jobOptsToFormValue,
} from './job-options'

describe('job options form helpers', () => {
  it('maps BullMQ opts into form values for duplicate prefill', () => {
    expect(
      jobOptsToFormValue(
        {
          attempts: 3,
          priority: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: true,
        },
        2500
      )
    ).toEqual({
      delay: '2500',
      attempts: '3',
      priority: '5',
      backoffMode: 'exponential',
      backoffDelay: '1000',
      removeOnCompleteMode: 'count',
      removeOnCompleteCount: '100',
      removeOnFailMode: 'remove',
      removeOnFailCount: '100',
    })
  })

  it('maps numeric backoff shorthand to fixed backoff', () => {
    expect(jobOptsToFormValue({ backoff: 5000 }).backoffMode).toBe('fixed')
    expect(jobOptsToFormValue({ backoff: 5000 }).backoffDelay).toBe('5000')
  })

  it('builds API payload and omits defaults', () => {
    expect(formValueToJobOptions(createDefaultJobOptionsFormValue())).toBeUndefined()
    expect(
      formValueToJobOptions({
        ...createDefaultJobOptionsFormValue(),
        delay: '1000',
        attempts: '3',
        backoffMode: 'fixed',
        backoffDelay: '500',
      })
    ).toEqual({
      delay: 1000,
      attempts: 3,
      backoff: { type: 'fixed', delay: 500 },
    })
  })
})
