import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { JobRemoveButton } from '@/components/job-remove-button'

describe('JobRemoveButton', () => {
  it('renders a direct remove button for regular jobs', async () => {
    const user = userEvent.setup()
    const onRemoveJobOnly = vi.fn()

    render(
      <JobRemoveButton
        isScheduledJob={false}
        onRemoveJobOnly={onRemoveJobOnly}
        onRemoveJobAndStopScheduler={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByText('Remove Job?')).toBeInTheDocument()
    expect(onRemoveJobOnly).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Remove Job' }))

    expect(onRemoveJobOnly).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Remove Job & Stop Scheduler')).not.toBeInTheDocument()
  })

  it('shows scheduler-specific actions for scheduled jobs', async () => {
    const user = userEvent.setup()
    const onRemoveJobOnly = vi.fn()
    const onRemoveJobAndStopScheduler = vi.fn()

    render(
      <JobRemoveButton
        isScheduledJob
        subject="this scheduled job"
        onRemoveJobOnly={onRemoveJobOnly}
        onRemoveJobAndStopScheduler={onRemoveJobAndStopScheduler}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(screen.getByRole('menuitem', { name: /Remove Job Only/i }))
    expect(screen.getByText('Remove Scheduled Job Instance?')).toBeInTheDocument()
    expect(screen.getByText(/scheduler will continue creating future runs/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove Job Only' }))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(screen.getByRole('menuitem', { name: /Remove Job & Stop Scheduler/i }))
    expect(screen.getByText('Remove Job & Stop Scheduler?')).toBeInTheDocument()
    expect(screen.getByText(/stop future scheduled runs/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove & Stop Scheduler' }))

    expect(onRemoveJobOnly).toHaveBeenCalledTimes(1)
    expect(onRemoveJobAndStopScheduler).toHaveBeenCalledTimes(1)
  })
})
