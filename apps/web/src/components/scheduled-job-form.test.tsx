import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScheduledJobForm } from '@/components/scheduled-job-form'

describe('ScheduledJobForm', () => {
  const onSubmit = vi.fn()

  beforeEach(() => {
    onSubmit.mockReset()
    onSubmit.mockResolvedValue(undefined)
  })

  it('submits a fixed-interval scheduler payload in create mode', async () => {
    const user = userEvent.setup()

    render(
      <ScheduledJobForm
        mode="create"
        queueName="emails"
        existingSchedulerIds={[]}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    )

    await user.type(screen.getByLabelText('Job Name'), 'Sync Catalog')

    await waitFor(() => {
      expect(screen.getByLabelText('Scheduler ID')).toHaveValue('sync-catalog')
    })

    await user.click(screen.getByRole('button', { name: /Fixed interval/i }))
    await user.clear(screen.getByLabelText('Interval (ms)'))
    await user.type(screen.getByLabelText('Interval (ms)'), '300000')
    await user.clear(screen.getByLabelText('Attempts'))
    await user.type(screen.getByLabelText('Attempts'), '3')

    await user.click(screen.getByRole('button', { name: 'Create Scheduled Job' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      schedulerId: 'sync-catalog',
      name: 'Sync Catalog',
      data: {},
      schedule: {
        type: 'every',
        everyMs: 300000,
        startDate: undefined,
        endDate: undefined,
        limit: undefined,
      },
      options: {
        attempts: 3,
      },
    })
  })

  it('loads edit state with a locked scheduler id and saves updates', async () => {
    const user = userEvent.setup()

    render(
      <ScheduledJobForm
        mode="edit"
        queueName="emails"
        existingSchedulerIds={['sync-catalog']}
        initialValue={{
          schedulerId: 'sync-catalog',
          jobName: 'Sync Catalog',
          data: { region: 'us-east-1' },
          pattern: '0 * * * *',
          timezone: 'UTC',
          templateOptions: {
            attempts: 2,
          },
        }}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    )

    expect(screen.getByLabelText('Scheduler ID')).toBeDisabled()
    expect(screen.getByLabelText('Scheduler ID')).toHaveValue('sync-catalog')
    expect(screen.getByRole('checkbox')).toBeDisabled()

    await user.clear(screen.getByLabelText('Job Name'))
    await user.type(screen.getByLabelText('Job Name'), 'Sync Catalog Hourly')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      schedulerId: 'sync-catalog',
      name: 'Sync Catalog Hourly',
      data: { region: 'us-east-1' },
      schedule: {
        type: 'cron',
        pattern: '0 * * * *',
        timezone: 'UTC',
        immediately: false,
        startDate: undefined,
        endDate: undefined,
        limit: undefined,
      },
      options: {
        attempts: 2,
      },
    })
  })
})
