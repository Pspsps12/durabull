import { Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  RETRY_QUEUE_STATUSES,
  type RetryQueueStatus,
  type RetryQueueStatusOption,
  useRetryJobs,
} from '@/hooks/use-queues'

interface QueueJobCounts {
  failed: number
  completed: number
}

interface RetryQueueDialogProps {
  queueName: string
  queueJobCounts?: QueueJobCounts
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATUS_LABELS: Record<RetryQueueStatus, string> = {
  failed: 'Failed',
  completed: 'Completed',
}

export function RetryQueueDialog({
  queueName,
  queueJobCounts,
  open,
  onOpenChange,
}: RetryQueueDialogProps) {
  const [retryAll, setRetryAll] = useState(false)
  const [selectedStatuses, setSelectedStatuses] = useState<Set<RetryQueueStatus>>(new Set())
  const retryMutation = useRetryJobs()

  useEffect(() => {
    if (!open) {
      setRetryAll(false)
      setSelectedStatuses(new Set())
    }
  }, [open])

  const jobCounts = useMemo(
    () =>
      ({
        failed: queueJobCounts?.failed ?? 0,
        completed: queueJobCounts?.completed ?? 0,
      }) satisfies Record<RetryQueueStatus, number>,
    [queueJobCounts]
  )

  const totalRetryableJobs = Object.values(jobCounts).reduce((sum, count) => sum + count, 0)
  const hasStatusSelection = retryAll || selectedStatuses.size > 0
  const selectedJobsEstimate = retryAll
    ? totalRetryableJobs
    : Array.from(selectedStatuses).reduce((sum, status) => sum + jobCounts[status], 0)
  const canRetry = hasStatusSelection && selectedJobsEstimate > 0
  const isRetrying = retryMutation.isPending

  const toggleStatus = (status: RetryQueueStatus) => {
    if (retryAll) return

    setSelectedStatuses((current) => {
      const next = new Set(current)
      if (next.has(status)) {
        next.delete(status)
      } else {
        next.add(status)
      }
      return next
    })
  }

  const handleRetry = async () => {
    if (!canRetry) return

    const statuses: RetryQueueStatusOption[] = retryAll ? ['all'] : Array.from(selectedStatuses)

    try {
      const result = await retryMutation.mutateAsync({
        queueName,
        statuses,
      })

      toast.success('Queue retry completed', {
        description:
          result.failed > 0
            ? `Retried ${result.success.toLocaleString()} jobs. ${result.failed.toLocaleString()} retries failed.`
            : `Retried ${result.success.toLocaleString()} jobs.`,
      })
      onOpenChange(false)
    } catch {
      // Errors are surfaced by shared API handlers.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Retry Queue Jobs
          </DialogTitle>
          <DialogDescription>
            Retry all jobs for the selected statuses. This is useful for quickly requeuing large
            batches.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground mb-2">Queue:</p>
            <p className="font-mono font-semibold break-all">{queueName}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Retryable jobs detected:{' '}
              <span className="font-semibold">{totalRetryableJobs.toLocaleString()}</span>
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Select statuses to retry</Label>

            <label
              htmlFor="retry-all-jobs"
              className="flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer"
            >
              <span className="text-sm font-medium">All retryable jobs</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {totalRetryableJobs.toLocaleString()}
                </span>
                <input
                  id="retry-all-jobs"
                  type="checkbox"
                  checked={retryAll}
                  onChange={(e) => {
                    setRetryAll(e.target.checked)
                    if (e.target.checked) {
                      setSelectedStatuses(new Set())
                    }
                  }}
                  className="rounded border-gray-300"
                />
              </div>
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              {RETRY_QUEUE_STATUSES.map((status) => (
                <label
                  key={status}
                  htmlFor={`retry-status-${status}`}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                    retryAll ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <span className="text-sm">{STATUS_LABELS[status]}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {jobCounts[status].toLocaleString()}
                    </span>
                    <input
                      id={`retry-status-${status}`}
                      type="checkbox"
                      checked={selectedStatuses.has(status)}
                      onChange={() => toggleStatus(status)}
                      disabled={retryAll}
                      className="rounded border-gray-300"
                    />
                  </div>
                </label>
              ))}
            </div>

            {!hasStatusSelection && (
              <p className="text-xs text-muted-foreground">
                Select one or more statuses (or All retryable jobs) to continue.
              </p>
            )}
            {hasStatusSelection && selectedJobsEstimate > 0 && (
              <p className="text-xs text-muted-foreground">
                Estimated jobs to retry: {selectedJobsEstimate.toLocaleString()}
              </p>
            )}
            {hasStatusSelection && selectedJobsEstimate === 0 && (
              <p className="text-xs text-muted-foreground">
                No jobs currently match the selected statuses.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRetrying}>
            Cancel
          </Button>
          <Button onClick={handleRetry} disabled={!canRetry || isRetrying}>
            {isRetrying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Jobs
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
