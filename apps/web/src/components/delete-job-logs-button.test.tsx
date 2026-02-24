import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeleteJobLogsButton } from '@/components/delete-job-logs-button'

const { mutateMock, toastSuccessMock, toastErrorMock, mutationState } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  mutationState: { isPending: false },
}))

vi.mock('@/hooks/use-queues', () => ({
  useClearJobLogs: () => ({
    mutate: mutateMock,
    isPending: mutationState.isPending,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}))

describe('DeleteJobLogsButton', () => {
  beforeEach(() => {
    mutationState.isPending = false
    mutateMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    vi.restoreAllMocks()
  })

  it('shows a destructive confirmation with permanent warning and log count', async () => {
    const user = userEvent.setup()

    render(<DeleteJobLogsButton queueName="emails" jobId="job-1" logCount={30} />)
    await user.click(screen.getByRole('button', { name: 'Delete Logs' }))

    expect(screen.getByText('Delete Job Logs?')).toBeInTheDocument()
    expect(
      screen.getByText(/This will permanently delete 30 logs from Redis for this job/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete 30 logs' })).toBeInTheDocument()
  })

  it('does not clear logs when dialog is cancelled', async () => {
    const user = userEvent.setup()

    render(<DeleteJobLogsButton queueName="emails" jobId="job-1" logCount={30} />)
    await user.click(screen.getByRole('button', { name: 'Delete Logs' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByText('Delete Job Logs?')).not.toBeInTheDocument())
    expect(mutateMock).not.toHaveBeenCalled()
  })

  it('clears logs after confirmation', async () => {
    const user = userEvent.setup()

    render(<DeleteJobLogsButton queueName="emails" jobId="job-1" logCount={30} />)
    await user.click(screen.getByRole('button', { name: 'Delete Logs' }))
    await user.click(screen.getByRole('button', { name: 'Delete 30 logs' }))

    expect(mutateMock).toHaveBeenCalledTimes(1)
    expect(mutateMock).toHaveBeenCalledWith(
      { queueName: 'emails', jobId: 'job-1' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    )

    const mutationOptions = mutateMock.mock.calls[0][1] as {
      onSuccess: (data: { removed: number }) => void
    }
    mutationOptions.onSuccess({ removed: 30 })

    expect(toastSuccessMock).toHaveBeenCalledWith(
      'Job logs deleted',
      expect.objectContaining({
        description: expect.stringContaining('30 logs'),
      })
    )
  })

  it('is disabled when there are no logs to delete', () => {
    render(<DeleteJobLogsButton queueName="emails" jobId="job-1" logCount={0} />)
    expect(screen.getByRole('button', { name: 'Delete Logs' })).toBeDisabled()
  })
})
